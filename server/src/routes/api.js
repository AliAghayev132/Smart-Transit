const express = require('express');
const mongoose = require('mongoose');
const Report = require('../models/Report');
const Alert = require('../models/Alert');
const Bus = require('../models/Bus');
const config = require('../config');
const { etaForStop } = require('../services/eta');
const { haversine, project, pointAt, segmentPaths } = require('../services/geo');

const LEVELS = ['low', 'mid', 'high'];
const { validLatLng, httpError, requireOperator } = require('./util');

module.exports = function createApi({ fleet, analytics, presence, io }) {
  const router = express.Router();

  const routeOr404 = (id) => {
    const r = fleet.getRoute(id);
    if (!r) throw httpError(404, 'Xətt tapılmadı');
    return r;
  };

  // ───────────── Ümumi ─────────────
  router.get('/health', (_req, res) =>
    res.json({
      ok: true,
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      routes: fleet.routes.size,
      buses: fleet.buses.size,
      simulator: config.sim.enabled,
      operatorKeyRequired: !!config.operatorKey,
      demo: config.demoEnabled,
      anomalyRule: config.anomaly,
      demandRule: config.demand,
      googleRoutes: !!config.googleRoutesKey,
    })
  );

  // ───────────── Sərnişin modulu ─────────────
  router.get('/routes', (_req, res) => {
    const list = [...fleet.routes.values()].map(({ route, geom }) => ({
      id: String(route._id),
      number: route.number,
      name: route.name,
      color: route.color,
      lengthKm: Math.round(geom.length / 100) / 10,
      stops: route.stops.map((s) => ({ id: String(s._id), name: s.name, lat: s.lat, lng: s.lng })),
      path: geom.points,
      segmentPaths: segmentPaths(geom),
    }));
    list.sort((a, b) => a.number.localeCompare(b.number, 'az', { numeric: true }));
    res.json(list);
  });

  router.get('/routes/:id/buses', (req, res) => {
    routeOr404(req.params.id);
    res.json(fleet.busesForRoute(req.params.id).map((b) => fleet.publicBus(b)));
  });

  router.get('/buses', (_req, res) => res.json(fleet.snapshot()));

  router.get('/routes/:id/stops/:stopId/eta', (req, res) => {
    const { route } = routeOr404(req.params.id);
    const idx = route.stops.findIndex((s) => String(s._id) === req.params.stopId);
    if (idx === -1) throw httpError(404, 'Dayanacaq tapılmadı');
    const crowd = analytics.cache;
    const arrivals = etaForStop(fleet, req.params.id, idx, 4).map((a) => ({
      ...a,
      crowd: (crowd && crowd.buses[a.busId]) || { level: 'unknown', total: 0 },
      liveRiders: presence ? presence.ridersOn(a.busId) : 0, // canlı lokasiya paylaşan istifadəçilər
    }));
    res.json({
      stop: { id: req.params.stopId, name: route.stops[idx].name, liveWaiting: presence ? presence.waitingAt(req.params.stopId) : 0 },
      arrivals,
      generatedAt: new Date(),
    });
  });

  // Sərnişin sıxlıq bildirişi
  router.post('/reports', async (req, res) => {
    const { routeId, busId, stopId, level, lat, lng, deviceId } = req.body || {};
    if (!LEVELS.includes(level)) throw httpError(400, 'Sıxlıq səviyyəsi low | mid | high olmalıdır');
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 64) throw httpError(400, 'deviceId tələb olunur');
    const { route, geom } = routeOr404(routeId);

    let bus = null;
    if (busId) {
      bus = fleet.buses.get(String(busId));
      if (!bus || bus.routeId !== String(routeId)) throw httpError(400, 'Avtobus bu xəttə aid deyil');
    }

    // Spam qorunması: eyni cihazdan eyni xətt üçün qısa müddətdə təkrar bildiriş
    const since = new Date(Date.now() - config.crowd.cooldownSec * 1000);
    const recent = await Report.findOne({ deviceId, route: routeId, createdAt: { $gte: since } }).sort({ createdAt: -1 }).lean();
    if (recent) {
      const retryAfter = Math.ceil((new Date(recent.createdAt).getTime() + config.crowd.cooldownSec * 1000 - Date.now()) / 1000);
      throw httpError(429, `Bu xətt üçün bildirişi ${retryAfter} saniyə sonra təkrar göndərə bilərsiniz`, { retryAfter });
    }

    const doc = { route: routeId, level, deviceId, source: 'none', verified: false };
    if (bus) doc.bus = bus.id;
    const stop = stopId ? route.stops.find((s) => String(s._id) === String(stopId)) : null;
    if (stop) doc.stopId = stop._id;

    if (validLatLng(lat, lng)) {
      doc.source = 'gps';
      doc.location = { type: 'Point', coordinates: [lng, lat] };
      if (bus) {
        doc.distanceToBusM = Math.round(haversine([lat, lng], [bus.lat, bus.lng]));
        doc.verified = doc.distanceToBusM <= config.crowd.verifyRadiusM;
      } else {
        doc.verified = project(geom, lat, lng).offset <= config.crowd.verifyRadiusM;
      }
    } else if (bus) {
      doc.source = 'bus';
      doc.location = { type: 'Point', coordinates: [bus.lng, bus.lat] };
    } else if (stop) {
      doc.source = 'stop';
      doc.location = { type: 'Point', coordinates: [stop.lng, stop.lat] };
    }

    const report = await Report.create(doc);
    const out = publicReport(report.toObject());
    io.emit('report:new', out);
    analytics.schedule(routeId);
    res.status(201).json({
      ok: true,
      report: out,
      message: doc.verified
        ? 'Təşəkkürlər! Bildirişiniz GPS ilə təsdiqləndi.'
        : 'Təşəkkürlər! Bildiriş qəbul edildi (GPS təsdiqi olmadan — daha az çəki ilə nəzərə alınır).',
    });
  });

  router.get('/reports/recent', async (req, res) => {
    const q = {};
    if (req.query.routeId) q.route = req.query.routeId;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const list = await Report.find(q).sort({ createdAt: -1 }).limit(limit).lean();
    res.json(list.map(publicReport));
  });

  // ───────────── Operator modulu / Analitika ─────────────
  router.get('/analytics/crowd', async (_req, res) => {
    res.json(analytics.cache || (await analytics.recompute()));
  });

  // Sıxlıq xəritəsi üçün son bildiriş nöqtələri
  router.get('/analytics/heat', async (req, res) => {
    const min = Math.min(Number(req.query.minutes) || config.crowd.lookbackMin, 120);
    const list = await Report.find({
      createdAt: { $gte: new Date(Date.now() - min * 60000) },
      'location.coordinates': { $exists: true },
    })
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    res.json(list.map(publicReport));
  });

  router.get('/alerts', async (req, res) => {
    const q = {};
    if (req.query.status === 'active') q.status = { $ne: 'resolved' };
    else if (req.query.status) q.status = req.query.status;
    const list = await Alert.find(q).sort({ createdAt: -1 }).limit(100).populate('route', 'number name color').lean();
    res.json(list);
  });

  router.patch('/alerts/:id', requireOperator, async (req, res) => {
    const { action, note } = req.body || {};
    const alert = await Alert.findById(req.params.id);
    if (!alert) throw httpError(404, 'Xəbərdarlıq tapılmadı');
    if (alert.status === 'resolved') throw httpError(409, 'Xəbərdarlıq artıq bağlanıb');

    if (action === 'acknowledge') {
      alert.status = 'acknowledged';
    } else if (action === 'dispatch') {
      if (alert.reserveBus) throw httpError(409, 'Bu xəbərdarlıq üçün ehtiyat avtobus artıq ayrılıb');
      const bus = await createReserveBus(alert.route);
      alert.reserveBus = bus.id;
      alert.status = 'dispatched';
    } else if (action === 'resolve') {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      if (alert.reserveBus && req.body.recallReserve !== false) await recallBus(alert.reserveBus);
    } else {
      throw httpError(400, 'action: acknowledge | dispatch | resolve');
    }
    alert.history.push({ status: alert.status, note });
    await alert.save();
    const populated = await alert.populate('route', 'number name color');
    io.emit('alert:update', populated);
    res.json(populated);
  });

  async function createReserveBus(routeId) {
    const { route, geom } = routeOr404(routeId);
    // Ehtiyat avtobus ən sıx seqmentin başlanğıcından xəttə çıxır
    let distance = 0;
    const crowd = analytics.cache && analytics.cache.routes.find((r) => r.routeId === String(routeId));
    if (crowd) {
      const rank = { high: 3, mid: 2, low: 1, unknown: 0 };
      const worst = [...crowd.segments].sort((a, b) => rank[b.level] - rank[a.level] || (b.score || 0) - (a.score || 0))[0];
      if (worst && worst.level !== 'unknown') distance = geom.stopDist[worst.index];
    }
    const n = (await Bus.countDocuments({ route: routeId, isReserve: true })) + 1;
    const [lat, lng] = pointAt(geom, distance);
    const doc = await Bus.create({
      route: routeId,
      plate: `EHT-${route.number}-${String(n).padStart(2, '0')}-${Date.now().toString(36).slice(-3).toUpperCase()}`,
      distance,
      direction: 1,
      lat,
      lng,
      isReserve: true,
    });
    const state = fleet.addBus(doc.toObject());
    io.emit('buses:update', fleet.snapshot());
    console.log(`[dispatch] Ehtiyat avtobus ${doc.plate} → xətt ${route.number}`);
    return state;
  }

  async function recallBus(busId) {
    await Bus.updateOne({ _id: busId }, { active: false });
    fleet.buses.delete(String(busId));
    io.emit('buses:update', fleet.snapshot());
  }

  // Real GPS cihazlarından koordinat qəbulu (avtobus trekerləri üçün)
  router.post('/buses/:id/location', requireOperator, (req, res) => {
    const { lat, lng } = req.body || {};
    if (!validLatLng(lat, lng)) throw httpError(400, 'lat/lng düzgün deyil');
    const r = fleet.updateFromGps(req.params.id, lat, lng);
    if (!r) throw httpError(404, 'Avtobus tapılmadı');
    res.json({ ok: true, bus: fleet.publicBus(r.bus), offsetFromRouteM: Math.round(r.offsetM) });
  });

  // ───────────── Demo / test alətləri ─────────────
  if (config.demoEnabled) {
    // Seçilmiş xətt üçün qısa müddətdə çoxlu "Yüksək" bildiriş — anomaliya testini sürətləndirir
    router.post('/demo/surge', requireOperator, async (req, res) => {
      const { routeId, count = 5, level = 'high' } = req.body || {};
      routeOr404(routeId);
      if (!LEVELS.includes(level)) throw httpError(400, 'level yanlışdır');
      const buses = fleet.busesForRoute(routeId);
      const now = Date.now();
      const docs = Array.from({ length: Math.min(Number(count) || 5, 30) }, (_, i) => {
        const b = buses[i % buses.length];
        const jitter = () => (Math.random() - 0.5) * 0.0008;
        return {
          route: routeId,
          bus: b && b.id,
          level,
          deviceId: `demo-${now.toString(36)}-${i}`,
          source: 'gps',
          verified: true,
          location: b ? { type: 'Point', coordinates: [b.lng + jitter(), b.lat + jitter()] } : undefined,
          createdAt: new Date(now - i * 40000),
        };
      });
      await Report.insertMany(docs);
      analytics.schedule(routeId);
      res.json({ ok: true, inserted: docs.length });
    });

    // Bütün xətlər üzrə təsadüfi bildirişlər (xəritəni canlandırmaq üçün)
    router.post('/demo/random', requireOperator, async (req, res) => {
      const count = Math.min(Number((req.body || {}).count) || 30, 200);
      const all = fleet.snapshot();
      const now = Date.now();
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      const docs = Array.from({ length: count }, (_, i) => {
        const b = pick(all);
        const level = pick(['low', 'low', 'mid', 'mid', 'high']);
        const j = () => (Math.random() - 0.5) * 0.001;
        return {
          route: b.routeId,
          bus: b.id,
          level,
          deviceId: `rnd-${now.toString(36)}-${i}`,
          source: 'gps',
          verified: Math.random() > 0.25,
          location: { type: 'Point', coordinates: [b.lng + j(), b.lat + j()] },
          createdAt: new Date(now - Math.random() * 12 * 60000),
        };
      });
      await Report.insertMany(docs);
      analytics.schedule();
      res.json({ ok: true, inserted: docs.length });
    });
  }

  return router;
};

function publicReport(r) {
  return {
    id: String(r._id),
    routeId: String(r.route),
    busId: r.bus ? String(r.bus) : null,
    level: r.level,
    lat: r.location && r.location.coordinates ? r.location.coordinates[1] : null,
    lng: r.location && r.location.coordinates ? r.location.coordinates[0] : null,
    source: r.source,
    verified: r.verified,
    createdAt: r.createdAt,
  };
}
