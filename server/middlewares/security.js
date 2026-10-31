import { rateLimit } from "#lib";
import { t } from "#utils";

/** Limit mesajı sorğunun dilində (req.lang — middlewares/lang.js) */
const limitMessage = (key) => (req) => ({
  success: false,
  message: t(req.lang, key),
});

/**
 * Rate limiter for general API requests.
 */
const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: limitMessage("common.rateLimit"),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter limiter for login attempts (brute-force protection).
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: limitMessage("common.loginRateLimit"),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Generic limiter for write operations (create/update/delete).
 */
const writeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 writes per window
  message: limitMessage("common.writeRateLimit"),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Crowdsourcing bildirişləri üçün limit (spam qorunması; cihaz üzrə cooldown ayrıca var).
 */
const reportRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
  message: limitMessage("report.rateLimit"),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * «Gedirəm» niyyətləri — proqnoz xəbərdarlığını tetiklədiyi üçün sıx limit.
 */
const intentRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: limitMessage("common.rateLimit"),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Marşrut planlayıcı — CPU baxımından ağır sorğu.
 */
const planRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: limitMessage("common.rateLimit"),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * AI endpoint-ləri üçün limit (xərc qorunması).
 */
const aiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 15,
  message: limitMessage("ai.rateLimit"),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Extra hardening headers (Helmet covers most; these are belt-and-braces).
 */
const securityHeaders = (req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.removeHeader("X-Powered-By");
  next();
};

/**
 * Only allow essential/httpOnly cookies to be set (privacy by default).
 */
const noCookies = (req, res, next) => {
  const originalCookie = res.cookie.bind(res);
  res.cookie = function (name, value, options) {
    if (options && (options.essential || options.httpOnly)) {
      return originalCookie(name, value, options);
    }
    return this;
  };
  next();
};

export {
  apiRateLimiter,
  loginRateLimiter,
  writeRateLimiter,
  reportRateLimiter,
  aiRateLimiter,
  intentRateLimiter,
  planRateLimiter,
  securityHeaders,
  noCookies,
};
