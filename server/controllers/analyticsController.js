// Models
import { DensityReport } from "#models";

// Services
import {
  analyticsService,
  fleetService,
  ForecastService,
  PredictionService,
} from "#services";

// Config
import { config } from "#config";

// Utils
import { asyncHandler, ok, i18nError } from "#utils";

// Controllers
import { publicReport } from "./reportController.js";

/**
 * Xətt / avtobus / seqment üzrə sıxlıq
 * GET /api/analytics/crowd
 */
const crowd = asyncHandler(async (req, res) => {
  return ok(
    res,
    analyticsService.cache || (await analyticsService.recompute()),
  );
});

/**
 * Sıxlıq xəritəsi üçün son bildiriş nöqtələri
 * GET /api/analytics/heat?minutes=15
 */
const heat = asyncHandler(async (req, res) => {
  const min = Math.min(
    Number(req.query.minutes) || config.transit.crowd.lookbackMin,
    120,
  );
  const list = await DensityReport.find({
    createdAt: { $gte: new Date(Date.now() - min * 60000) },
    "location.coordinates": { $exists: true },
  })
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();
  return ok(res, { points: list.map(publicReport) });
});

/**
 * Xətt üzrə proqnoz (növbəti saatlar)
 * GET /api/analytics/forecast/:routeId?hours=4
 */
const forecast = asyncHandler(async (req, res) => {
  if (!fleetService.getRoute(req.params.routeId))
    throw i18nError(404, "route.notFound");
  const live = analyticsService.routeCrowd(req.params.routeId);
  const hours = Math.min(Number(req.query.hours) || 4, 12);
  return ok(
    res,
    await ForecastService.forRoute(req.params.routeId, {
      hours,
      liveScore: live?.rawScore ?? null,
    }),
  );
});

/**
 * Bütün xətlər üzrə proqnoz (Xətlər səhifəsi)
 * GET /api/analytics/forecast
 */
const forecastAll = asyncHandler(async (req, res) => {
  const out = [];
  for (const [routeId, { route }] of fleetService.routes) {
    const live = analyticsService.routeCrowd(routeId);
    const f = await ForecastService.forRoute(routeId, {
      hours: 3,
      liveScore: live?.rawScore ?? null,
    });
    out.push({ routeId, number: route.number, ...f });
  }
  return ok(res, { routes: out });
});

/**
 * Hesabatlar: zaman seriyası
 * GET /api/analytics/timeseries?hours=6&bucket=15&routeId=
 */
const timeseries = asyncHandler(async (req, res) => {
  const hours = Math.min(Number(req.query.hours) || 6, 72);
  const bucketMin = Math.min(Math.max(Number(req.query.bucket) || 15, 5), 120);
  return ok(
    res,
    await ForecastService.timeseries({
      hours,
      bucketMin,
      routeId: req.query.routeId,
    }),
  );
});

/**
 * Gemini AI proqnozu: növbəti 1–2 saatda sıxlıq sıçrayışları + avtobus yerdəyişməsi
 * GET /api/analytics/predict?refresh=1
 * Gemini açarı yoxdursa və ya xəta verərsə deterministik baza modeli (source: "rules").
 */
const predict = asyncHandler(async (req, res) => {
  return ok(
    res,
    await PredictionService.predict({
      lang: req.lang,
      refresh: req.query.refresh === "1" || req.query.refresh === "true",
    }),
  );
});

export { crowd, heat, forecast, forecastAll, timeseries, predict };
