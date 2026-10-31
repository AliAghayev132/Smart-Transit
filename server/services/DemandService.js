import { config } from "#config";
import { TripIntent, RouteAlert } from "#models";
import socketService from "#services/SocketService.js";

const EARTH_M = 6378100;

/**
 * DemandService (singleton) — Yanaşma A (proaktiv tələb).
 * Marşrut axtarışı ("searched") və "Gedirəm" ("confirmed") niyyətlərindən:
 *  - nöqtə ətrafında (radius) getmək istəyənlərin sayı,
 *  - dayanacaq / xətt üzrə gözlənilən minik,
 *  - həddi aşan xətt üçün PROAKTİV xəbərdarlıq (DEMAND_FORECAST).
 */
class DemandService {
  constructor() {
    this.fleet = null;
    this.timer = null;
    this.locks = new Map();
    this.alertListeners = [];
  }

  get cfg() {
    return config.transit.demand;
  }

  init(fleet) {
    this.fleet = fleet;
  }

  onAlert(fn) {
    this.alertListeners.push(fn);
  }

  activeQuery() {
    const now = Date.now();
    return {
      status: { $in: ["searched", "confirmed"] },
      expiresAt: { $gt: new Date(now) },
      departAt: { $lte: new Date(now + this.cfg.horizonMin * 60000) },
    };
  }

  /** Niyyəti yaradır / yeniləyir (cihaz başına bir aktiv niyyət) */
  async upsert({ deviceId, status, from, to, itinerary }) {
    const now = Date.now();
    if (status === "searched") {
      // təsdiqlənmiş niyyəti zəif "axtarış" siqnalı ilə əvəz etmirik
      const confirmed = await TripIntent.findOne({
        deviceId,
        status: "confirmed",
        expiresAt: { $gt: new Date(now) },
      }).lean();
      if (confirmed) return confirmed;
    }
    const firstBus = itinerary?.legs?.find(
      (l) => l.type === "bus" && l.routeId,
    );
    const doc = {
      deviceId,
      status,
      origin: { type: "Point", coordinates: [from.lng, from.lat] },
      destination: { type: "Point", coordinates: [to.lng, to.lat] },
      originLabel: from.name,
      destinationLabel: to.name,
      board: firstBus
        ? {
            route: firstBus.routeId,
            routeNumber: firstBus.number,
            stopId: firstBus.from?.stopId,
            stopName: firstBus.from?.name,
            lat: firstBus.from?.lat,
            lng: firstBus.from?.lng,
          }
        : undefined,
      routes: (itinerary?.legs || [])
        .filter((l) => l.type === "bus" && l.routeId)
        .map((l) => l.routeId),
      departAt: new Date(now + (firstBus?.departInSec || 0) * 1000),
      expiresAt: new Date(now + this.cfg.intentTtlMin * 60000),
    };
    const saved = await TripIntent.findOneAndUpdate(
      { deviceId },
      { $set: doc },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    if (status === "confirmed" && firstBus) {
      this.checkRoute(firstBus.routeId).catch((e) =>
        console.error("❌ Demand:", e.message),
      );
    }
    socketService.broadcast("demand:changed", { at: new Date() });
    return saved;
  }

  async cancel(deviceId) {
    await TripIntent.updateOne(
      { deviceId },
      {
        $set: { status: "cancelled", expiresAt: new Date(Date.now() + 60000) },
      },
    );
    socketService.broadcast("demand:changed", { at: new Date() });
  }

  /** Nöqtə ətrafında getmək istəyən digər istifadəçilər */
  async nearby({ lat, lng, radiusM = this.cfg.defaultRadiusM, excludeDevice }) {
    const q = {
      ...this.activeQuery(),
      origin: {
        $geoWithin: { $centerSphere: [[lng, lat], radiusM / EARTH_M] },
      },
    };
    if (excludeDevice) q.deviceId = { $ne: excludeDevice };
    const list = await TripIntent.find(q).lean();
    const byStop = new Map();
    const byDest = new Map();
    for (const it of list) {
      if (it.board?.stopName) {
        const k = `${it.board.routeNumber}|${it.board.stopName}`;
        const cur = byStop.get(k) || {
          routeNumber: it.board.routeNumber,
          stopName: it.board.stopName,
          confirmed: 0,
          searched: 0,
        };
        cur[it.status]++;
        byStop.set(k, cur);
      }
      if (it.destinationLabel)
        byDest.set(
          it.destinationLabel,
          (byDest.get(it.destinationLabel) || 0) + 1,
        );
    }
    return {
      radiusM,
      horizonMin: this.cfg.horizonMin,
      total: list.length,
      confirmed: list.filter((x) => x.status === "confirmed").length,
      searched: list.filter((x) => x.status === "searched").length,
      byStop: [...byStop.values()].sort(
        (a, b) => b.confirmed + b.searched - (a.confirmed + a.searched),
      ),
      topDestinations: [...byDest.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count })),
    };
  }

  /** Dayanacaqlar üzrə gözlənilən minik (operator) */
  async stops(routeId) {
    const q = { ...this.activeQuery(), "board.stopId": { $exists: true } };
    if (routeId) q["board.route"] = routeId;
    const list = await TripIntent.find(q).lean();
    const map = new Map();
    for (const it of list) {
      const k = `${it.board.route}|${it.board.stopId}`;
      const cur = map.get(k) || {
        routeId: String(it.board.route),
        routeNumber: it.board.routeNumber,
        stopId: String(it.board.stopId),
        stopName: it.board.stopName,
        lat: it.board.lat,
        lng: it.board.lng,
        confirmed: 0,
        searched: 0,
        nextDepartAt: null,
      };
      cur[it.status]++;
      if (!cur.nextDepartAt || it.departAt < cur.nextDepartAt)
        cur.nextDepartAt = it.departAt;
      map.set(k, cur);
    }
    const stops = [...map.values()].sort(
      (a, b) => b.confirmed * 2 + b.searched - (a.confirmed * 2 + a.searched),
    );
    return { horizonMin: this.cfg.horizonMin, total: list.length, stops };
  }

  /** Xətt üzrə təsdiqlənmiş niyyət sayı (dispetçer tövsiyəsi üçün) */
  async confirmedForRoute(routeId) {
    return TripIntent.countDocuments({
      ...this.activeQuery(),
      status: "confirmed",
      "board.route": routeId,
    });
  }

  checkRoute(routeId) {
    const id = String(routeId);
    const run = (this.locks.get(id) || Promise.resolve()).then(() =>
      this.#checkRoute(id),
    );
    this.locks.set(
      id,
      run.catch(() => {}),
    );
    return run;
  }

  async #checkRoute(routeId) {
    const r = this.fleet.getRoute(routeId);
    if (!r) return null;
    const list = await TripIntent.find({
      ...this.activeQuery(),
      status: "confirmed",
      "board.route": routeId,
    }).lean();
    if (list.length < this.cfg.alertMinConfirmed) return null;

    const counts = {};
    list.forEach(
      (x) => (counts[x.board.stopName] = (counts[x.board.stopName] || 0) + 1),
    );
    const [topStop, topStopCount] = Object.entries(counts).sort(
      (a, b) => b[1] - a[1],
    )[0];
    const stats = {
      windowMin: this.cfg.horizonMin,
      confirmedIntents: list.length,
      topStop,
      topStopCount,
    };

    const existing = await RouteAlert.findActiveFor(routeId, "DEMAND_FORECAST");
    if (existing) {
      existing.stats = { ...(existing.stats || {}), ...stats };
      await existing.save();
      const populated = await existing.populate("route", "number name color");
      socketService.toOperators("alert:update", populated);
      return populated;
    }
    const alert = await RouteAlert.create({
      route: routeId,
      type: "DEMAND_FORECAST",
      message: `${r.route.number} nömrəli xətt: növbəti ${this.cfg.horizonMin} dəqiqədə ${list.length} sərnişin «Gedirəm» bildirib (ən çox: ${topStop}) — əlavə avtobus ehtiyatı ayrılmalıdır`,
      stats,
      history: [
        {
          status: "open",
          note: "Proaktiv tələb proqnozu",
          noteKey: "auto_demand",
        },
      ],
    });
    const populated = await alert.populate("route", "number name color");
    for (const fn of this.alertListeners)
      await Promise.resolve(fn(populated, true)).catch(() => {});
    console.log(`🧭 Tələb proqnozu: ${alert.message}`);
    socketService.toOperators("alert:new", populated);
    return populated;
  }

  async checkAll() {
    for (const id of this.fleet.routes.keys()) await this.checkRoute(id);
  }

  start() {
    this.timer = setInterval(
      () =>
        this.checkAll().catch((e) => console.error("❌ Demand:", e.message)),
      60000,
    );
  }

  stop() {
    clearInterval(this.timer);
  }
}

const demandService = new DemandService();

export { DemandService, demandService };
