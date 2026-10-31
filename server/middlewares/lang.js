import { pickLang } from "#utils";

/**
 * Sorğunun dili: ?lang=az|en|ru  →  Accept-Language  →  az.
 * req.lang bütün controller və middleware-lərdə t(req.lang, key) üçün istifadə olunur.
 */
const detectLang = (req, res, next) => {
  const q = typeof req.query?.lang === "string" ? req.query.lang : "";
  req.lang = pickLang(q || req.headers["accept-language"]);
  res.setHeader("Content-Language", req.lang);
  res.vary("Accept-Language");
  next();
};

export { detectLang };
