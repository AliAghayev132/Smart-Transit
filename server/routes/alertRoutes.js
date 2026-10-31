import { Router } from "#constants";
import { alertController } from "#controllers";
import { authenticate, requireOperator, writeRateLimiter } from "#middlewares";

const AlertRouter = Router();

// Bütün xəbərdarlıq marşrutları operator/admin üçündür
AlertRouter.use(authenticate, requireOperator);

AlertRouter.get("/", alertController.listAlerts);
AlertRouter.get("/:id", alertController.getAlert);
AlertRouter.get("/:id/recommendation", alertController.getRecommendation);
AlertRouter.patch("/:id", writeRateLimiter, alertController.alertAction);

export { AlertRouter };
