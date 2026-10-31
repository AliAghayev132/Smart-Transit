// Services
import { fleetService, demandService } from "#services";

// Utils
import {
  asyncHandler,
  ok,
  i18nError,
  parsePoint,
  isValidLatLng,
  t,
} from "#utils";

/**
 * "Gedirəm" — təsdiqlənmiş səyahət niyyəti (Yanaşma A)
 * POST /api/intents  { deviceId, from, to, itinerary: { legs } }
 */
const confirmIntent = asyncHandler(async (req, res) => {
  const { deviceId, itinerary } = req.body || {};
  if (!deviceId || typeof deviceId !== "string" || deviceId.length > 64)
    throw i18nError(400, "report.deviceRequired");
  const from = parsePoint(req.body.from, "from");
  const to = parsePoint(req.body.to, "to");
  if (itinerary && !Array.isArray(itinerary.legs))
    throw i18nError(400, "intent.invalidLegs");

  // Müştəri mərhələlərindən yalnız lazımi sahələr götürülür
  // stopId yalnız həmin xəttin real dayanacağıdırsa qəbul olunur (obyekt / saxta id bazaya düşməsin)
  const validStop = (routeId, stopId) => {
    const r = routeId && fleetService.getRoute(routeId);
    return r &&
      typeof stopId === "string" &&
      r.route.stops.some((s) => String(s._id) === stopId)
      ? stopId
      : undefined;
  };
  const legs = (itinerary?.legs || []).slice(0, 8).map((l) => ({
    type: l.type === "bus" ? "bus" : "walk",
    routeId:
      l.routeId && fleetService.getRoute(l.routeId) ? String(l.routeId) : null,
    number: l.number ? String(l.number).slice(0, 10) : undefined,
    departInSec: Number(l.departInSec) || 0,
    from:
      l.from && isValidLatLng(Number(l.from.lat), Number(l.from.lng))
        ? {
            stopId: validStop(l.routeId, l.from.stopId),
            name: String(l.from.name || "").slice(0, 120),
            lat: Number(l.from.lat),
            lng: Number(l.from.lng),
          }
        : undefined,
  }));

  const saved = await demandService.upsert({
    deviceId: deviceId.slice(0, 64),
    status: "confirmed",
    from,
    to,
    itinerary: { legs },
  });
  return ok(
    res,
    { expiresAt: saved.expiresAt, board: saved.board },
    t(req.lang, "intent.confirmed"),
    201,
  );
});

/**
 * Niyyəti ləğv et
 * DELETE /api/intents/:deviceId
 */
const cancelIntent = asyncHandler(async (req, res) => {
  await demandService.cancel(req.params.deviceId);
  return ok(res, null, t(req.lang, "intent.cancelled"));
});

export { confirmIntent, cancelIntent };
