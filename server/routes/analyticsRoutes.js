import { Router } from "#constants";
import { analyticsController } from "#controllers";
import { authenticate, requireOperator, aiRateLimiter } from "#middlewares";

const AnalyticsRouter = Router();

// Public (sərnişin xəritəsi də istifadə edir)
AnalyticsRouter.get("/crowd", analyticsController.crowd);

// Operator
AnalyticsRouter.get(
  "/heat",
  authenticate,
  requireOperator,
  analyticsController.heat,
);
AnalyticsRouter.get(
  "/forecast",
  authenticate,
  requireOperator,
  analyticsController.forecastAll,
);
AnalyticsRouter.get(
  "/forecast/:routeId",
  authenticate,
  requireOperator,
  analyticsController.forecast,
);
AnalyticsRouter.get(
  "/timeseries",
  authenticate,
  requireOperator,
  analyticsController.timeseries,
);

// Gemini AI proqnozu (operator; AI limiti tətbiq olunur)
AnalyticsRouter.get(
  "/predict",
  authenticate,
  requireOperator,
  aiRateLimiter,
  analyticsController.predict,
);

export { AnalyticsRouter };
