// Services
import {
  AssistantService,
  AIService,
  GeminiService,
  fleetService,
} from "#services";

// Utils
import { asyncHandler, ok, i18nError, t } from "#utils";

/**
 * AI statusu (UI-da "AI aktiv / qaydalar" göstəricisi)
 * GET /api/ai/status
 */
const status = asyncHandler(async (req, res) =>
  ok(res, {
    enabled: AIService.enabled,
    model: AIService.enabled ? AIService.model : null,
    // Operator proqnozu (/api/analytics/predict)
    gemini: {
      enabled: GeminiService.enabled,
      model: GeminiService.enabled ? GeminiService.model : null,
    },
  }),
);

/**
 * Operator: xətt üzrə qısa AI xülasəsi (kontekst paneli)
 * GET /api/ai/summary/:routeId
 */
const routeSummary = asyncHandler(async (req, res) => {
  if (!fleetService.getRoute(req.params.routeId))
    throw i18nError(404, "route.notFound");
  return ok(
    res,
    await AssistantService.routeSummary(req.params.routeId, req.lang),
  );
});

/**
 * Operator: tövsiyənin AI izahı + hazır dispetçer əmri
 * GET /api/ai/dispatch/:routeId
 */
const dispatchAdvice = asyncHandler(async (req, res) => {
  if (!fleetService.getRoute(req.params.routeId))
    throw i18nError(404, "route.notFound");
  return ok(
    res,
    await AssistantService.explainRecommendation(req.params.routeId, req.lang),
  );
});

/**
 * Sərnişin: Transit Chatbot (public, rate limited)
 * POST /api/ai/chat  { messages: [{ role, content }] }
 */
const chat = asyncHandler(async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return res
      .status(400)
      .json({ success: false, message: t(req.lang, "ai.messagesRequired") });
  }
  return ok(res, await AssistantService.chat(messages, req.lang));
});

export { status, routeSummary, dispatchAdvice, chat };
