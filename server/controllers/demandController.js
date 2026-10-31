// Services
import { demandService } from "#services";

// Config
import { config } from "#config";

// Utils
import { asyncHandler, ok, i18nError, isValidLatLng } from "#utils";

/**
 * Nöqtə ətrafında getmək istəyənlər (Yanaşma A)
 * GET /api/demand/nearby?lat=&lng=&radius=500&deviceId=
 */
const nearby = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!isValidLatLng(lat, lng)) throw i18nError(400, "common.invalidLatLng");
  const radiusM = Math.min(
    Math.max(
      Number(req.query.radius) || config.transit.demand.defaultRadiusM,
      50,
    ),
    5000,
  );
  return ok(
    res,
    await demandService.nearby({
      lat,
      lng,
      radiusM,
      excludeDevice: req.query.deviceId,
    }),
  );
});

/**
 * Dayanacaqlar üzrə gözlənilən minik (operator)
 * GET /api/demand/stops?routeId=
 */
const stops = asyncHandler(async (req, res) =>
  ok(res, await demandService.stops(req.query.routeId)),
);

export { nearby, stops };
