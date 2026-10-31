/**
 * Fleet — avtobusların real-vaxt vəziyyəti (yaddaşda) + simulyator.
 *
 * Real GPS cihazları POST /api/buses/:id/location ilə koordinat göndərə bilər;
 * belə avtobus 60 saniyə ərzində simulyatordan çıxarılır və yalnız real GPS ilə yenilənir.
 */
const { EventEmitter } = require('events');
const Route = require('../models/Route');
const Bus = require('../models/Bus');
const { buildGeometry, pointAt, project } = require('./geo');
const config = require('../config');

const EXTERNAL_HOLD_MS = 60 * 1000;

class Fleet extends EventEmitter {
  constructor() {
    super();
    this.routes = new Map(); // routeId -> { route, geom }
    this.buses = new Map(); // busId -> state
    this.timer = null;
    this.tickCount = 0;
  }

  async load() {
    const routes = await Route.find({ active: true }).lean();
    this.routes.clear();
    for (const r of routes) this.routes.set(String(r._id), { route: r, geom: buildGeometry(r) });

    const buses = await Bus.find({ active: true }).lean();
    this.buses.clear();
    for (const b of buses) this.addBus(b);
    console.log(`[fleet] ${this.routes.size} xətt, ${this.buses.size} avtobus yükləndi`);
  }

  addBus(doc) {
    const routeId = String(doc.route);
    const r = this.routes.get(routeId);
    if (!r) return null;
    const baseSpeed = config.sim.avgSpeedKmh / 3.6;
    const distance = Math.min(Math.max(doc.distance || 0, 0), r.geom.length);
    const [lat, lng] = pointAt(r.geom, distance);
    const state = {
      id: String(doc._id),
      routeId,
      plate: doc.plate,
      isReserve: !!doc.isReserve,
      distance,
      direction: doc.direction === -1 ? -1 : 1,
      speed: baseSpeed * (0.8 + Math.random() * 0.4), // m/s
      dwellUntil: 0,
      externalUntil: 0,
      lat,
      lng,
      lastUpdate: Date.now(),
    };
    this.buses.set(state.id, state);
    return state;
  }

  getRoute(routeId) {
    return this.routes.get(String(routeId));
  }

  busesForRoute(routeId) {
    const id = String(routeId);
    return [...this.buses.values()].filter((b) => b.routeId === id);
  }

  /** Avtobusun istiqamətdəki növbəti dayanacağının indeksi */
  nextStopIndex(bus, geom) {
    const sd = geom.stopDist;
    if (bus.direction === 1) {
      for (let i = 0; i < sd.length; i++) if (sd[i] > bus.distance + 0.5) return i;
    } else {
      for (let i = sd.length - 1; i >= 0; i--) if (sd[i] < bus.distance - 0.5) return i;
    }
    return -1;
  }

  step(bus, dtSec, now) {
    if (!config.sim.enabled) return;
    if (now < bus.externalUntil) return; // real GPS ilə idarə olunur
    if (now < bus.dwellUntil) return; // dayanacaqda gözləyir
    const { geom } = this.routes.get(bus.routeId);
    let move = bus.speed * dtSec;

    while (move > 0) {
      const next = this.nextStopIndex(bus, geom);
      if (next === -1) {
        // son dayanacaq — istiqaməti dəyiş, bir az uzun gözlə
        bus.direction *= -1;
        bus.dwellUntil = now + config.sim.dwellSec * 2000;
        break;
      }
      const target = geom.stopDist[next];
      const gap = Math.abs(target - bus.distance);
      if (move >= gap) {
        bus.distance = target;
        bus.dwellUntil = now + config.sim.dwellSec * 1000 * (0.6 + Math.random() * 0.8);
        break;
      }
      bus.distance += move * bus.direction;
      move = 0;
    }
    const [lat, lng] = pointAt(geom, bus.distance);
    bus.lat = lat;
    bus.lng = lng;
    bus.lastUpdate = now;
  }

  tick() {
    const now = Date.now();
    const dt = config.sim.tickMs / 1000;
    for (const bus of this.buses.values()) this.step(bus, dt, now);
    this.tickCount++;
    this.emit('tick', this.snapshot());
    if (this.tickCount % 5 === 0) this.persist().catch((e) => console.error('[fleet] persist', e.message));
  }

  /** Real GPS koordinatı ilə yeniləmə */
  updateFromGps(busId, lat, lng) {
    const bus = this.buses.get(String(busId));
    if (!bus) return null;
    const { geom } = this.routes.get(bus.routeId);
    const p = project(geom, lat, lng);
    if (Math.abs(p.distance - bus.distance) > 1) bus.direction = p.distance >= bus.distance ? 1 : -1;
    bus.distance = p.distance;
    bus.lat = lat;
    bus.lng = lng;
    bus.externalUntil = Date.now() + EXTERNAL_HOLD_MS;
    bus.lastUpdate = Date.now();
    return { bus, offsetM: p.offset };
  }

  publicBus(b) {
    const r = this.routes.get(b.routeId);
    const stops = r.route.stops;
    const nextIdx = this.nextStopIndex(b, r.geom);
    return {
      id: b.id,
      routeId: b.routeId,
      plate: b.plate,
      lat: b.lat,
      lng: b.lng,
      direction: b.direction,
      headsign: b.direction === 1 ? stops[stops.length - 1].name : stops[0].name,
      nextStop: nextIdx >= 0 ? stops[nextIdx].name : null,
      atStop: Date.now() < b.dwellUntil,
      isReserve: b.isReserve,
      gps: Date.now() < b.externalUntil ? 'real' : 'sim',
      lastUpdate: b.lastUpdate,
    };
  }

  snapshot() {
    return [...this.buses.values()].map((b) => this.publicBus(b));
  }

  async persist() {
    const ops = [...this.buses.values()].map((b) => ({
      updateOne: {
        filter: { _id: b.id },
        update: {
          $set: { lat: b.lat, lng: b.lng, distance: b.distance, direction: b.direction, lastUpdate: new Date(b.lastUpdate) },
        },
      },
    }));
    if (ops.length) await Bus.bulkWrite(ops, { ordered: false });
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), config.sim.tickMs);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = new Fleet();
module.exports.Fleet = Fleet;
