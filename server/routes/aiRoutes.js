import { Router } from "#constants";
import { aiController } from "#controllers";
import { authenticate, requireOperator, aiRateLimiter } from "#middlewares";

const AIRouter = Router();

// Public
AIRouter.get("/status", aiController.status);
// Sərnişin chatbot-u (public, rate limited; AI açarı yoxdursa qayda əsaslı cavab)
AIRouter.post("/chat", aiRateLimiter, aiController.chat);

// Operator
AIRouter.get(
  "/summary/:routeId",
  authenticate,
  requireOperator,
  aiRateLimiter,
  aiController.routeSummary,
);
AIRouter.get(
  "/dispatch/:routeId",
  authenticate,
  requireOperator,
  aiRateLimiter,
  aiController.dispatchAdvice,
);

export { AIRouter };
