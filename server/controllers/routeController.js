// Services
import {
  fleetService,
  analyticsService,
  presenceService,
  EtaService,
} from "#services";

// Utils
import { asyncHandler, ok, i18nError, isValidLatLng } from "#utils";

const routeOr404 = (id) => {
  const r = fleetService.getRoute(id);
  if (!r) throw i18nError(404, "route.notFound");
  return r;
};

/**
 * Bütün xətlər (dayanacaqlar, həndəsə, seqmentlər)
 * GET /api/routes
 */
const listRoutes = asyncHandler(async (req, res) =>
  ok(res, { routes: fleetService.publicRoutes() }),
);

/**
 * Bütün avtobusların canlı mövqeyi
 * GET /api/routes/buses
 */
const listBuses = asyncHandler(async (req, res) =>
  ok(res, { buses: fleetService.snapshot() }),
);

/**
 * Xəttin avtobusları
 * GET /api/routes/:id/buses
 */
const routeBuses = asyncHandler(async (req, res) => {
  routeOr404(req.params.id);
  const buses = fleetService
    .busesForRoute(req.params.id)
    .map((b) => fleetService.publicBus(b));
  return ok(res, { buses });
});

/**
 * Dayanacağa gələn avtobuslar (ETA + sıxlıq + canlı istifadəçi sayı)
 * GET /api/routes/:id/stops/:stopId/eta?limit=4
 */
const stopEta = asyncHandler(async (req, res) => {
  const { route } = routeOr404(req.params.id);
  const idx = route.stops.findIndex((s) => String(s._id) === req.params.stopId);
  if (idx === -1) throw i18nError(404, "route.stopNotFound");
  const crowd = analyticsService.cache;
  // ?limit= — neçə avtobus (standart 4, 1..10); sərnişin UI hər istiqamət üçün 3 göstərir (limit=8)
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit, 10) || 4, 1),
    10,
  );
  const arrivals = EtaService.forStop(
    fleetService,
    req.params.id,
    idx,
    limit,
  ).map((a) => ({
    ...a,
    crowd: crowd?.buses[a.busId] || {
      level: "unknown",
      score: null,
      rawScore: null,
      loadPct: null,
      total: 0,
    },
    liveRiders: presenceService.ridersOn(a.busId),
  }));
  return ok(res, {
    stop: {
      id: req.params.stopId,
      name: route.stops[idx].name,
      liveWaiting: presenceService.waitingAt(req.params.stopId),
    },
    arrivals,
    generatedAt: new Date(),
  });
});

/**
 * Real GPS treker koordinatı (operator/inteqrasiya)
 * POST /api/routes/buses/:busId/location  { lat, lng }
 */
const updateBusLocation = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body || {};
  if (!isValidLatLng(lat, lng)) throw i18nError(400, "common.invalidLatLng");
  const r = fleetService.updateFromGps(req.params.busId, lat, lng);
  if (!r) throw i18nError(404, "route.busNotFound");
  return ok(res, {
    bus: fleetService.publicBus(r.bus),
    offsetFromRouteM: Math.round(r.offsetM),
  });
});

export { listRoutes, listBuses, routeBuses, stopEta, updateBusLocation };
