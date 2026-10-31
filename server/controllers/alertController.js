// Models
import { RouteAlert, DispatchCommand } from "#models";

// Services
import { DispatchService, AssistantService, socketService } from "#services";

// Utils
import { asyncHandler, ok, i18nError, t } from "#utils";

const POPULATE = { path: "route", select: "number name color" };

/**
 * Xəbərdarlıqlar
 * GET /api/alerts?status=active|resolved|open...&routeId=&limit=
 */
const listAlerts = asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.status === "active") q.status = { $ne: "resolved" };
  else if (req.query.status) q.status = req.query.status;
  if (req.query.routeId) q.route = req.query.routeId;
  const limit = Math.min(Number(req.query.limit) || 100, 300);
  const alerts = await RouteAlert.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate(POPULATE)
    .lean();
  return ok(res, { alerts });
});

/**
 * Tək xəbərdarlıq + bağlı dispetçer əmrləri
 * GET /api/alerts/:id
 */
const getAlert = asyncHandler(async (req, res) => {
  const alert = await RouteAlert.findById(req.params.id).populate(POPULATE);
  if (!alert) throw i18nError(404, "alert.notFound");
  const commands = await DispatchCommand.find({ alert: alert._id })
    .sort({ createdAt: -1 })
    .lean();
  return ok(res, { alert, commands });
});

/**
 * AI dəstəkli tövsiyə + hazır əmr mətni (operator təsdiqləyir)
 * GET /api/alerts/:id/recommendation
 */
const getRecommendation = asyncHandler(async (req, res) => {
  const alert = await RouteAlert.findById(req.params.id);
  if (!alert) throw i18nError(404, "alert.notFound");
  const result = await AssistantService.explainRecommendation(
    alert.route,
    req.lang,
  );
  alert.recommendation = result.recommendation;
  await alert.save();
  return ok(res, result);
});

/**
 * Status əməliyyatı
 * PATCH /api/alerts/:id  { action: acknowledge | dispatch | resolve, count?, note? }
 *  - dispatch: tövsiyə olunan (və ya verilən) sayda ehtiyat avtobus + dispetçer əmri
 *  - resolve: ehtiyat avtobuslar geri çağırılır (recallReserve=false ilə saxlanıla bilər)
 */
const alertAction = asyncHandler(async (req, res) => {
  const { action, note, count, recallReserve } = req.body || {};
  const alert = await RouteAlert.findById(req.params.id);
  if (!alert) throw i18nError(404, "alert.notFound");
  if (alert.status === "resolved")
    throw i18nError(409, "alert.alreadyResolved");

  if (action === "acknowledge") {
    alert.transition("acknowledged", note, req.user._id);
  } else if (action === "dispatch") {
    const n = Number(count) || alert.recommendation?.recommendedBuses || 1;
    const { alert: updated } = await DispatchService.issueCommand({
      routeId: alert.route,
      alertId: alert._id,
      type: "RESERVE_RELEASE",
      params: { count: n, stop: alert.recommendation?.suggestedStop?.name },
      source: req.body.source === "ai" ? "ai" : "manual",
      user: req.user,
      lang: req.lang,
    });
    return ok(
      res,
      { alert: updated },
      t(req.lang, "alert.dispatched", { count: n }),
    );
  } else if (action === "resolve") {
    alert.transition("resolved", note, req.user._id);
    if (alert.reserveBuses.length && recallReserve !== false)
      await DispatchService.recallBuses(alert.reserveBuses);
  } else {
    throw i18nError(400, "alert.invalidAction");
  }

  await alert.save();
  const populated = await alert.populate(POPULATE);
  socketService.toOperators("alert:update", populated);
  return ok(res, { alert: populated });
});

export { listAlerts, getAlert, getRecommendation, alertAction };
