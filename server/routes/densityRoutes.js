import { Router } from "#constants";
import { densityController } from "#controllers";
import { authenticate, requireOperator } from "#middlewares";

// Yanaşma B — canlı lokasiya sıxlığı (mövqelər Socket.IO "presence:update" ilə gəlir)
const DensityRouter = Router();

DensityRouter.get("/live", densityController.live);
DensityRouter.get(
  "/history",
  authenticate,
  requireOperator,
  densityController.history,
);

export { DensityRouter };
