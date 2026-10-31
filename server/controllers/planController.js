// Services
import {
  fleetService,
  analyticsService,
  demandService,
  PlannerService,
  GoogleRoutesService,
} from "#services";

// Utils
import { asyncHandler, ok, parsePoint } from "#utils";

/**
 * Haradan → Haraya marşrut variantları (+ isteğe bağlı Google Routes)
 * POST /api/plan  { from:{lat,lng,name}, to:{...}, prefer?: fast|comfort, deviceId?, includeGoogle? }
 */
const plan = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const from = parsePoint(body.from, "from");
  const to = parsePoint(body.to, "to");
  const prefer = body.prefer === "comfort" ? "comfort" : "fast";
  const crowd = analyticsService.cache;

  const itineraries = PlannerService.plan(fleetService, crowd, from, to, {
    prefer,
  });
  const google =
    body.includeGoogle === false
      ? { enabled: false, itineraries: [] }
      : await GoogleRoutesService.computeTransit(fleetService, crowd, from, to);

  // Axtarış = zəif niyyət siqnalı (Yanaşma A)
  if (typeof body.deviceId === "string" && body.deviceId) {
    const best = itineraries.find((i) => i.legs.some((l) => l.type === "bus"));
    demandService
      .upsert({
        deviceId: body.deviceId.slice(0, 64),
        status: "searched",
        from,
        to,
        itinerary: best,
      })
      .catch((e) => console.error("❌ Demand:", e.message));
  }

  return ok(res, {
    from,
    to,
    prefer,
    generatedAt: new Date(),
    itineraries,
    google,
  });
});

export { plan };
