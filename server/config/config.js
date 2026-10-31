import { dotenv } from "#lib";

const NODE_ENV = process.env.NODE_ENV || "development";

// Load environment-specific file first (e.g. .env.development), then fall back to .env.
// dotenv does not override already-defined variables, so the first match wins.
dotenv.config({ path: `.env.${NODE_ENV}`, quiet: true });
dotenv.config({ quiet: true });

const isProduction = NODE_ENV === "production";
const num = (v, d) =>
  v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v);
const domain = process.env.DOMAIN || "localhost";

const config = {
  development: {
    port: process.env.PORT || 5000,
    db: {
      host: process.env.DB_HOST || "localhost",
      name: process.env.DB_NAME || "smart_transit",
      username: process.env.DB_USERNAME || "",
      password: process.env.DB_PASSWORD || "",
      clusterName: process.env.DB_CLUSTER_NAME || "",
    },
  },

  // Site
  siteName: "Smart Transit",
  domain,
  appUrl: process.env.APP_URL || "http://localhost:5000",
  clientUrl:
    process.env.CLIENT_URL ||
    (isProduction ? `https://${domain}` : "http://localhost:5173"),

  // Auth secrets (override in production via env)
  accessSecretKey: process.env.ACCESS_SECRET_KEY || "starter_access_secret_key",
  refreshSecretKey:
    process.env.REFRESH_SECRET_KEY || "starter_refresh_secret_key",
  encryptionKey:
    process.env.ENCRYPTION_KEY || "starter_32_char_encryption_key!!",

  // Default admin (created on first boot by BootstrapService)
  defaultAdmin: {
    email: process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com",
    password: process.env.DEFAULT_ADMIN_PASSWORD || "Admin123!",
  },

  // Demo dispetçer hesabı (ilk açılışda yaradılır; boş buraxılsa yaradılmır)
  defaultOperator: {
    email: process.env.DEFAULT_OPERATOR_EMAIL ?? "operator@example.com",
    password: process.env.DEFAULT_OPERATOR_PASSWORD || "Operator123!",
  },

  // Cookie names (prefixed to avoid collisions)
  accessCookieName: "__st_at",
  refreshCookieName: "__st_rt",

  // Cookie options
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    domain: isProduction ? `.${domain}` : undefined,
    path: "/",
  },

  // Token durations (ms)
  accessTokenMaxAge: 15 * 60 * 1000, // 15 minutes
  refreshTokenMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  rememberMeMaxAge: 30 * 24 * 60 * 60 * 1000, // 30 days

  // OTP
  otpExpiresIn: 600, // 10 minutes (seconds)

  // SMTP
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    secure: process.env.SMTP_SECURE === "true",
  },

  // File upload limits/types (used by FileService media helpers + uploadLimit)
  upload: {
    maxImageSize: 30 * 1024 * 1024, // images — 30MB
    maxVideoSize: 100 * 1024 * 1024, // videos — 100MB
    maxDocSize: 100 * 1024 * 1024, // documents — 100MB
    allowedImageTypes: ["image/jpeg", "image/png", "image/webp", "image/jpg"],
    allowedVideoTypes: ["video/mp4", "video/webm", "video/ogg"],
    allowedDocTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
    ],
  },

  // AI (OpenRouter) — optional; AI endpoints degrade gracefully when apiKey is empty
  ai: {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    // Sürətli/ucuz model: operator xülasəsi, chatbot (tool calling dəstəkləməlidir)
    model: process.env.OPENROUTER_MODEL || "google/gemini-3.5-flash",
    // Daha güclü model: dispetçer tövsiyəsinin əsaslandırılması (boşdursa model istifadə olunur)
    reasoningModel: process.env.OPENROUTER_REASONING_MODEL || "",
    timeoutMs: num(process.env.AI_TIMEOUT_MS, 20000),
  },

  // Google Gemini — operator üçün 1–2 saatlıq proqnoz (/api/analytics/predict).
  // Açar boşdursa proqnoz deterministik modellə hazırlanır (source: "rules").
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    // Model tapılmasa (404) bu alias ilə təkrar cəhd olunur
    fallbackModel: process.env.GEMINI_FALLBACK_MODEL ?? "gemini-flash-latest",
    timeoutMs: num(process.env.GEMINI_TIMEOUT_MS, 25000),
    // Eyni proqnoz bu müddət ərzində keşdən verilir (Gemini kvotasını qoruyur)
    cacheSec: num(process.env.PREDICT_CACHE_SEC, 180),
  },

  // Hava (Open-Meteo, açarsız). Proqnoz modelinə yağış/külək/temperatur siqnalı verir.
  weather: {
    enabled: process.env.WEATHER_ENABLED !== "false",
    lat: num(process.env.WEATHER_LAT, 40.4093),
    lng: num(process.env.WEATHER_LNG, 49.8671),
    cacheMin: num(process.env.WEATHER_CACHE_MIN, 10),
    timeoutMs: num(process.env.WEATHER_TIMEOUT_MS, 5000),
  },

  // ============ SMART TRANSIT ============
  transit: {
    // Real GPS lenti olmadıqda avtobusları hərəkət etdirən simulyator
    sim: {
      enabled: process.env.SIM_ENABLED !== "false",
      tickMs: num(process.env.SIM_TICK_MS, 2000),
      avgSpeedKmh: num(process.env.SIM_AVG_SPEED_KMH, 22),
      dwellSec: num(process.env.SIM_DWELL_SEC, 25),
    },
    // Crowdsourcing sıxlıq hesablanması
    crowd: {
      lookbackMin: num(process.env.CROWD_LOOKBACK_MIN, 15),
      halfLifeMin: num(process.env.CROWD_HALF_LIFE_MIN, 5),
      verifyRadiusM: num(process.env.VERIFY_RADIUS_M, 300),
      cooldownSec: num(process.env.REPORT_COOLDOWN_SEC, 60),
      // Göstərilən sıxlıq/sərnişin sayı xam datadan bu qədər % çox (ehtiyat payı); 0 → xam
      displayBoostPct: num(process.env.CROWD_DISPLAY_BOOST_PCT, 20),
    },
    // Anomaliya: son windowMin dəqiqədə ≥minHighReports unikal "high" + ≥minHighRatio pay
    anomaly: {
      windowMin: num(process.env.ANOMALY_WINDOW_MIN, 10),
      minHighReports: num(process.env.ANOMALY_MIN_HIGH, 3),
      minHighRatio: num(process.env.ANOMALY_MIN_RATIO, 0.6),
      checkEverySec: num(process.env.ANOMALY_CHECK_SEC, 20),
      maxDevicesPerSource: num(process.env.ANOMALY_MAX_DEVICES_PER_IP, 2), // Sybil qorunması
    },
    // Marşrut planlayıcı
    planner: {
      maxWalkM: num(process.env.PLANNER_MAX_WALK_M, 1200),
      transferWalkM: num(process.env.PLANNER_TRANSFER_WALK_M, 350),
      walkSpeedMs: 1.25,
      walkDetour: 1.25,
      crowdPenaltyMin: { low: 0, mid: 3, high: 9, unknown: 1 },
    },
    googleRoutesKey: process.env.GOOGLE_ROUTES_API_KEY || "",
    // Yanaşma A — proaktiv tələb
    demand: {
      intentTtlMin: num(process.env.DEMAND_INTENT_TTL_MIN, 45),
      defaultRadiusM: num(process.env.DEMAND_RADIUS_M, 500),
      horizonMin: num(process.env.DEMAND_HORIZON_MIN, 30),
      alertMinConfirmed: num(process.env.DEMAND_ALERT_MIN, 15),
    },
    // Yanaşma B — canlı lokasiya (yalnız yaddaşda)
    presence: {
      ttlSec: num(process.env.PRESENCE_TTL_SEC, 90),
      cellDeg: num(process.env.PRESENCE_CELL_DEG, 0.0015),
      minCellCount: num(process.env.PRESENCE_MIN_CELL, 1),
      stopRadiusM: num(process.env.PRESENCE_STOP_RADIUS_M, 70),
      busRadiusM: num(process.env.PRESENCE_BUS_RADIUS_M, 60),
      broadcastSec: num(process.env.PRESENCE_BROADCAST_SEC, 5),
      snapshotSec: num(process.env.PRESENCE_SNAPSHOT_SEC, 60),
    },
    // Dispetçer tövsiyə modeli
    dispatch: {
      busCapacity: num(process.env.BUS_CAPACITY, 100), // nəfər (standart avtobus)
      targetLoad: num(process.env.TARGET_LOAD, 0.85), // hədəf doluluq
      maxReservePerAlert: num(process.env.MAX_RESERVE_PER_ALERT, 3),
    },
    // Demo alətləri (saxta bildiriş / anomaliya) — defolt olaraq yalnız development-də
    demoEnabled: process.env.DEMO_ENABLED
      ? process.env.DEMO_ENABLED === "true"
      : !isProduction,
  },
};

// CORS whitelist
const corsConfig = {
  origin: isProduction
    ? [
        process.env.CLIENT_URL,
        `https://www.${domain}`,
        `https://${domain}`,
      ].filter(Boolean)
    : [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        process.env.CLIENT_URL,
      ].filter(Boolean),
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Authorization", "Content-Type", "Accept-Language"],
  credentials: true,
};

// Extra security-related knobs
const securityConfig = {
  // Session timeout hint (15 minutes)
  sessionTimeout: 15 * 60 * 1000,
  // Max request/upload payload size
  maxPayloadSize: "10mb", // fayl yükləmələri (express-fileupload)
  // JSON / form sorğuları — API-də ən böyük gövdə (chatbot) ~10 KB-dır; böyük gövdə DoS vektorudur
  jsonPayloadSize: process.env.JSON_PAYLOAD_LIMIT || "100kb",
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

export { config, corsConfig, securityConfig };
