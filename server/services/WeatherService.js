import { config } from "#config";

const API = "https://api.open-meteo.com/v1/forecast";

/** WMO hava kodu → sadə vəziyyət */
const conditionFromCode = (code) => {
  if (code == null) return "unknown";
  if (code === 0) return "clear";
  if (code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "unknown";
};

/**
 * Havanın ictimai nəqliyyata təsiri (0 = təsirsiz, 1 = çox güclü).
 * Yağış/qar → piyada və taksi əvəzinə avtobusa keçid + yavaş hərəkət;
 * güclü külək (Bakıda «xəzri») və şaxta/isti də dayanacaqda gözləməni çətinləşdirir.
 */
const impactOf = ({ condition, precipMm = 0, windKmh = 0, tempC = 18 }) => {
  let x = 0;
  if (condition === "drizzle") x += 0.15;
  if (condition === "rain") x += 0.3 + Math.min(precipMm, 10) * 0.03;
  if (condition === "snow") x += 0.55;
  if (condition === "storm") x += 0.5;
  if (condition === "fog") x += 0.1;
  if (windKmh >= 40) x += 0.2;
  else if (windKmh >= 28) x += 0.1;
  if (tempC <= 0 || tempC >= 36) x += 0.1;
  return Math.round(Math.min(1, x) * 100) / 100;
};

/**
 * WeatherService
 * Open-Meteo (açarsız) ilə Bakı üçün cari hava + növbəti 2 saatın yağış ehtimalı.
 * Nəticə keşlənir; şəbəkə xətası proqnozu dayandırmır (null qaytarır).
 */
class WeatherService {
  constructor() {
    this.cache = null;
    this.at = 0;
  }

  /** Open-Meteo cavabı → bizim forma (saf funksiya) */
  static normalize(json, now = Date.now()) {
    const c = json?.current;
    if (!c) return null;
    const condition = conditionFromCode(c.weather_code);
    const times = json.hourly?.time || [];
    const probs = json.hourly?.precipitation_probability || [];
    const next = [];
    for (let i = 0; i < times.length && next.length < 3; i++) {
      // Open-Meteo "timezone=auto" ilə yerli vaxt qaytarır, utc_offset_seconds ilə çeviririk
      const ts =
        Date.parse(`${times[i]}Z`) - (json.utc_offset_seconds || 0) * 1000;
      if (ts + 3600 * 1000 > now) next.push(probs[i] ?? 0);
    }
    const w = {
      condition,
      code: c.weather_code ?? null,
      tempC: c.temperature_2m ?? null,
      precipMm: c.precipitation ?? 0,
      windKmh: c.wind_speed_10m ?? 0,
      precipProbNext2h: next.length ? Math.max(...next) : null,
      observedAt: c.time || null,
      source: "open-meteo",
    };
    w.impact = impactOf(w);
    // Yaxın 2 saatda yağış gözlənilirsə, təsiri bir az artırırıq
    if ((w.precipProbNext2h ?? 0) >= 60 && w.impact < 0.3) w.impact = 0.3;
    return w;
  }

  async current() {
    const cfg = config.weather;
    if (!cfg.enabled) return null;
    if (this.cache && Date.now() - this.at < cfg.cacheMin * 60000)
      return this.cache;

    const url =
      `${API}?latitude=${cfg.lat}&longitude=${cfg.lng}` +
      "&current=temperature_2m,precipitation,weather_code,wind_speed_10m" +
      "&hourly=precipitation_probability&forecast_hours=4&timezone=auto";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      this.cache = WeatherService.normalize(await res.json());
      this.at = Date.now();
      return this.cache;
    } catch (e) {
      console.warn("⚠️ Hava məlumatı alınmadı:", e.message);
      // Köhnə keş varsa onu qaytarırıq (1 saata qədər)
      return this.cache && Date.now() - this.at < 3600000 ? this.cache : null;
    } finally {
      clearTimeout(timer);
    }
  }
}

const weatherService = new WeatherService();

export { WeatherService, weatherService, conditionFromCode, impactOf };
