import { Router } from "#constants";
import {
  planController,
  intentController,
  demandController,
} from "#controllers";
import {
  authenticate,
  requireOperator,
  intentRateLimiter,
  planRateLimiter,
} from "#middlewares";

// Marşrut planlayıcı
const PlanRouter = Router();
PlanRouter.post("/", planRateLimiter, planController.plan);

// Yanaşma A — "Gedirəm" niyyətləri
const IntentRouter = Router();
IntentRouter.post("/", intentRateLimiter, intentController.confirmIntent);
IntentRouter.delete(
  "/:deviceId",
  intentRateLimiter,
  intentController.cancelIntent,
);

// Yanaşma A — tələb
const DemandRouter = Router();
DemandRouter.get("/nearby", demandController.nearby);
DemandRouter.get(
  "/stops",
  authenticate,
  requireOperator,
  demandController.stops,
);

export { PlanRouter, IntentRouter, DemandRouter };
