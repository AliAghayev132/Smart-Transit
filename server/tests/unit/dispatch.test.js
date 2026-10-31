import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DispatchService, ForecastService } from "#services";

const ctx = (over = {}) => ({
  route: { id: "r1", number: "5" },
  fleet: { buses: 4, reserves: 0, headwayMin: 12, ...over.fleet },
  crowd:
    over.crowd === undefined
      ? { score: 2.4, loadPct: 120, total: 10, verified: 6 }
      : over.crowd,
  forecast: over.forecast || [],
  activeAlerts: over.activeAlerts || [],
  demand: { confirmedIntents: 0, ...over.demand },
  live: { riders: 0 },
  hotSegments: [],
});

describe("Dispetçer tövsiyəsi (deterministik nüvə)", () => {
  test("doluluq hədəfdən yuxarıdırsa əlavə avtobus tövsiyə olunur", () => {
    const r = DispatchService.computeRecommendation(ctx());
    assert.ok(r.recommendedBuses >= 1);
    assert.ok(r.loadAfterPct < r.loadNowPct);
    assert.ok(r.headwayAfterMin < r.headwayNowMin);
    assert.ok(
      r.reasons.every((x) => typeof x.code === "string"),
      "səbəblər kod kimi qaytarılır",
    );
  });

  test("sakit xətt → 0 avtobus", () => {
    const r = DispatchService.computeRecommendation(
      ctx({ crowd: { score: 1, loadPct: 54, total: 8, verified: 8 } }),
    );
    assert.equal(r.recommendedBuses, 0);
  });

  test("tövsiyə limitdən çox ola bilməz", () => {
    const r = DispatchService.computeRecommendation(
      ctx({
        fleet: { buses: 20 },
        crowd: { score: 3, loadPct: 150, total: 30, verified: 30 },
        demand: { confirmedIntents: 400 },
      }),
    );
    assert.equal(r.recommendedBuses, DispatchService.cfg.maxReservePerAlert);
    assert.ok(r.reasons.some((x) => x.code === "limit_max"));
  });

  test("artıq ayrılmış ehtiyatlar yenidən tövsiyə olunmur", () => {
    const before = DispatchService.computeRecommendation(ctx());
    const after = DispatchService.computeRecommendation(
      ctx({
        fleet: {
          buses: 4 + before.recommendedBuses,
          reserves: before.recommendedBuses,
        },
      }),
    );
    assert.ok(after.recommendedBuses <= before.recommendedBuses);
    assert.ok(after.reasons.some((x) => x.code === "reserves_on_line"));
  });

  test("aktiv «Yüksək» xəbərdarlığı varsa minimum 1 avtobus", () => {
    const r = DispatchService.computeRecommendation(
      ctx({
        crowd: null,
        activeAlerts: [{ type: "RESERVE_BUS_NEEDED" }],
        fleet: { buses: 10 },
      }),
    );
    assert.ok(r.recommendedBuses >= 1);
  });

  test("şablon doldurulur, naməlum tip rədd edilir, yer tutucu inyeksiyası yoxdur", () => {
    const text = DispatchService.fillTemplate(
      "RESERVE_RELEASE",
      { count: 2, stop: "Sahil m." },
      { number: "5" },
      "az",
    );
    assert.match(text, /5/);
    assert.match(text, /2/);
    assert.match(text, /Sahil m\./);
    const evil = DispatchService.fillTemplate(
      "RESERVE_RELEASE",
      { count: "{route}", stop: "x" },
      { number: "5" },
      "en",
    );
    // Tək keçidli əvəzləmə: istifadəçi dəyəri ({route}) yenidən şablon kimi açılmır
    assert.ok(evil.includes("{route}"), evil);
    assert.throws(() =>
      DispatchService.fillTemplate("NOPE", {}, { number: "5" }, "az"),
    );
  });
});

describe("Proqnoz (bazis model)", () => {
  test("tarixçə yoxdursa prior profil qaytarılır, ballar 1..3 aralığındadır", () => {
    const f = ForecastService.build([], { hours: 3 });
    assert.equal(f.points.length, 4);
    for (const p of f.points) {
      assert.ok(p.score >= 1 && p.score <= 3);
      assert.ok(["low", "mid", "high"].includes(p.level));
      assert.ok(p.confidence > 0 && p.confidence <= 0.95);
    }
  });

  test("canlı sapma yaxın saata daha çox təsir edir", () => {
    const calm = ForecastService.build([], { hours: 3, liveScore: 1 });
    const busy = ForecastService.build([], { hours: 3, liveScore: 3 });
    const d0 = busy.points[0].score - calm.points[0].score;
    const d3 = busy.points[3].score - calm.points[3].score;
    assert.ok(d0 > d3);
  });
});
