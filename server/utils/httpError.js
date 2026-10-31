import { t, DEFAULT_LANG } from "./i18n.js";

/**
 * HTTP xətası yaradır — mərkəzi error handler `statusCode`-u oxuyur (app.js).
 * Servislərdən atılır, controller-də try/catch lazım deyil (asyncHandler).
 *
 *   throw httpError(404, "Xətt tapılmadı");
 */
const httpError = (statusCode, message, extra = {}) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
};

/**
 * Tərcümə olunan HTTP xətası: mesaj sorğunun dilində qaytarılır (app.js error handler → t(req.lang, key)).
 *
 *   throw i18nError(404, "route.notFound");
 */
const i18nError = (statusCode, key, params = {}, extra = {}) =>
  httpError(statusCode, t(DEFAULT_LANG, key, params), {
    ...extra,
    i18n: { key, params },
  });

export { httpError, i18nError };
