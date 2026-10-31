import { config } from "#config";
import { Route, Bus } from "#models";
import { GeoService } from "#services/GeoService.js";
import socketService from "#services/SocketService.js";

const EXTERNAL_HOLD_MS = 60 * 1000;

/**
 * FleetService (singleton)
 * Avtobusların real-vaxt vəziyyəti (yaddaşda) + simulyator + real GPS qəbulu.
 *
 * Real GPS cihazı koordinat göndərdikdə (updateFromGps) həmin avtobus 60 san
 * simulyatordan çıxarılır və yalnız real mövqe ilə yenilənir.
 */
class FleetService {
  constructor() {
    this.routes = new Map(); // routeId -> { route, geom }
    this.buses = new Map(); // busId -> state
    this.timer = null;
    this.tickCount = 0;
  }

  get sim() {
    return config.transit.sim;
  }

  async load() {
    const routes = await Route.findActive();
    this.routes.clear();
    for (const r of routes) {
      this.routes.set(String(r._id), {
        route: r,
        geom: GeoService.buildGeometry(r),
      });
    }
    const buses = await Bus.find({ active: true }).lean();
    this.buses.clear();
    for (const b of buses) this.addBus(b);
    console.log(
      `🚌 Fleet: ${this.routes.size} xətt, ${this.buses.size} avtobus yükləndi`,
    );
  }

  addBus(doc) {
    const routeId = String(doc.route);
    const r = this.routes.get(routeId);
    if (!r) return null;
    const distance = Math.min(Math.max(doc.distance || 0, 0), r.geom.length);
    const [lat, lng] = GeoService.pointAt(r.geom, distance);
    const state = {
      id: String(doc._id),
      routeId,
      plate: doc.plate,
      isReserve: !!doc.isReserve,
      distance,
      direction: doc.direction === -1 ? -1 : 1,
      speed: (this.sim.avgSpeedKmh / 3.6) * (0.8 + Math.random() * 0.4), // m/s
      dwellUntil: 0,
      externalUntil: 0,
      lat,
      lng,
      lastUpdate: Date.now(),
    };
    this.buses.set(state.id, state);
    return state;
  }

  removeBus(busId) {
    this.buses.delete(String(busId));
  }

  getRoute(routeId) {
    return this.routes.get(String(routeId));
  }

  findRouteByNumber(number) {
    for (const r of this.routes.values())
      if (r.route.number === String(number)) return r;
    return null;
  }

  busesForRoute(routeId) {
    const id = String(routeId);
    return [...this.buses.values()].filter((b) => b.routeId === id);
  }

  /** Avtobusun istiqamətdəki növbəti dayanacağının indeksi */
  nextStopIndex(bus, geom) {
    const sd = geom.stopDist;
    if (bus.direction === 1) {
      for (let i = 0; i < sd.length; i++)
        if (sd[i] > bus.distance + 0.5) return i;
    } else {
      for (let i = sd.length - 1; i >= 0; i--)
        if (sd[i] < bus.distance - 0.5) return i;
    }
    return -1;
  }

  step(bus, dtSec, now) {
    if (!this.sim.enabled) return;
    if (now < bus.externalUntil) return; // real GPS ilə idarə olunur
    if (now < bus.dwellUntil) return; // dayanacaqda gözləyir
    const { geom } = this.routes.get(bus.routeId);
    let move = bus.speed * dtSec;

    while (move > 0) {
      const next = this.nextStopIndex(bus, geom);
      if (next === -1) {
        bus.direction *= -1; // son dayanacaq — geri dön
        bus.dwellUntil = now + this.sim.dwellSec * 2000;
        break;
      }
      const target = geom.stopDist[next];
      const gap = Math.abs(target - bus.distance);
      if (move >= gap) {
        bus.distance = target;
        bus.dwellUntil =
          now + this.sim.dwellSec * 1000 * (0.6 + Math.random() * 0.8);
        break;
      }
      bus.distance += move * bus.direction;
      move = 0;
    }
    [bus.lat, bus.lng] = GeoService.pointAt(geom, bus.distance);
    bus.lastUpdate = now;
  }

  tick() {
    const now = Date.now();
    const dt = this.sim.tickMs / 1000;
    for (const bus of this.buses.values()) this.step(bus, dt, now);
    this.tickCount++;
    socketService.broadcast("buses:update", this.snapshot(), {
      volatile: true,
    });
    if (this.tickCount % 5 === 0) {
      this.persist().catch((e) =>
        console.error("❌ Fleet persist:", e.message),
      );
    }
  }

  /** Real GPS koordinatı ilə yeniləmə */
  updateFromGps(busId, lat, lng) {
    const bus = this.buses.get(String(busId));
    if (!bus) return null;
    const { geom } = this.routes.get(bus.routeId);
    const p = GeoService.project(geom, lat, lng);
    if (Math.abs(p.distance - bus.distance) > 1) {
      bus.direction = p.distance >= bus.distance ? 1 : -1;
    }
    // Real GPS sürəti (yol boyu məsafə / vaxt, EMA ilə hamarlanmış) — tıxac göstəricisi üçün
    const dtSec = (Date.now() - bus.lastUpdate) / 1000;
    if (bus.externalUntil > Date.now() && dtSec >= 3 && dtSec <= 120) {
      const kmh = (Math.abs(p.distance - bus.distance) / dtSec) * 3.6;
      if (kmh < 90) {
        bus.gpsSpeedKmh =
          bus.gpsSpeedKmh == null ? kmh : bus.gpsSpeedKmh * 0.7 + kmh * 0.3;
      }
    }
    Object.assign(bus, {
      distance: p.distance,
      lat,
      lng,
      externalUntil: Date.now() + EXTERNAL_HOLD_MS,
      lastUpdate: Date.now(),
    });
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
      headsign:
        b.direction === 1 ? stops[stops.length - 1].name : stops[0].name,
      nextStop: nextIdx >= 0 ? stops[nextIdx].name : null,
      atStop: Date.now() < b.dwellUntil,
      isReserve: b.isReserve,
      gps: Date.now() < b.externalUntil ? "real" : "sim",
      lastUpdate: b.lastUpdate,
    };
  }

  /** Real GPS göndərən avtobusların orta sürəti (tıxac göstəricisi); GPS yoxdursa null */
  gpsTraffic() {
    const now = Date.now();
    const speeds = [...this.buses.values()]
      .filter((b) => b.externalUntil > now && b.gpsSpeedKmh != null)
      .map((b) => b.gpsSpeedKmh);
    if (!speeds.length) return null;
    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    return { buses: speeds.length, avgSpeedKmh: Math.round(avg * 10) / 10 };
  }

  snapshot() {
    return [...this.buses.values()].map((b) => this.publicBus(b));
  }

  /** Xətlərin müştəriyə göndərilən forması */
  publicRoutes() {
    return [...this.routes.values()]
      .map(({ route, geom }) => ({
        id: String(route._id),
        number: route.number,
        name: route.name,
        color: route.color,
        lengthKm: Math.round(geom.length / 100) / 10,
        stops: route.stops.map((s) => ({
          id: String(s._id),
          name: s.name,
          lat: s.lat,
          lng: s.lng,
        })),
        path: geom.points,
        segmentPaths: GeoService.segmentPaths(geom),
      }))
      .sort((a, b) =>
        a.number.localeCompare(b.number, "az", { numeric: true }),
      );
  }

  async persist() {
    const ops = [...this.buses.values()].map((b) => ({
      updateOne: {
        filter: { _id: b.id },
        update: {
          $set: {
            lat: b.lat,
            lng: b.lng,
            distance: b.distance,
            direction: b.direction,
            lastUpdate: new Date(b.lastUpdate),
          },
        },
      },
    }));
    if (ops.length) await Bus.bulkWrite(ops, { ordered: false });
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.sim.tickMs);
  }

  async stop() {
    clearInterval(this.timer);
    this.timer = null;
    await this.persist().catch(() => {});
  }
}

const fleetService = new FleetService();

export { FleetService, fleetService };
