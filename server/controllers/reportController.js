// Models
import { DensityReport } from "#models";

// Services
import {
  fleetService,
  analyticsService,
  GeoService,
  socketService,
} from "#services";

// Config + constants
import { config } from "#config";
import { crowdLevels } from "#constants";

// Utils
import { asyncHandler, ok, i18nError, isValidLatLng, t, hashIp } from "#utils";

const publicReport = (r) => ({
  id: String(r._id),
  routeId: String(r.route),
  busId: r.bus ? String(r.bus) : null,
  level: r.level,
  lat: r.location?.coordinates ? r.location.coordinates[1] : null,
  lng: r.location?.coordinates ? r.location.coordinates[0] : null,
  source: r.source,
  verified: r.verified,
  createdAt: r.createdAt,
});

/**
 * Sərnişin sıxlıq bildirişi (crowdsourcing)
 * POST /api/reports  { routeId, busId?, stopId?, level, lat?, lng?, deviceId }
 */
const createReport = asyncHandler(async (req, res) => {
  const { routeId, busId, stopId, level, lat, lng, deviceId } = req.body || {};
  if (!crowdLevels.includes(level)) {
    return res
      .status(400)
      .json({ success: false, message: t(req.lang, "report.invalidLevel") });
  }
  if (!deviceId || typeof deviceId !== "string" || deviceId.length > 64) {
    return res
      .status(400)
      .json({ success: false, message: t(req.lang, "report.deviceRequired") });
  }
  const r = fleetService.getRoute(routeId);
  if (!r) throw i18nError(404, "route.notFound");
  const { route, geom } = r;
  const { crowd } = config.transit;

  let bus = null;
  if (busId) {
    bus = fleetService.buses.get(String(busId));
    if (!bus || bus.routeId !== String(routeId))
      throw i18nError(400, "route.busWrongRoute");
  }

  // Spam qorunması: eyni cihaz + eyni xətt üçün cooldown
  const since = new Date(Date.now() - crowd.cooldownSec * 1000);
  const recent = await DensityReport.findOne({
    deviceId,
    route: routeId,
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .lean();
  if (recent) {
    const retryAfter = Math.ceil(
      (new Date(recent.createdAt).getTime() +
        crowd.cooldownSec * 1000 -
        Date.now()) /
        1000,
    );
    return res.status(429).json({
      success: false,
      code: "REPORT_COOLDOWN",
      message: t(req.lang, "report.cooldown", { seconds: retryAfter }),
      data: { retryAfter },
    });
  }

  const doc = {
    route: routeId,
    level,
    deviceId,
    ipHash: hashIp(req.ip),
    source: "none",
    verified: false,
  };
  if (bus) doc.bus = bus.id;
  const stop = stopId
    ? route.stops.find((s) => String(s._id) === String(stopId))
    : null;
  if (stop) doc.stopId = stop._id;

  if (isValidLatLng(lat, lng)) {
    doc.source = "gps";
    doc.location = { type: "Point", coordinates: [lng, lat] };
    if (bus) {
      doc.distanceToBusM = Math.round(
        GeoService.haversine([lat, lng], [bus.lat, bus.lng]),
      );
      doc.verified = doc.distanceToBusM <= crowd.verifyRadiusM;
    } else {
      doc.verified =
        GeoService.project(geom, lat, lng).offset <= crowd.verifyRadiusM;
    }
  } else if (bus) {
    doc.source = "bus";
    doc.location = { type: "Point", coordinates: [bus.lng, bus.lat] };
  } else if (stop) {
    doc.source = "stop";
    doc.location = { type: "Point", coordinates: [stop.lng, stop.lat] };
  }

  const report = await DensityReport.create(doc);
  const out = publicReport(report.toObject());
  socketService.broadcast("report:new", out);
  analyticsService.schedule(routeId);

  return ok(
    res,
    { report: out },
    t(
      req.lang,
      doc.verified ? "report.thanksVerified" : "report.thanksUnverified",
    ),
    201,
  );
});

/**
 * Son bildirişlər (operator kontekst paneli)
 * GET /api/reports/recent?routeId=&limit=
 */
const recentReports = asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.routeId) q.route = req.query.routeId;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const list = await DensityReport.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return ok(res, { reports: list.map(publicReport) });
});

export { createReport, recentReports, publicReport };
