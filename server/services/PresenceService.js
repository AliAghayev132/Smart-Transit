import { config } from "#config";
import { DensitySnapshot } from "#models";
import { boostCount } from "#utils";
import { GeoService } from "#services/GeoService.js";
import socketService from "#services/SocketService.js";

const MIN_INTERVAL_MS = 3000;

/**
 * PresenceService (singleton) — Yanaşma B (canlı lokasiya).
 * İstifadəçi razılıq verdikdə mövqe Socket.IO ilə gəlir; YALNIZ yaddaşda saxlanılır
 * (açar = anonim socket id), ttlSec ərzində yenilənməyən silinir. Hesablanır:
 *  - şəbəkə xanaları üzrə say (heatmap), dayanacaqda gözləyənlər, avtobusdakılar.
 * Bazaya yalnız dəqiqəlik anonim aqreqat yazılır (DensitySnapshot).
 * Sərnişin təxminləri (xana sayı, gözləyənlər, avtobusdakılar) CROWD_DISPLAY_BOOST_PCT ilə
 * artırılır (utils/crowdBoost.js); `total` — qoşulmuş tətbiq istifadəçiləri (xam).
 */
class PresenceService {
  constructor() {
    this.fleet = null;
    this.users = new Map();
    this.timers = [];
    this.last = {
      at: new Date().toISOString(),
      total: 0,
      cells: [],
      stops: [],
      buses: [],
      cellDeg: 0.0015,
    };
  }

  get cfg() {
    return config.transit.presence;
  }

  init(fleet) {
    this.fleet = fleet;
    socketService.on("presenceUpdate", (key, p) => this.update(key, p));
    socketService.on("presenceStop", (key) => this.remove(key));
  }

  update(key, p) {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
    if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return false;
    const now = Date.now();
    const prev = this.users.get(key);
    if (prev && !prev.synthetic && now - prev.ts < MIN_INTERVAL_MS)
      return false;
    this.users.set(key, {
      lat: p.lat,
      lng: p.lng,
      accuracy: Number.isFinite(p.accuracy) ? p.accuracy : null,
      speed: Number.isFinite(p.speed) ? p.speed : null,
      ts: now,
    });
    return true;
  }

  remove(key) {
    this.users.delete(key);
  }

  prune(now = Date.now()) {
    const ttl = this.cfg.ttlSec * 1000;
    for (const [k, u] of this.users) {
      if (u.synthetic ? now > u.until : now - u.ts > ttl) this.users.delete(k);
    }
  }

  /** Demo: virtual istifadəçilər (bir hissəsi avtobusda, bir hissəsi dayanacaqda) */
  addSynthetic(count = 40, minutes = 3) {
    const buses = [...this.fleet.buses.values()];
    const stops = [...this.fleet.routes.values()].flatMap((r) => r.route.stops);
    const until = Date.now() + minutes * 60000;
    const j = () => (Math.random() - 0.5) * 0.0006;
    for (let i = 0; i < count; i++) {
      const key = `syn-${Date.now().toString(36)}-${i}`;
      if (Math.random() < 0.55 && buses.length) {
        const b = buses[Math.floor(Math.random() * buses.length)];
        this.users.set(key, {
          synthetic: true,
          until,
          followBus: b.id,
          dLat: j() / 3,
          dLng: j() / 3,
          lat: b.lat,
          lng: b.lng,
          ts: Date.now(),
        });
      } else if (stops.length) {
        const s = stops[Math.floor(Math.random() * stops.length)];
        this.users.set(key, {
          synthetic: true,
          until,
          lat: s.lat + j() / 2,
          lng: s.lng + j() / 2,
          speed: 0,
          ts: Date.now(),
        });
      }
    }
    return count;
  }

  compute() {
    const now = Date.now();
    this.prune(now);
    const cfg = this.cfg;

    // Fiziki dayanacaqlar (bir neçə xəttdə eyni dayanacaq ola bilər)
    const stopMap = new Map();
    for (const { route } of this.fleet.routes.values()) {
      for (const s of route.stops) {
        const key = `${s.name}|${s.lat.toFixed(3)}|${s.lng.toFixed(3)}`;
        const cur = stopMap.get(key) || {
          key,
          stopIds: [],
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          routes: [],
          waiting: 0,
        };
        cur.stopIds.push(String(s._id));
        if (!cur.routes.includes(route.number)) cur.routes.push(route.number);
        stopMap.set(key, cur);
      }
    }
    const stops = [...stopMap.values()];
    const buses = [...this.fleet.buses.values()];
    const riders = new Map();
    const cells = new Map();

    for (const u of this.users.values()) {
      if (u.followBus) {
        const b = this.fleet.buses.get(u.followBus);
        if (!b) continue;
        u.lat = b.lat + u.dLat;
        u.lng = b.lng + u.dLng;
      }
      const ck = `${Math.floor(u.lat / cfg.cellDeg)}:${Math.floor(u.lng / cfg.cellDeg)}`;
      cells.set(ck, (cells.get(ck) || 0) + 1);

      let onBus = null;
      let bestM = cfg.busRadiusM;
      for (const b of buses) {
        const m = GeoService.haversine([u.lat, u.lng], [b.lat, b.lng]);
        if (m <= bestM) {
          bestM = m;
          onBus = b;
        }
      }
      if (onBus) {
        riders.set(onBus.id, (riders.get(onBus.id) || 0) + 1);
        continue;
      }
      if (u.speed != null && u.speed > 1.5) continue; // hərəkətdədir — gözləmir
      let nearStop = null;
      let bestS = cfg.stopRadiusM;
      for (const s of stops) {
        const m = GeoService.haversine([u.lat, u.lng], [s.lat, s.lng]);
        if (m <= bestS) {
          bestS = m;
          nearStop = s;
        }
      }
      if (nearStop) nearStop.waiting++;
    }

    this.last = {
      at: new Date(now).toISOString(),
      total: this.users.size,
      cellDeg: cfg.cellDeg,
      cells: [...cells.entries()]
        .filter(([, n]) => n >= cfg.minCellCount)
        .map(([k, count]) => {
          const [a, b] = k.split(":").map(Number);
          return {
            lat: (a + 0.5) * cfg.cellDeg,
            lng: (b + 0.5) * cfg.cellDeg,
            count: boostCount(count),
          };
        }),
      stops: stops
        .filter((s) => s.waiting > 0)
        .map(({ key, stopIds, name, lat, lng, routes, waiting }) => ({
          key,
          stopIds,
          name,
          lat,
          lng,
          routes,
          waiting: boostCount(waiting),
        }))
        .sort((a, b) => b.waiting - a.waiting),
      buses: [...riders.entries()]
        .map(([busId, n]) => {
          const b = this.fleet.buses.get(busId);
          const r = b && this.fleet.getRoute(b.routeId);
          return {
            busId,
            routeId: b?.routeId,
            routeNumber: r?.route.number,
            plate: b?.plate,
            riders: boostCount(n),
          };
        })
        .sort((a, b) => b.riders - a.riders),
    };
    return this.last;
  }

  waitingAt(stopId) {
    return (
      this.last.stops.find((x) => x.stopIds.includes(String(stopId)))
        ?.waiting || 0
    );
  }

  ridersOn(busId) {
    return this.last.buses.find((x) => x.busId === String(busId))?.riders || 0;
  }

  ridersOnRoute(routeId) {
    return this.last.buses
      .filter((b) => b.routeId === String(routeId))
      .reduce((s, b) => s + b.riders, 0);
  }

  async snapshot() {
    const l = this.last;
    if (!l.total) return;
    await DensitySnapshot.create({
      at: new Date(l.at),
      total: l.total,
      cellDeg: l.cellDeg,
      cells: l.cells,
      stops: l.stops.map((s) => ({
        stopId: s.stopIds[0],
        name: s.name,
        waiting: s.waiting,
      })),
      buses: l.buses.map((b) => ({
        busId: b.busId,
        routeNumber: b.routeNumber,
        riders: b.riders,
      })),
    });
  }

  start() {
    this.timers.push(
      setInterval(
        () =>
          socketService.broadcast("density:update", this.compute(), {
            volatile: true,
          }),
        this.cfg.broadcastSec * 1000,
      ),
    );
    this.timers.push(
      setInterval(
        () =>
          this.snapshot().catch((e) =>
            console.error("❌ Presence:", e.message),
          ),
        this.cfg.snapshotSec * 1000,
      ),
    );
  }

  stop() {
    this.timers.forEach(clearInterval);
  }
}

const presenceService = new PresenceService();

export { PresenceService, presenceService };
