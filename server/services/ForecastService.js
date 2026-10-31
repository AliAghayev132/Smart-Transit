import { DensityReport } from "#models";
import { boostScore, occupancyPct } from "#utils";
import { AnalyticsService } from "#services/AnalyticsService.js";

const SCORE = { low: 1, mid: 2, high: 3 };
const TZ = "Asia/Baku";
const PRIOR_WEIGHT = 5; // tarixçə az olduqda prior profilin çəkisi (ekvivalent bildiriş sayı)
const LIVE_DECAY = 0.6; // cari vəziyyətin gələcək saatlara təsirinin sönməsi

const hourFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "numeric",
  hourCycle: "h23",
  weekday: "short",
});
const DOW = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };

/** Bakı vaxtı ilə həftənin günü və saat */
const bakuSlot = (date) => {
  const parts = Object.fromEntries(
    hourFmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return { dow: DOW[parts.weekday], hour: Number(parts.hour) };
};

/**
 * Bakı pik saatlarına əsaslanan prior profil (tarixçə olmadıqda / az olduqda).
 * İş günü: səhər 07–10, axşam 17–20 pik.
 */
const priorScore = (dow, hour) => {
  const weekend = dow === 0 || dow === 6;
  let s;
  if (hour >= 7 && hour < 10) s = 2.6;
  else if (hour >= 17 && hour < 20) s = 2.7;
  else if (hour >= 12 && hour < 15) s = 1.9;
  else if (hour >= 23 || hour < 6) s = 1.1;
  else s = 1.6;
  return weekend ? Math.max(1, s - 0.4) : s;
};

/**
 * ForecastService (static)
 * Növbəti saatlar üçün xətt sıxlığı proqnozu — bazis model:
 *   həftənin günü × saat üzrə tarixi orta (son 14 gün)  ⊕  Bakı pik prior-u  ⊕  cari canlı sapma.
 * Bu, şəffaf "seasonal baseline"-dır; data yığıldıqca gradient boosting / TFT ilə əvəz oluna bilər
 * (bax: docs/AI-STRATEGY.md).
 */
class ForecastService {
  static async history(routeId, days = 14) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    return DensityReport.find(
      { route: routeId, createdAt: { $gte: since } },
      { level: 1, createdAt: 1, verified: 1 },
    ).lean();
  }

  /**
   * Saf funksiya: tarixçə → saatlıq proqnoz.
   * liveScore XAM baldır (crowd.rawScore); nəticə nöqtələrində bal/səviyyə göstəriş üçün
   * artırılır (CROWD_DISPLAY_BOOST_PCT), `rawScore` və `loadPct` əlavə olunur.
   */
  static build(
    reports,
    { now = Date.now(), hours = 4, liveScore = null } = {},
  ) {
    const buckets = new Map();
    for (const r of reports) {
      const { dow, hour } = bakuSlot(new Date(r.createdAt));
      const k = `${dow}:${hour}`;
      const b = buckets.get(k) || { sum: 0, n: 0 };
      const w = r.verified ? 1 : 0.5;
      b.sum += SCORE[r.level] * w;
      b.n += w;
      buckets.set(k, b);
    }

    const estimate = (date) => {
      const { dow, hour } = bakuSlot(date);
      const b = buckets.get(`${dow}:${hour}`) || { sum: 0, n: 0 };
      const prior = priorScore(dow, hour);
      return {
        hour,
        score: (b.sum + prior * PRIOR_WEIGHT) / (b.n + PRIOR_WEIGHT),
        samples: Math.round(b.n),
      };
    };

    // Cari saat üçün canlı sapma (real vəziyyət tarixi ortadan nə qədər fərqlənir)
    const nowEst = estimate(new Date(now));
    const delta = liveScore != null ? liveScore - nowEst.score : 0;

    const points = [];
    for (let h = 0; h <= hours; h++) {
      const at = new Date(now + h * 3600 * 1000);
      const e = estimate(at);
      const raw =
        Math.round(
          Math.min(3, Math.max(1, e.score + delta * Math.pow(LIVE_DECAY, h))) *
            100,
        ) / 100;
      const score = boostScore(raw);
      const confidence = Math.min(0.95, 0.35 + e.samples / 40);
      points.push({
        at: at.toISOString(),
        hour: e.hour,
        score,
        rawScore: raw,
        loadPct: occupancyPct(raw),
        level: AnalyticsService.levelFromScore(score),
        samples: e.samples,
        confidence: Math.round(confidence * 100) / 100,
      });
    }
    return {
      method: "seasonal-baseline+live-adjustment",
      historyReports: reports.length,
      liveScore,
      points,
    };
  }

  static async forRoute(routeId, { hours = 4, liveScore = null } = {}) {
    const reports = await this.history(routeId);
    return this.build(reports, { hours, liveScore });
  }

  /**
   * Hesabatlar üçün zaman seriyası: son `hours` saatda `bucketMin` dəqiqəlik qutular üzrə
   * səviyyələrin sayı (JS-də aqreqasiya — kiçik pəncərə).
   */
  static async timeseries({ hours = 6, bucketMin = 15, routeId } = {}) {
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const q = { createdAt: { $gte: since } };
    if (routeId) q.route = routeId;
    const list = await DensityReport.find(q, {
      level: 1,
      createdAt: 1,
      route: 1,
    }).lean();
    const size = bucketMin * 60000;
    const start = Math.floor(since.getTime() / size) * size;
    const n = Math.ceil((Date.now() - start) / size);
    const series = Array.from({ length: n }, (_, i) => ({
      at: new Date(start + i * size).toISOString(),
      low: 0,
      mid: 0,
      high: 0,
    }));
    const byRoute = {};
    for (const r of list) {
      const i = Math.floor((new Date(r.createdAt).getTime() - start) / size);
      if (series[i]) series[i][r.level]++;
      const k = String(r.route);
      byRoute[k] = byRoute[k] || { low: 0, mid: 0, high: 0 };
      byRoute[k][r.level]++;
    }
    return { hours, bucketMin, total: list.length, series, byRoute };
  }
}

export { ForecastService, bakuSlot, priorScore };
