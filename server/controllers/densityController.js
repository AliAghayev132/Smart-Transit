// Models
import { DensitySnapshot } from "#models";

// Services
import { presenceService } from "#services";

// Utils
import { asyncHandler, ok } from "#utils";

/**
 * Canlı sıxlıq (Yanaşma B): xanalar, gözləyənlər, avtobusdakılar
 * GET /api/density/live
 */
const live = asyncHandler(async (req, res) => ok(res, presenceService.last));

/**
 * Anonim aqreqat tarixçəsi
 * GET /api/density/history?minutes=60
 */
const history = asyncHandler(async (req, res) => {
  const minutes = Math.min(Number(req.query.minutes) || 60, 24 * 60);
  const list = await DensitySnapshot.find({
    at: { $gte: new Date(Date.now() - minutes * 60000) },
  })
    .sort({ at: 1 })
    .lean();
  return ok(res, {
    snapshots: list.map((s) => ({
      at: s.at,
      total: s.total,
      stops: s.stops,
      buses: s.buses,
    })),
  });
});

export { live, history };
