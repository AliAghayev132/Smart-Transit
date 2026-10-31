import { config } from "#config";

/**
 * Sıxlığın "ehtiyat payı" ilə göstərilməsi (CROWD_DISPLAY_BOOST_PCT, standart 20%).
 *
 * Crowdsourcing balı (1..3) təxmini doluluğa çevrilir (low≈45%, mid≈85%, high≈125%),
 * doluluq f = 1 + pct/100 dəfə artırılır və yenidən bala çevrilir. Beləliklə
 * sərnişin, operator paneli, AI və dispetçer tövsiyəsi eyni rəqəmi görür.
 * Anomaliya qaydası (10 dəq «Yüksək») və trend xam bildirişlərlə işləyir.
 *
 * pct = 0 → bütün funksiyalar xam dəyəri qaytarır.
 */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round2 = (v) => Math.round(v * 100) / 100;

const boostFactor = () =>
  1 + (Number(config.transit.crowd.displayBoostPct) || 0) / 100;

/** Sıxlıq balı (1..3) → avtobus doluluğu (pay) */
const loadFromScore = (s) => 0.45 + (clamp(s, 1, 3) - 1) * 0.4;

/** Doluluq (pay) → sıxlıq balı */
const scoreFromLoad = (l) => 1 + (l - 0.45) / 0.4;

/** Xam bal → göstərilən (artırılmış) bal, 1..3 */
const boostScore = (raw) =>
  raw == null
    ? null
    : round2(clamp(scoreFromLoad(loadFromScore(raw) * boostFactor()), 1, 3));

/** Xam bal → göstərilən təxmini doluluq (%) */
const occupancyPct = (raw) =>
  raw == null ? null : Math.round(loadFromScore(raw) * boostFactor() * 100);

/** Sərnişin sayı təxmini (canlı lokasiya) */
const boostCount = (n) =>
  typeof n === "number" && n > 0 ? Math.round(n * boostFactor()) : n;

export {
  boostFactor,
  loadFromScore,
  scoreFromLoad,
  boostScore,
  occupancyPct,
  boostCount,
};
