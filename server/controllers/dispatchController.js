// Models
import { DispatchCommand } from "#models";

// Services
import { DispatchService, fleetService } from "#services";

// Constants
import { dispatchCommandTypes } from "#constants";

// Utils
import { asyncHandler, ok, i18nError, t } from "#utils";

const MAX_TEXT = 1000;
const MAX_PARAM = 120;

/** Şablon parametrləri: yalnız sadə dəyərlər, qısa sətirlər (əmr mətni və socket yayımı üçün) */
const cleanParams = (params) => {
  if (!params || typeof params !== "object" || Array.isArray(params)) return {};
  const out = {};
  for (const [k, v] of Object.entries(params).slice(0, 10)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, MAX_PARAM);
  }
  return out;
};

/**
 * Dispetçer əmri şablonları
 * GET /api/dispatch/templates
 */
const templates = asyncHandler(async (req, res) =>
  ok(res, { templates: DispatchService.templates(req.lang) }),
);

/**
 * Xətt üzrə qayda əsaslı tövsiyə (AI-siz, sürətli)
 * GET /api/dispatch/recommend/:routeId
 */
const recommend = asyncHandler(async (req, res) => {
  if (!fleetService.getRoute(req.params.routeId))
    throw i18nError(404, "route.notFound");
  return ok(res, await DispatchService.recommend(req.params.routeId));
});

/**
 * Əmrlər jurnalı
 * GET /api/dispatch/commands?routeId=&limit=
 */
const listCommands = asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.routeId) q.route = req.query.routeId;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const commands = await DispatchCommand.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate([
      { path: "route", select: "number name color" },
      { path: "issuedBy", select: "firstName lastName" },
    ])
    .lean();
  return ok(res, { commands });
});

/**
 * Əmrin önizləməsi (şablon + parametrlər → mətn)
 * POST /api/dispatch/preview  { routeId, type, params }
 */
const preview = asyncHandler(async (req, res) => {
  const { routeId, type, params } = req.body || {};
  const r = fleetService.getRoute(routeId);
  if (!r) throw i18nError(404, "route.notFound");
  return ok(res, {
    text: DispatchService.fillTemplate(
      type,
      cleanParams(params),
      r.route,
      req.lang,
    ),
  });
});

/**
 * Əmr ver
 * POST /api/dispatch/commands  { routeId, alertId?, type, params?, text?, source? }
 */
const createCommand = asyncHandler(async (req, res) => {
  const { routeId, alertId, type, params, text, source } = req.body || {};
  if (!dispatchCommandTypes.includes(type))
    throw i18nError(400, "dispatch.unknownType");
  if (text != null && (typeof text !== "string" || text.length > MAX_TEXT))
    throw i18nError(400, "dispatch.textTooLong", { max: MAX_TEXT });
  const result = await DispatchService.issueCommand({
    routeId,
    alertId,
    type,
    params: cleanParams(params),
    text,
    source: source === "ai" ? "ai" : "manual",
    user: req.user,
    lang: req.lang,
  });
  return ok(res, result, t(req.lang, "dispatch.sent"), 201);
});

export { templates, recommend, listCommands, preview, createCommand };
