import { Router } from "#constants";
import { demoController } from "#controllers";
import { authenticate, requireOperator } from "#middlewares";

// Test/demo alətləri — yalnız DEMO_ENABLED=true olduqda app.js-də qoşulur
const DemoRouter = Router();

DemoRouter.use(authenticate, requireOperator);

DemoRouter.post("/surge", demoController.surge);
DemoRouter.post("/random", demoController.random);
DemoRouter.post("/presence", demoController.presence);
DemoRouter.post("/intents", demoController.intents);

export { DemoRouter };
