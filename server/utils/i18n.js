import { locales } from "#locales";

/**
 * Server tərəfi i18n (kitabxanasız): AZ (əsas) / EN / RU.
 *
 *   t(req.lang, "report.cooldown", { seconds: 30 })
 *
 * - Açar nöqtə ilə: "alert.note.auto_crowd"
 * - Yer tutucu: {name}
 * - Cəm: dəyər obyekt olarsa { one, few, many, other } və params.count rəqəmdirsə
 *   Intl.PluralRules ilə forma seçilir.
 * - Fallback: istənilən dil → az → açarın özü.
 */
const SUPPORTED_LANGS = ["az", "en", "ru"];
const DEFAULT_LANG = "az";

const pluralRules = Object.fromEntries(
  SUPPORTED_LANGS.map((l) => [l, new Intl.PluralRules(l)]),
);

/** "?lang=ru" dəyəri və ya "ru-RU,ru;q=0.9,en;q=0.8" başlığı → dəstəklənən dil */
const pickLang = (input) => {
  if (!input || typeof input !== "string") return DEFAULT_LANG;
  const ranked = input
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return {
        lang: tag.trim().toLowerCase().split("-")[0],
        q: q ? Number(q.split("=")[1]) || 0 : 1,
        i,
      };
    })
    .filter((x) => x.lang)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  return (
    ranked.find((x) => SUPPORTED_LANGS.includes(x.lang))?.lang || DEFAULT_LANG
  );
};

const lookup = (dict, key) =>
  key
    .split(".")
    .reduce((node, k) => (node == null ? undefined : node[k]), dict);

const interpolate = (str, params) =>
  str.replace(/\{(\w+)\}/g, (m, k) =>
    params[k] !== undefined && params[k] !== null ? String(params[k]) : m,
  );

const resolve = (lang, key, params) => {
  const value = lookup(locales[lang], key);
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof params.count === "number") {
    const form = pluralRules[lang].select(params.count);
    return value[form] ?? value.other;
  }
  return typeof value === "object" ? value.other : undefined;
};

const t = (lang, key, params = {}) => {
  const l = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const str =
    resolve(l, key, params) ??
    (l !== DEFAULT_LANG ? resolve(DEFAULT_LANG, key, params) : undefined);
  return typeof str === "string" ? interpolate(str, params) : key;
};

export { SUPPORTED_LANGS, DEFAULT_LANG, pickLang, t };
