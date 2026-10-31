import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { config } from "#config";
import { AnalyticsService } from "#services";
import {
  boostScore,
  occupancyPct,
  boostCount,
  loadFromScore,
  scoreFromLoad,
} from "#utils";

const at = (min, extra = {}) => ({
  createdAt: new Date(Date.now() - min * 60000),
  verified: true,
  ...extra,
});

describe("Sıxlıq aqreqasiyası", () => {
  test("bal → səviyyə sərhədləri", () => {
    assert.equal(AnalyticsService.levelFromScore(null), "unknown");
    assert.equal(AnalyticsService.levelFromScore(1), "low");
    assert.equal(AnalyticsService.levelFromScore(1.66), "low");
    assert.equal(AnalyticsService.levelFromScore(1.67), "mid");
    assert.equal(AnalyticsService.levelFromScore(2.33), "mid");
    assert.equal(AnalyticsService.levelFromScore(2.34), "high");
  });

  test("təzə və GPS-təsdiqli bildiriş daha çox çəkiyə malikdir", () => {
    const now = Date.now();
    const fresh = AnalyticsService.weightOf(at(0), now, 5);
    const old = AnalyticsService.weightOf(at(5), now, 5);
    const unverified = AnalyticsService.weightOf(
      at(0, { verified: false }),
      now,
      5,
    );
    assert.ok(Math.abs(fresh - 1) < 1e-6);
    assert.ok(Math.abs(old - 0.5) < 1e-3, "yarım ömür 5 dəq");
    assert.ok(Math.abs(unverified - 0.4) < 1e-6);
  });

  test("boş siyahı → unknown, xəta yoxdur", () => {
    const a = AnalyticsService.aggregate([], Date.now(), 5);
    assert.deepEqual([a.score, a.level, a.total], [null, "unknown", 0]);
  });

  test("qarışıq bildirişlər çəkili orta verir", () => {
    const a = AnalyticsService.aggregate(
      [at(0, { level: "high" }), at(0, { level: "low" })],
      Date.now(),
      5,
    );
    assert.equal(a.score, 2);
    assert.equal(a.level, "mid");
    assert.deepEqual(a.counts, { low: 1, mid: 0, high: 1 });
  });
});

describe("Anomaliya qaydası (10 dəq «Yüksək»)", () => {
  const high = (deviceId, ipHash, min = 1) =>
    at(min, { level: "high", deviceId, ipHash });

  test("3 fərqli mənbədən «Yüksək» → xəbərdarlıq", () => {
    const r = AnalyticsService.evaluateAnomaly([
      high("a", "ip1"),
      high("b", "ip2"),
      high("c", "ip3"),
    ]);
    assert.equal(r.triggered, true);
    assert.equal(r.stats.highReports, 3);
    assert.equal(r.stats.highRatio, 1);
  });

  test("Sybil: bir IP-dən çoxlu saxta deviceId ən çox 2 iştirakçı sayılır", () => {
    const reports = ["a", "b", "c", "d", "e"].map((d) => high(d, "same-ip"));
    const r = AnalyticsService.evaluateAnomaly(reports);
    assert.equal(r.stats.highReports, 2);
    assert.equal(r.triggered, false);
  });

  test("pəncərədən kənar bildirişlər sayılmır", () => {
    const r = AnalyticsService.evaluateAnomaly([
      high("a", "1", 11),
      high("b", "2", 12),
      high("c", "3", 30),
    ]);
    assert.equal(r.triggered, false);
    assert.equal(r.stats.highReports, 0);
  });

  test("«Yüksək» payı 60%-dən azdırsa — xəbərdarlıq yoxdur", () => {
    const lows = ["d", "e", "f"].map((d, i) =>
      at(1, { level: "low", deviceId: d, ipHash: `l${i}` }),
    );
    const r = AnalyticsService.evaluateAnomaly([
      high("a", "1"),
      high("b", "2"),
      high("c", "3"),
      ...lows,
    ]);
    assert.equal(r.stats.highRatio, 0.5);
    assert.equal(r.triggered, false);
  });
});

describe("Sıxlıq +20% göstərilməsi", () => {
  test("doluluq ↔ bal çevrilməsi qarşılıqlıdır", () => {
    for (const s of [1, 1.5, 2, 2.5, 3])
      assert.ok(Math.abs(scoreFromLoad(loadFromScore(s)) - s) < 1e-9);
  });

  test("standart 20%: «Orta» (2.0) → 102% və «Yüksək»", () => {
    assert.equal(config.transit.crowd.displayBoostPct, 20);
    assert.equal(occupancyPct(2), 102);
    assert.equal(AnalyticsService.levelFromScore(boostScore(2)), "high");
    assert.equal(boostScore(3), 3, "bal 3-dən yuxarı çıxmır");
    assert.equal(boostScore(null), null);
    assert.equal(boostCount(5), 6);
    assert.equal(boostCount(0), 0);
  });

  test("0% → xam dəyərlər dəyişmir", () => {
    const prev = config.transit.crowd.displayBoostPct;
    config.transit.crowd.displayBoostPct = 0;
    try {
      for (const s of [1, 1.4, 2, 2.6, 3]) assert.equal(boostScore(s), s);
      assert.equal(occupancyPct(2), 85);
      assert.equal(boostCount(7), 7);
    } finally {
      config.transit.crowd.displayBoostPct = prev;
    }
  });
});
