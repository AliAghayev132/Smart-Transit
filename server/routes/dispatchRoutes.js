import { Router } from "#constants";
import { dispatchController } from "#controllers";
import { authenticate, requireOperator, writeRateLimiter } from "#middlewares";

const DispatchRouter = Router();

DispatchRouter.use(authenticate, requireOperator);

DispatchRouter.get("/templates", dispatchController.templates);
DispatchRouter.get("/recommend/:routeId", dispatchController.recommend);
DispatchRouter.get("/commands", dispatchController.listCommands);
DispatchRouter.post("/preview", dispatchController.preview);
DispatchRouter.post(
  "/commands",
  writeRateLimiter,
  dispatchController.createCommand,
);

export { DispatchRouter };
