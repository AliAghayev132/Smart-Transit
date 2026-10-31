// Models
import { DensityReport } from "#models";

// Services
import {
  fleetService,
  analyticsService,
  presenceService,
  demandService,
} from "#services";

// Constants
import { crowdLevels } from "#constants";

// Utils
import { asyncHandler, ok, i18nError } from "#utils";

/**
 * Demo: seçilmiş xətt üçün "high" dalğası (anomaliya testini sürətləndirir)
 * POST /api/demo/surge  { routeId, count?, level? }
 */
const surge = asyncHandler(async (req, res) => {
  const { routeId, count = 5, level = "high" } = req.body || {};
  if (!fleetService.getRoute(routeId)) throw i18nError(404, "route.notFound");
  if (!crowdLevels.includes(level)) throw i18nError(400, "demo.invalidLevel");
  const buses = fleetService.busesForRoute(routeId);
  const now = Date.now();
  const j = () => (Math.random() - 0.5) * 0.0008;
  const docs = Array.from(
    { length: Math.min(Number(count) || 5, 30) },
    (_, i) => {
      const b = buses[i % buses.length];
      return {
        route: routeId,
        bus: b?.id,
        level,
        deviceId: `demo-${now.toString(36)}-${i}`,
        source: "gps",
        verified: true,
        location: b
          ? { type: "Point", coordinates: [b.lng + j(), b.lat + j()] }
          : undefined,
        createdAt: new Date(now - i * 40000),
      };
    },
  );
  await DensityReport.insertMany(docs);
  analyticsService.schedule(routeId);
  return ok(res, { inserted: docs.length });
});

/**
 * Demo: bütün xətlər üzrə təsadüfi bildirişlər
 * POST /api/demo/random  { count? }
 */
const random = asyncHandler(async (req, res) => {
  const count = Math.min(Number(req.body?.count) || 30, 200);
  const all = fleetService.snapshot();
  const now = Date.now();
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const j = () => (Math.random() - 0.5) * 0.001;
  const docs = Array.from({ length: count }, (_, i) => {
    const b = pick(all);
    return {
      route: b.routeId,
      bus: b.id,
      level: pick(["low", "low", "mid", "mid", "high"]),
      deviceId: `rnd-${now.toString(36)}-${i}`,
      source: "gps",
      verified: Math.random() > 0.25,
      location: { type: "Point", coordinates: [b.lng + j(), b.lat + j()] },
      createdAt: new Date(now - Math.random() * 12 * 60000),
    };
  });
  await DensityReport.insertMany(docs);
  analyticsService.schedule();
  return ok(res, { inserted: docs.length });
});

/**
 * Demo: virtual canlı istifadəçilər (Yanaşma B)
 * POST /api/demo/presence  { count? }
 */
const presence = asyncHandler(async (req, res) => {
  const count = Math.min(Number(req.body?.count) || 40, 300);
  presenceService.addSynthetic(count, 3);
  return ok(res, { inserted: count, density: presenceService.compute() });
});

/**
 * Demo: təsadüfi "Gedirəm" niyyətləri (Yanaşma A)
 * POST /api/demo/intents  { routeId?, count? }
 */
const intents = asyncHandler(async (req, res) => {
  const { routeId, count = 20 } = req.body || {};
  const targets = routeId
    ? [fleetService.getRoute(routeId)].filter(Boolean)
    : [...fleetService.routes.values()];
  if (!targets.length) throw i18nError(404, "route.notFound");
  const n = Math.min(Number(count) || 20, 100);
  const j = () => (Math.random() - 0.5) * 0.006;
  for (let i = 0; i < n; i++) {
    const { route } = targets[i % targets.length];
    const bi = Math.floor(Math.random() * (route.stops.length - 1));
    const s = route.stops[bi];
    const t = route.stops[route.stops.length - 1];
    await demandService.upsert({
      deviceId: `demo-int-${Date.now().toString(36)}-${i}`,
      status: Math.random() < 0.75 ? "confirmed" : "searched",
      from: { lat: s.lat + j(), lng: s.lng + j(), name: s.name },
      to: { lat: t.lat, lng: t.lng, name: t.name },
      itinerary: {
        legs: [
          {
            type: "bus",
            routeId: String(route._id),
            number: route.number,
            departInSec: Math.round(Math.random() * 20 * 60),
            from: { stopId: s._id, name: s.name, lat: s.lat, lng: s.lng },
          },
        ],
      },
    });
  }
  for (const { route } of targets)
    await demandService.checkRoute(String(route._id));
  return ok(res, { inserted: n });
});

export { surge, random, presence, intents };
