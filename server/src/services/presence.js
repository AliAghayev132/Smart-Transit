/**
 * Yanaşma B — Canlı lokasiya əsasında real-vaxt sıxlıq.
 *
 * İstifadəçi açıq razılıq verdikdə brauzer hər ~10 saniyədən bir mövqeyini Socket.IO ilə göndərir.
 * Mövqelər YALNIZ yaddaşda saxlanılır (açar = socket id, cihaz/şəxs identifikatoru yoxdur),
 * ttlSec ərzində yenilənməyən mövqe silinir. Buradan hesablanır:
 *  - şəbəkə xanaları üzrə istifadəçi sayı (heatmap),
 *  - dayanacaqda gözləyənlər (dayanacağa yaxın + hərəkətsiz),
 *  - avtobusdakı istifadəçilər (avtobusa yaxın).
 * Bazaya yalnız dəqiqəlik anonim aqreqat (DensitySnapshot) yazılır.
 */
const { EventEmitter } = require('events');
const DensitySnapshot = require('../models/DensitySnapshot');
const config = require('../config');
const { haversine } = require('./geo');

const MIN_INTERVAL_MS = 3000; // bir mənbədən ən tez yeniləmə

class Presence extends EventEmitter {
  constructor(fleet) {
    super();
    this.fleet = fleet;
    this.users = new Map();
    this.last = { at: new Date().toISOString(), total: 0, cells: [], stops: [], buses: [], cellDeg: config.presence.cellDeg };
    this.timers = [];
  }

  update(key, p) {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
    if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return false;
    const now = Date.now();
    const prev = this.users.get(key);
    if (prev && !prev.synthetic && now - prev.ts < MIN_INTERVAL_MS) return false;
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
    const ttl = config.presence.ttlSec * 1000;
    for (const [k, u] of this.users) {
      if (u.synthetic ? now > u.until : now - u.ts > ttl) this.users.delete(k);
    }
  }

  /** Demo: virtual istifadəçilər (bir hissəsi avtobusda, bir hissəsi dayanacaqda gözləyir) */
  addSynthetic(count = 40, minutes = 3) {
    const buses = [...this.fleet.buses.values()];
    const stops = [...this.fleet.routes.values()].flatMap((r) => r.route.stops);
    const until = Date.now() + minutes * 60000;
    const j = () => (Math.random() - 0.5) * 0.0006;
    for (let i = 0; i < count; i++) {
      const key = `syn-${Date.now().toString(36)}-${i}`;
      if (Math.random() < 0.55 && buses.length) {
        const b = buses[Math.floor(Math.random() * buses.length)];
        this.users.set(key, { synthetic: true, until, followBus: b.id, dLat: j() / 3, dLng: j() / 3, lat: b.lat, lng: b.lng, ts: Date.now() });
      } else if (stops.length) {
        const s = stops[Math.floor(Math.random() * stops.length)];
        this.users.set(key, { synthetic: true, until, lat: s.lat + j() / 2, lng: s.lng + j() / 2, speed: 0, ts: Date.now() });
      }
    }
    return count;
  }

  compute() {
    const now = Date.now();
    this.prune(now);
    const cfg = config.presence;

    // Fiziki dayanacaqlar (bir neçə xəttdə eyni dayanacaq ola bilər)
    const stopMap = new Map();
    for (const { route } of this.fleet.routes.values()) {
      for (const s of route.stops) {
        const key = `${s.name}|${s.lat.toFixed(3)}|${s.lng.toFixed(3)}`;
        const cur = stopMap.get(key) || { key, stopIds: [], name: s.name, lat: s.lat, lng: s.lng, routes: [], waiting: 0 };
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

      // avtobusda?
      let onBus = null;
      let bestM = cfg.busRadiusM;
      for (const b of buses) {
        const m = haversine([u.lat, u.lng], [b.lat, b.lng]);
        if (m <= bestM) {
          bestM = m;
          onBus = b;
        }
      }
      if (onBus) {
        riders.set(onBus.id, (riders.get(onBus.id) || 0) + 1);
        continue;
      }
      // dayanacaqda gözləyir? (sürət bilinmirsə və ya < 1.5 m/s)
      if (u.speed != null && u.speed > 1.5) continue;
      let nearStop = null;
      let bestS = cfg.stopRadiusM;
      for (const s of stops) {
        const m = haversine([u.lat, u.lng], [s.lat, s.lng]);
        if (m <= bestS) {
          bestS = m;
          nearStop = s;
        }
      }
      if (nearStop) nearStop.waiting++;
    }

    const cellList = [...cells.entries()]
      .filter(([, n]) => n >= cfg.minCellCount)
      .map(([k, count]) => {
        const [a, b] = k.split(':').map(Number);
        return { lat: (a + 0.5) * cfg.cellDeg, lng: (b + 0.5) * cfg.cellDeg, count };
      });

    this.last = {
      at: new Date(now).toISOString(),
      total: this.users.size,
      cellDeg: cfg.cellDeg,
      cells: cellList,
      stops: stops
        .filter((s) => s.waiting > 0)
        .map(({ key, stopIds, name, lat, lng, routes, waiting }) => ({ key, stopIds, name, lat, lng, routes, waiting }))
        .sort((a, b) => b.waiting - a.waiting),
      buses: [...riders.entries()]
        .map(([busId, n]) => {
          const b = this.fleet.buses.get(busId);
          const r = b && this.fleet.getRoute(b.routeId);
          return { busId, routeId: b && b.routeId, routeNumber: r && r.route.number, plate: b && b.plate, riders: n };
        })
        .sort((a, b) => b.riders - a.riders),
    };
    return this.last;
  }

  /** Dayanacaq üçün canlı gözləyən sayı (sərnişin ekranı üçün) */
  waitingAt(stopId) {
    const s = this.last.stops.find((x) => x.stopIds.includes(String(stopId)));
    return s ? s.waiting : 0;
  }

  ridersOn(busId) {
    const b = this.last.buses.find((x) => x.busId === String(busId));
    return b ? b.riders : 0;
  }

  async snapshot() {
    const l = this.last;
    if (!l.total) return;
    await DensitySnapshot.create({
      at: new Date(l.at),
      total: l.total,
      cellDeg: l.cellDeg,
      cells: l.cells,
      stops: l.stops.map((s) => ({ stopId: s.stopIds[0], name: s.name, waiting: s.waiting })),
      buses: l.buses.map((b) => ({ busId: b.busId, routeNumber: b.routeNumber, riders: b.riders })),
    });
  }

  start() {
    this.timers.push(setInterval(() => this.emit('density', this.compute()), config.presence.broadcastSec * 1000));
    this.timers.push(
      setInterval(() => this.snapshot().catch((e) => console.error('[presence]', e.message)), config.presence.snapshotSec * 1000)
    );
  }

  stop() {
    this.timers.forEach(clearInterval);
  }
}

module.exports = { Presence };
