/**
 * Yanaşma A — Proaktiv tələb.
 * İstifadəçilər marşrut axtardıqda ("searched") və ya "Gedirəm" dedikdə ("confirmed")
 * səyahət niyyəti yaranır. Bundan:
 *  - seçilmiş nöqtənin radiusunda neçə nəfərin getmək istədiyi,
 *  - dayanacaq/xətt üzrə gözlənilən minik sayı,
 *  - həddi aşan xətt üçün PROAKTİV xəbərdarlıq (avtobuslar dolmamışdan əvvəl) hesablanır.
 */
const { EventEmitter } = require('events');
const TripIntent = require('../models/TripIntent');
const Alert = require('../models/Alert');
const config = require('../config');

const EARTH_M = 6378100;

class Demand extends EventEmitter {
  constructor(fleet) {
    super();
    this.fleet = fleet;
    this.timer = null;
  }

  /** Niyyəti yaradır/yeniləyir (cihaz başına bir aktiv niyyət) */
  async upsert({ deviceId, status, from, to, itinerary }) {
    const now = Date.now();
    if (status === 'searched') {
      // təsdiqlənmiş aktiv niyyəti zəif "axtarış" siqnalı ilə əvəz etmirik
      const existing = await TripIntent.findOne({ deviceId, status: 'confirmed', expiresAt: { $gt: new Date(now) } }).lean();
      if (existing) return existing;
    }
    const firstBus = itinerary && itinerary.legs.find((l) => l.type === 'bus' && l.routeId);
    const doc = {
      deviceId,
      status,
      origin: { type: 'Point', coordinates: [from.lng, from.lat] },
      destination: { type: 'Point', coordinates: [to.lng, to.lat] },
      originLabel: from.name,
      destinationLabel: to.name,
      board: firstBus
        ? {
            route: firstBus.routeId,
            routeNumber: firstBus.number,
            stopId: firstBus.from.stopId,
            stopName: firstBus.from.name,
            lat: firstBus.from.lat,
            lng: firstBus.from.lng,
          }
        : undefined,
      routes: itinerary ? itinerary.legs.filter((l) => l.type === 'bus' && l.routeId).map((l) => l.routeId) : [],
      departAt: new Date(now + ((firstBus && firstBus.departInSec) || 0) * 1000),
      expiresAt: new Date(now + config.demand.intentTtlMin * 60000),
    };
    const saved = await TripIntent.findOneAndUpdate({ deviceId }, { $set: doc }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
    if (status === 'confirmed' && firstBus) this.checkRoute(firstBus.routeId).catch((e) => console.error('[demand]', e.message));
    this.emit('changed');
    return saved;
  }

  async cancel(deviceId) {
    await TripIntent.updateOne({ deviceId }, { $set: { status: 'cancelled', expiresAt: new Date(Date.now() + 60000) } });
    this.emit('changed');
  }

  activeQuery() {
    const now = Date.now();
    return {
      status: { $in: ['searched', 'confirmed'] },
      expiresAt: { $gt: new Date(now) },
      departAt: { $lte: new Date(now + config.demand.horizonMin * 60000) },
    };
  }

  /** Nöqtə ətrafında (radius) getmək istəyən digər istifadəçilər */
  async nearby({ lat, lng, radiusM = config.demand.defaultRadiusM, excludeDevice }) {
    const q = {
      ...this.activeQuery(),
      origin: { $geoWithin: { $centerSphere: [[lng, lat], radiusM / EARTH_M] } },
    };
    if (excludeDevice) q.deviceId = { $ne: excludeDevice };
    const list = await TripIntent.find(q).lean();
    const byStop = new Map();
    const byDest = new Map();
    for (const it of list) {
      if (it.board && it.board.stopName) {
        const k = `${it.board.routeNumber}|${it.board.stopName}`;
        const cur = byStop.get(k) || { routeNumber: it.board.routeNumber, stopName: it.board.stopName, confirmed: 0, searched: 0 };
        cur[it.status]++;
        byStop.set(k, cur);
      }
      if (it.destinationLabel) byDest.set(it.destinationLabel, (byDest.get(it.destinationLabel) || 0) + 1);
    }
    return {
      radiusM,
      horizonMin: config.demand.horizonMin,
      total: list.length,
      confirmed: list.filter((x) => x.status === 'confirmed').length,
      searched: list.filter((x) => x.status === 'searched').length,
      byStop: [...byStop.values()].sort((a, b) => b.confirmed + b.searched - (a.confirmed + a.searched)),
      topDestinations: [...byDest.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count })),
    };
  }

  /** Operator üçün: dayanacaqlar üzrə gözlənilən minik (növbəti horizonMin dəq) */
  async stops() {
    const list = await TripIntent.find({ ...this.activeQuery(), 'board.stopId': { $exists: true } }).lean();
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
      if (!cur.nextDepartAt || it.departAt < cur.nextDepartAt) cur.nextDepartAt = it.departAt;
      map.set(k, cur);
    }
    const stops = [...map.values()].sort((a, b) => b.confirmed * 2 + b.searched - (a.confirmed * 2 + a.searched));
    return { horizonMin: config.demand.horizonMin, total: list.length, stops };
  }

  /** Proaktiv xəbərdarlıq: xətt üzrə təsdiqlənmiş niyyət sayı həddi keçirsə */
  /** Eyni xətt üçün yoxlamaları ardıcıl icra edir (paralel çağırışlarda dublikat xəbərdarlığın qarşısını alır) */
  checkRoute(routeId) {
    this.locks = this.locks || new Map();
    const id = String(routeId);
    const run = (this.locks.get(id) || Promise.resolve()).then(() => this._checkRoute(id));
    this.locks.set(id, run.catch(() => {}));
    return run;
  }

  async _checkRoute(routeId) {
    const r = this.fleet.getRoute(routeId);
    if (!r) return null;
    const list = await TripIntent.find({ ...this.activeQuery(), status: 'confirmed', 'board.route': routeId }).lean();
    if (list.length < config.demand.alertMinConfirmed) return null;

    const counts = {};
    list.forEach((x) => (counts[x.board.stopName] = (counts[x.board.stopName] || 0) + 1));
    const [topStop, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const stats = { windowMin: config.demand.horizonMin, confirmedIntents: list.length, topStop, topStopCount: topCount };

    const existing = await Alert.findOne({ route: routeId, type: 'DEMAND_FORECAST', status: { $ne: 'resolved' } });
    if (existing) {
      existing.stats = { ...(existing.stats || {}), ...stats };
      await existing.save();
      this.emit('alert:update', await existing.populate('route', 'number name color'));
      return existing;
    }
    const alert = await Alert.create({
      route: routeId,
      type: 'DEMAND_FORECAST',
      message: `${r.route.number} nömrəli xətt: növbəti ${config.demand.horizonMin} dəqiqədə ${list.length} sərnişin «Gedirəm» bildirib (ən çox: ${topStop}) — əlavə avtobus ehtiyatı ayrılmalıdır`,
      stats,
      history: [{ status: 'open', note: 'Proaktiv tələb proqnozu' }],
    });
    const populated = await alert.populate('route', 'number name color');
    console.log(`[demand] YENİ: ${alert.message}`);
    this.emit('alert:new', populated);
    return populated;
  }

  async checkAll() {
    for (const id of this.fleet.routes.keys()) await this.checkRoute(id);
  }

  start() {
    this.timer = setInterval(() => this.checkAll().catch((e) => console.error('[demand]', e.message)), 60000);
  }

  stop() {
    clearInterval(this.timer);
  }
}

module.exports = { Demand };
