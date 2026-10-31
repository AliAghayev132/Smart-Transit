/**
 * Express tətbiqinin qurulması (testlər üçün ayrıca): təhlükəsizlik, middleware, route-lar, xəta emalı.
 * Prosesin işə salınması (DB, Socket.IO, simulyator, listen) — app.js.
 */
// ============ EXTERNAL PACKAGES ============
import { http, cors, helmet, express, fileUpload, compression } from "#lib";

// ============ INTERNAL IMPORTS ============
import { config, corsConfig, securityConfig } from "#config";

// Services
import {
  fleetService,
  mongoDBService,
  AIService,
  GoogleRoutesService,
} from "#services";

// Middlewares
import {
  noCookies,
  detectLang,
  apiRateLimiter,
  securityHeaders,
  sanitizeInput,
} from "#middlewares";

// Utils
import { t } from "#utils";

// Routes
import {
  AuthRouter,
  AIRouter,
  RouteRouter,
  ReportRouter,
  AnalyticsRouter,
  AlertRouter,
  PlanRouter,
  IntentRouter,
  DemandRouter,
  DensityRouter,
  DispatchRouter,
  DemoRouter,
} from "#routes";

// ============ SETUP FUNCTIONS ============

/**
 * Configure security middlewares
 */
const setupSecurity = (app) => {
  // Helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:", "http://localhost:*"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // Custom security headers
  app.use(securityHeaders);

  // Only allow essential/httpOnly cookies
  app.use(noCookies);
};

/**
 * Configure general middlewares
 */
const setupMiddlewares = (app) => {
  // Gzip compression
  app.use(compression());

  // CORS
  app.use(cors(corsConfig));

  // Sorğunun dili (req.lang): ?lang= → Accept-Language → az
  app.use(detectLang);

  // File upload (must be before body parsers to handle multipart/form-data).
  // The global ceiling is the largest allowed media type (video); each media
  // route then enforces its own smaller limit via the uploadLimit middleware.
  app.use(
    fileUpload({
      limits: { fileSize: config.upload.maxVideoSize },
      abortOnLimit: true,
      responseOnLimit: "File size limit exceeded",
    }),
  );

  // Body parsers
  app.use(express.json({ limit: securityConfig.jsonPayloadSize }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: securityConfig.jsonPayloadSize,
    }),
  );

  // NoSQL injection sanitization
  app.use(sanitizeInput);

  // Rate limiting for the API
  app.use("/api", apiRateLimiter);

  // Static files (uploads)
  app.use("/uploads", express.static("uploads"));
};

/**
 * Configure API routes
 */
const setupRoutes = (app) => {
  app.use("/api/auth", AuthRouter);
  app.use("/api/ai", AIRouter);

  // Smart Transit
  app.use("/api/routes", RouteRouter);
  app.use("/api/reports", ReportRouter);
  app.use("/api/analytics", AnalyticsRouter);
  app.use("/api/alerts", AlertRouter);
  app.use("/api/plan", PlanRouter);
  app.use("/api/intents", IntentRouter);
  app.use("/api/demand", DemandRouter);
  app.use("/api/density", DensityRouter);
  app.use("/api/dispatch", DispatchRouter);
  if (config.transit.demoEnabled) app.use("/api/demo", DemoRouter);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      success: true,
      message: "Server is running",
      timestamp: new Date().toISOString(),
      data: {
        db: mongoDBService.getConnectionStatus().isConnected
          ? "connected"
          : "disconnected",
        routes: fleetService.routes.size,
        buses: fleetService.buses.size,
        simulator: config.transit.sim.enabled,
        demo: config.transit.demoEnabled,
        ai: AIService.enabled,
        googleRoutes: GoogleRoutesService.enabled,
        anomalyRule: config.transit.anomaly,
        demandRule: config.transit.demand,
      },
    });
  });
};

/**
 * Configure error handlers
 */
const setupErrorHandlers = (app) => {
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: t(req.lang, "common.endpointNotFound"),
    });
  });

  // Central error handler
  app.use((err, req, res, _next) => {
    // Yalnız gözlənilməz (5xx) xətalar loqa yazılır — 4xx istifadəçi səhvləridir
    if (!err.statusCode || err.statusCode >= 500)
      console.error("Server error:", err.stack || err.message || err);

    // Mongoose validation error
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: t(req.lang, "common.validation"),
        errors: Object.values(err.errors).map((e) => e.message),
      });
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: t(req.lang, "common.duplicate"),
      });
    }

    // JWT errors
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: t(req.lang, "common.sessionExpired"),
      });
    }

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message:
        statusCode === 500
          ? t(req.lang, "common.serverError")
          : err.i18n
            ? t(req.lang, err.i18n.key, err.i18n.params)
            : err.message,
      ...(err.publicCode ? { code: err.publicCode } : {}),
    });
  });
};

/**
 * Tətbiq yarat (listen etmir).
 * @returns {{ app: import("express").Express, httpServer: import("http").Server }}
 */
const createApp = () => {
  const app = express();
  const httpServer = http.createServer(app);
  // Trust reverse proxy (nginx) - required for rate limiting behind a proxy
  app.set("trust proxy", 1);
  setupSecurity(app);
  setupMiddlewares(app);
  setupRoutes(app);
  setupErrorHandlers(app);
  return { app, httpServer };
};

export { createApp };
