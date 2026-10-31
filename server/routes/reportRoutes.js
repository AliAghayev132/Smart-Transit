import { Router } from "#constants";
import { reportController } from "#controllers";
import { authenticate, requireOperator, reportRateLimiter } from "#middlewares";

const ReportRouter = Router();

// Public — sərnişin crowdsourcing bildirişi
ReportRouter.post("/", reportRateLimiter, reportController.createReport);

// Operator
ReportRouter.get(
  "/recent",
  authenticate,
  requireOperator,
  reportController.recentReports,
);

export { ReportRouter };
