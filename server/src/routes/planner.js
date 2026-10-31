/**
 * Marşrut planlayıcı + Yanaşma A (proaktiv tələb) API-si
 */
const express = require('express');
const config = require('../config');
const { plan } = require('../services/planner');
const { computeTransit } = require('../services/googleRoutes');
const { httpError, requireOperator, parsePoint, validLatLng } = require('./util');

module.exports = function createPlannerApi({ fleet, analytics, demand }) {
  const router = express.Router();

  /**
   * POST /api/plan
   * { from:{lat,lng,name?}, to:{lat,lng,name?}, prefer?: 'fast'|'comfort', deviceId?, includeGoogle?: true }
   */
  router.post('/plan', async (req, res) => {
    const body = req.body || {};
    const from = parsePoint(body.from, 'from');
    const to = parsePoint(body.to, 'to');
    const prefer = body.prefer === 'comfort' ? 'comfort' : 'fast';

    const crowd = analytics.cache;
    const itineraries = plan(fleet, crowd, from, to, { prefer });
    const google = body.includeGoogle === false ? { enabled: false, itineraries: [] } : await computeTransit(fleet, crowd, from, to);

    // Axtarış = zəif niyyət siqnalı (Yanaşma A)
    const best = itineraries.find((i) => i.legs.some((l) => l.type === 'bus'));
    if (body.deviceId && typeof body.deviceId === 'string') {
      demand
        .upsert({ deviceId: body.deviceId.slice(0, 64), status: 'searched', from, to, itinerary: best })
        .catch((e) => console.error('[demand]', e.message));
    }

    res.json({
      from,
      to,
      prefer,
      generatedAt: new Date(),
      itineraries,
      google: { enabled: google.enabled, error: google.error, itineraries: google.itineraries },
    });
  });

  /** "Gedirəm" — təsdiqlənmiş niyyət */
  router.post('/intents', async (req, res) => {
    const { deviceId, itinerary } = req.body || {};
    if (!deviceId || typeof deviceId !== 'string') throw httpError(400, 'deviceId tələb olunur');
    const from = parsePoint(req.body.from, 'from');
    const to = parsePoint(req.body.to, 'to');
    if (itinerary && !Array.isArray(itinerary.legs)) throw httpError(400, 'itinerary.legs yanlışdır');
    // Müştəridən gələn mərhələlərdən yalnız lazım olan sahələri götürürük
    const legs = (itinerary?.legs || []).slice(0, 8).map((l) => ({
      type: l.type === 'bus' ? 'bus' : 'walk',
      routeId: l.routeId && fleet.getRoute(l.routeId) ? String(l.routeId) : null,
      number: l.number ? String(l.number).slice(0, 10) : undefined,
      departInSec: Number(l.departInSec) || 0,
      from: l.from && validLatLng(Number(l.from.lat), Number(l.from.lng))
        ? { stopId: l.from.stopId, name: String(l.from.name || '').slice(0, 120), lat: Number(l.from.lat), lng: Number(l.from.lng) }
        : undefined,
    }));
    const saved = await demand.upsert({ deviceId: deviceId.slice(0, 64), status: 'confirmed', from, to, itinerary: { legs } });
    res.status(201).json({ ok: true, expiresAt: saved.expiresAt, board: saved.board });
  });

  router.delete('/intents/:deviceId', async (req, res) => {
    await demand.cancel(req.params.deviceId);
    res.json({ ok: true });
  });

  /** Nöqtə ətrafında getmək istəyənlər: /api/demand/nearby?lat=..&lng=..&radius=500&deviceId=.. */
  router.get('/demand/nearby', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!validLatLng(lat, lng)) throw httpError(400, 'lat/lng düzgün deyil');
    const radiusM = Math.min(Math.max(Number(req.query.radius) || config.demand.defaultRadiusM, 50), 5000);
    res.json(await demand.nearby({ lat, lng, radiusM, excludeDevice: req.query.deviceId }));
  });

  /** Operator: dayanacaqlar üzrə gözlənilən minik */
  router.get('/demand/stops', async (_req, res) => {
    res.json(await demand.stops());
  });

  // Demo: təsadüfi "Gedirəm" niyyətləri (proaktiv xəbərdarlığı yoxlamaq üçün)
  if (config.demoEnabled) {
    router.post('/demo/intents', requireOperator, async (req, res) => {
      const { routeId, count = 20 } = req.body || {};
      const targets = routeId ? [fleet.getRoute(routeId)].filter(Boolean) : [...fleet.routes.values()];
      if (!targets.length) throw httpError(404, 'Xətt tapılmadı');
      const n = Math.min(Number(count) || 20, 100);
      const j = () => (Math.random() - 0.5) * 0.006;
      for (let i = 0; i < n; i++) {
        const { route } = targets[i % targets.length];
        const bi = Math.floor(Math.random() * (route.stops.length - 1));
        const s = route.stops[bi];
        const t = route.stops[route.stops.length - 1 - (bi === route.stops.length - 1 ? 1 : 0)];
        await demand.upsert({
          deviceId: `demo-int-${Date.now().toString(36)}-${i}`,
          status: Math.random() < 0.75 ? 'confirmed' : 'searched',
          from: { lat: s.lat + j(), lng: s.lng + j(), name: `${s.name} yaxınlığı` },
          to: { lat: t.lat, lng: t.lng, name: t.name },
          itinerary: {
            legs: [
              {
                type: 'bus',
                routeId: String(route._id),
                number: route.number,
                departInSec: Math.round(Math.random() * 20 * 60),
                from: { stopId: s._id, name: s.name, lat: s.lat, lng: s.lng },
              },
            ],
          },
        });
      }
      for (const { route } of targets) await demand.checkRoute(String(route._id));
      res.json({ ok: true, inserted: n });
    });
  }

  return router;
};
