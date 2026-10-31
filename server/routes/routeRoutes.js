import { Router } from "#constants";
import { routeController } from "#controllers";
import { authenticate, requireOperator } from "#middlewares";

const RouteRouter = Router();

// Public
RouteRouter.get("/", routeController.listRoutes);
// "/buses" "/:id"-dən əvvəl qeyd olunmalıdır
RouteRouter.get("/buses", routeController.listBuses);
RouteRouter.get("/:id/buses", routeController.routeBuses);
RouteRouter.get("/:id/stops/:stopId/eta", routeController.stopEta);

// Real GPS treker inteqrasiyası (operator/admin tokeni ilə)
RouteRouter.post(
  "/buses/:busId/location",
  authenticate,
  requireOperator,
  routeController.updateBusLocation,
);

export { RouteRouter };
