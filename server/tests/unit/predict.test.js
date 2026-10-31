/**
 * Unit: Gemini proqnozu — hava, tıxac, baza modeli, Gemini cavabının yoxlanılması, Gemini müştərisi.
 */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { config } from "#config";
import { PredictionService, GeminiService, WeatherService } from "#services";
import { trafficPrior } from "#services/PredictionService.js";
import { conditionFromCode, impactOf } from "#services/WeatherService.js";

const route = (id, number, loads, extra = {}) => ({
  routeId: id,
  number,
  name: `Xətt ${number}`,
  color: "#123456",
  stops: extra.stops || [
    [40.4, 49.85],
    [40.41, 49.86],
  ],
  buses: extra.buses ?? 4,
  reserves: 0,
  headwayMin: 10,
  activeAlerts: 0,
  now: { level: "mid", loadPct: loads[0], trend: "flat", reports: 3 },
  in1h: { hour: 18, loadPct: loads[1], confidence: 0.6 },
  in2h: { hour: 19, loadPct: loads[2], confidence: 0.5 },
  history: 10,
});

const ctxOf = (routes, extra = {}) => ({
  now: Date.UTC(2026, 9, 27, 13, 0), // çərşənbə axşamı 17:00 Bakı
  weather: null,
  traffic: { index: 0.3, level: "light", source: "estimated" },
  peaks: { source: "prior", hours: [] },
  historyReports: 0,
  routes,
  ...extra,
});

describe("Hava (Open-Meteo)", () => {
  test("WMO kodu → vəziyyət", () => {
    assert.equal(conditionFromCode(0), "clear");
    assert.equal(conditionFromCode(3), "cloudy");
    assert.equal(conditionFromCode(63), "rain");
    assert.equal(conditionFromCode(81), "rain");
    assert.equal(conditionFromCode(73), "snow");
    assert.equal(conditionFromCode(95), "storm");
    assert.equal(conditionFromCode(null), "unknown");
  });

  test("təsir: aydın hava 0, yağış və güclü külək artırır, 1-i keçmir", () => {
    assert.equal(impactOf({ condition: "clear", tempC: 20 }), 0);
    const rain = impactOf({ condition: "rain", precipMm: 4, tempC: 12 });
    assert.ok(rain > 0.3);
    assert.ok(
      impactOf({ condition: "rain", precipMm: 4, windKmh: 45, tempC: 12 }) >
        rain,
    );
    assert.ok(
      impactOf({ condition: "snow", precipMm: 50, windKmh: 80, tempC: -5 }) <=
        1,
    );
  });

  test("cavabın normallaşdırılması + növbəti saatların yağış ehtimalı", () => {
    const w = WeatherService.normalize(
      {
        utc_offset_seconds: 14400,
        current: {
          time: "2026-10-31T14:00",
          temperature_2m: 15.2,
          precipitation: 0,
          weather_code: 2,
          wind_speed_10m: 12,
        },
        hourly: {
          time: ["2026-10-31T14:00", "2026-10-31T15:00", "2026-10-31T16:00"],
          precipitation_probability: [10, 70, 40],
        },
      },
      Date.parse("2026-10-31T10:10:00Z"),
    );
    assert.equal(w.condition, "cloudy");
    assert.equal(w.tempC, 15.2);
    assert.equal(w.precipProbNext2h, 70);
    assert.equal(w.impact, 0.3, "yağış gözlənilirsə minimum təsir");
    assert.equal(WeatherService.normalize({}), null);
  });
});

describe("Tıxac göstəricisi", () => {
  test("iş günü pik saatları gecədən və həftəsonundan sıxdır", () => {
    assert.ok(trafficPrior(2, 18) > trafficPrior(2, 3));
    assert.ok(trafficPrior(2, 8) > trafficPrior(2, 11));
    assert.ok(trafficPrior(6, 18) < trafficPrior(2, 18));
  });

  test("hava tıxac indeksini artırır, 0..1 arasında qalır", () => {
    const now = Date.UTC(2026, 9, 27, 14, 0); // 18:00 Bakı
    const dry = PredictionService.traffic(now, null);
    const wet = PredictionService.traffic(now, { impact: 1 });
    assert.equal(dry.source, "estimated");
    assert.ok(wet.index >= dry.index && wet.index <= 1);
    assert.ok(["light", "moderate", "heavy"].includes(wet.level));
  });
});

describe("Baza modeli (Gemini olmadan)", () => {
  test("sıçrayış: yüksək proqnoz → sıçrayış, sakit xətt → yox", () => {
    const ctx = ctxOf([
      route("a", "5", [70, 100, 90]),
      route("b", "8", [40, 45, 50]),
    ]);
    const out = PredictionService.baseline(ctx, "az");
    assert.equal(out.spikes.length, 1);
    assert.equal(out.spikes[0].routeId, "a");
    assert.equal(out.spikes[0].inMin, 60);
    assert.match(out.summary, /№5/);
  });

  test("yerdəyişmə: az yüklü yaxın xətt donor olur, yoxdursa ehtiyat park", () => {
    const near = route("near", "8", [35, 40, 45], {
      buses: 5,
      stops: [[40.405, 49.855]],
    });
    const far = route("far", "H1", [30, 35, 40], {
      buses: 5,
      stops: [[40.47, 50.05]],
    });
    const hot = route("hot", "5", [80, 120, 110], { buses: 4 });
    const out = PredictionService.baseline(ctxOf([far, near, hot]), "en");
    const donor = out.reallocations.find((x) => x.fromRouteId);
    assert.equal(donor.fromRouteId, "near", "ən yaxın donor seçilir");
    assert.equal(donor.toRouteId, "hot");
    const total = out.reallocations.reduce((s, x) => s + x.buses, 0);
    assert.ok(
      total >= 1 && total <= config.transit.dispatch.maxReservePerAlert,
    );

    const alone = PredictionService.baseline(ctxOf([hot]), "en");
    assert.equal(alone.reallocations[0].fromRouteId, null);
    assert.match(alone.reallocations[0].reason, /depot/);
  });

  test("indi dolu və sıx qalan xətt «davam edən» kimi göstərilir", () => {
    const ctx = ctxOf([
      route("a", "13", [150, 83, 76]),
      route("b", "8", [150, 60, 50]),
    ]);
    const out = PredictionService.baseline(ctx, "az");
    assert.equal(
      out.spikes.length,
      1,
      "növbəti saatda boşalan xətt daxil deyil",
    );
    assert.equal(out.spikes[0].inMin, 0);
    assert.equal(out.spikes[0].ongoing, true);
    assert.equal(out.spikes[0].loadPct, 150);
    assert.match(out.summary, /№13 xəttində yüksək sıxlıq davam edir/);
    assert.ok(out.reallocations.some((x) => x.toRouteId === "a"));
  });

  test("donor: az avtobuslu xətt verilmir", () => {
    const small = route("s", "3", [30, 30, 30], { buses: 2 });
    const hot = route("hot", "5", [80, 120, 110]);
    const out = PredictionService.baseline(ctxOf([small, hot]), "az");
    assert.ok(out.reallocations.every((x) => x.fromRouteId !== "s"));
  });

  test("yağış proqnozu artırır", () => {
    const r = route("a", "5", [80, 88, 85]);
    const dry = PredictionService.baseline(ctxOf([r]), "az");
    const wet = PredictionService.baseline(
      ctxOf([r], {
        weather: { condition: "rain", impact: 0.8, tempC: 10 },
        traffic: { index: 0.8, level: "heavy", source: "estimated" },
      }),
      "az",
    );
    assert.equal(dry.spikes.length, 0);
    assert.equal(wet.spikes.length, 1);
    assert.match(wet.summary, /yağış/);
  });

  test("dil: mətnlər tələb olunan dildə", () => {
    const ctx = ctxOf([route("a", "5", [70, 100, 90])]);
    assert.match(PredictionService.baseline(ctx, "ru").summary, /маршрут/);
    assert.match(PredictionService.baseline(ctx, "en").summary, /route/);
  });
});

describe("Gemini cavabının yoxlanılması (sanitize)", () => {
  const ctx = ctxOf([
    route("a", "5", [70, 100, 90], { buses: 4 }),
    route("b", "8", [40, 40, 40], { buses: 3 }),
    route("c", "H1", [40, 40, 40], { buses: 5 }),
  ]);

  test("naməlum xətt, dublikat və özünə yerdəyişmə atılır", () => {
    const out = PredictionService.sanitize(
      {
        summary: "  Test   xülasə ",
        spikes: [
          { route: "999", inMinutes: 30, expectedLoadPct: 120, reason: "x" },
          { route: "№5", inMinutes: 45, expectedLoadPct: 105, reason: "ok" },
          { route: "5", inMinutes: 50, expectedLoadPct: 110, reason: "dup" },
        ],
        reallocations: [
          { from: "5", to: "5", buses: 1, reason: "self" },
          { from: "77", to: "5", buses: 1, reason: "unknown" },
          { from: "depot", to: "5", buses: 2, reason: "park" },
        ],
      },
      ctx,
    );
    assert.equal(out.summary, "Test xülasə");
    assert.equal(out.spikes.length, 1);
    assert.equal(out.spikes[0].routeId, "a");
    assert.equal(out.reallocations.length, 1);
    assert.equal(out.reallocations[0].fromRouteId, null);
  });

  test("rəqəmlər məhdudlaşdırılır, donor minimum avtobusu saxlayır", () => {
    const out = PredictionService.sanitize(
      {
        summary: "s",
        spikes: [
          {
            route: "5",
            inMinutes: 9999,
            expectedLoadPct: -50,
            confidence: 7,
            reason: "r",
          },
        ],
        reallocations: [
          { from: "8", to: "5", buses: 50, inMinutes: -3, reason: "a" },
          { from: "8", to: "5", buses: 1, reason: "again" },
          { from: "H1", to: "5", buses: 99, reason: "b" },
        ],
      },
      ctx,
    );
    const s = out.spikes[0];
    assert.equal(s.inMin, 120);
    assert.equal(s.loadPct, 0);
    assert.equal(s.confidence, 1);
    const from8 = out.reallocations.filter((x) => x.fromRouteId === "b");
    assert.equal(
      from8.reduce((n, x) => n + x.buses, 0),
      1,
      "3 avtobusdan 2-si qalır",
    );
    const fromH1 = out.reallocations.find((x) => x.fromRouteId === "c");
    assert.ok(fromH1.buses <= config.transit.dispatch.maxReservePerAlert);
    assert.equal(out.reallocations[0].inMin, 0);
  });

  test("zərərli/uzun mətn kəsilir, səhv tiplər atılır", () => {
    const out = PredictionService.sanitize(
      {
        summary: "x".repeat(5000),
        spikes: "not-an-array",
        reallocations: [null, 5, { to: { $gt: "" }, buses: 1 }],
        risks: ["<script>alert(1)</script>", 42, "y".repeat(900)],
      },
      ctx,
    );
    assert.equal(out.summary.length, 600);
    assert.deepEqual(out.spikes, []);
    assert.deepEqual(out.reallocations, []);
    assert.equal(out.risks.length, 2);
    assert.ok(out.risks[1].length <= 200);
  });
});

describe("GeminiService (saxta fetch ilə)", () => {
  const realFetch = globalThis.fetch;
  const realKey = config.gemini.apiKey;
  afterEach(() => {
    globalThis.fetch = realFetch;
    config.gemini.apiKey = realKey;
  });

  const reply = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  test("açar yoxdursa 503", async () => {
    config.gemini.apiKey = "";
    assert.equal(GeminiService.enabled, false);
    await assert.rejects(
      GeminiService.generateJson({ system: "s", prompt: "p" }),
      (e) => e.statusCode === 503,
    );
  });

  test("açar başlıqda göndərilir (URL-də yox), JSON cavab parse olunur", async () => {
    config.gemini.apiKey = "test-key-123";
    let seen;
    globalThis.fetch = async (url, opts) => {
      seen = { url: String(url), opts };
      return reply(200, {
        modelVersion: "gemini-x",
        candidates: [
          { content: { parts: [{ text: '```json\n{"summary":"ok"}\n```' }] } },
        ],
      });
    };
    const out = await GeminiService.generateJson({
      system: "sys",
      prompt: "data",
      schema: { type: "OBJECT" },
    });
    assert.deepEqual(out.data, { summary: "ok" });
    assert.equal(out.model, "gemini-x");
    assert.ok(!seen.url.includes("test-key-123"));
    assert.equal(seen.opts.headers["x-goog-api-key"], "test-key-123");
    const body = JSON.parse(seen.opts.body);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.equal(body.systemInstruction.parts[0].text, "sys");
  });

  test("model tapılmasa (404) fallback modelə keçir", async () => {
    config.gemini.apiKey = "k";
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(String(url));
      return urls.length === 1
        ? reply(404, { error: { message: "not found" } })
        : reply(200, {
            candidates: [{ content: { parts: [{ text: "{}" }] } }],
          });
    };
    await GeminiService.generateJson({ system: "s", prompt: "p" });
    assert.equal(urls.length, 2);
    assert.ok(urls[1].includes(config.gemini.fallbackModel));
  });

  test("icazə xətası 503, boş/yanlış cavab 502", async () => {
    config.gemini.apiKey = "k";
    globalThis.fetch = async () => reply(403, { error: { message: "denied" } });
    await assert.rejects(
      GeminiService.generateJson({ system: "s", prompt: "p" }),
      (e) => e.statusCode === 503,
    );
    globalThis.fetch = async () =>
      reply(200, {
        candidates: [{ content: { parts: [{ text: "not json" }] } }],
      });
    await assert.rejects(
      GeminiService.generateJson({ system: "s", prompt: "p" }),
      (e) => e.statusCode === 502,
    );
  });
});
