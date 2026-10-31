// ============ INTERNAL IMPORTS ============
import { config } from "#config";
import { createApp } from "#core/createApp.js";
import { envProblems } from "#core/envCheck.js";

// Services
import {
  MailService,
  socketService,
  mongoDBService,
  bootstrapAdmin,
  bootstrapOperator,
  startTransit,
  stopTransit,
} from "#services";

// ============ APP INSTANCE ============
const { httpServer } = createApp();

/**
 * Prodakşnda zəif / defolt konfiqurasiya ilə işə düşməyə imkan vermə
 */
const validateEnv = () => {
  if (process.env.NODE_ENV !== "production") return;
  const problems = envProblems(process.env);
  if (problems.length) {
    for (const key of problems)
      console.error(
        `❌ CRITICAL: ${key} is missing or uses a default value in production!`,
      );
    process.exit(1);
  }
  console.log("✅ Environment variables validated");
};

/**
 * Initialize all services
 */
const initializeServices = async () => {
  validateEnv();

  // Connect to the database
  await mongoDBService.connect();

  // Create the default admin / demo operator if none exists
  await bootstrapAdmin();
  await bootstrapOperator();

  // Initialize the mail service
  MailService.init();
};

/**
 * Print startup banner
 */
const printBanner = (port) => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 ${config.siteName} Server                               ║
║                                                              ║
║   Running on port ${port}                                      ║
║   Environment: ${process.env.NODE_ENV || "development"}                             ║
║                                                              ║
║   ✅ Security headers active                                 ║
║   ✅ Rate limiting enabled                                   ║
║   ✅ NoSQL sanitization enabled                              ║
║   ✅ Socket.IO ready                                         ║
║   ✅ Smart Transit engine running                            ║
║                                                              ║
╚════════════════════════════════════════════════════════════╝
  `);
};

// ============ BOOTSTRAP APPLICATION ============

/**
 * Start the application
 */
const startApp = async () => {
  try {
    await initializeServices();

    // Initialize Socket.IO
    socketService.init(httpServer);

    // Smart Transit real-vaxt mühərriki (simulyator, analitika, tələb, canlı lokasiya)
    await startTransit();

    const port = config.development.port;
    httpServer.listen(port, () => printBanner(port));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startApp();

// ============ GRACEFUL SHUTDOWN ============
const shutdown = async (signal) => {
  console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);
  await stopTransit();
  httpServer.close(async () => {
    await mongoDBService.disconnect();
    console.log("✅ Server closed");
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("❌ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
