/**
 * İnteqrasiya: GET /api/analytics/predict — auth, baza modeli, Gemini (saxta cavabla), fallback.
 * Gemini sorğuları yalnız generativelanguage.googleapis.com üçün tutulur; tətbiqə gedən sorğular realdır.
 */
import { test, describe, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, api, login } from "../support/app.js";
import { config } from "#config";
import { PredictionService } from "#services";

let base, close, opToken;
const realFetch = globalThis.fetch;
const realKey = config.gemini.apiKey;
let geminiHandler = null;
let geminiCalls = 0;

before(async () => {
  ({ base, close } = await startTestApp());
  opToken = await login(base, "operator@example.com", "Operator123!");
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith("https://generativelanguage.googleapis.com")) {
      geminiCalls++;
      return geminiHandler(url, opts);
    }
    return realFetch(url, opts);
  };
});
after(() => {
  globalThis.fetch = realFetch;
  return close();
});
afterEach(() => {
  config.gemini.apiKey = realKey;
  geminiHandler = null;
  PredictionService.clearCache();
});

const geminiReply = (obj) => () =>
  new Response(
    JSON.stringify({
      modelVersion: "gemini-test",
      candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

describe("Gemini proqnozu /api/analytics/predict", () => {
  test("token olmadan 401", async () => {
    const r = await api(base, "/analytics/predict");
    assert.equal(r.status, 401);
  });

  test("açar yoxdursa baza modeli (source: rules), bütün xətlər və tıxac", async () => {
    const r = await api(base, "/analytics/predict", { token: opToken });
    assert.equal(r.status, 200);
    const d = r.body.data;
    assert.equal(d.source, "rules");
    assert.equal(d.horizonMin, 120);
    assert.ok(d.routes.length >= 10);
    assert.ok(d.routes.every((x) => "in1h" in x && "in2h" in x));
    assert.ok(["light", "moderate", "heavy"].includes(d.traffic.level));
    assert.equal(d.weather, null, "testdə hava söndürülüb");
    assert.ok(d.summary.length > 0);
    assert.equal(geminiCalls, 0);
  });

  test("Gemini cavabı yoxlanılır və xətt məlumatı ilə qaytarılır; keş işləyir", async () => {
    config.gemini.apiKey = "test-key";
    geminiHandler = geminiReply({
      summary: "Axşam pikində 5 nömrəli xətt sıxlaşacaq.",
      spikes: [
        {
          route: "5",
          inMinutes: 40,
          expectedLoadPct: 112,
          confidence: 0.7,
          reason: "Pik",
        },
        {
          route: "777",
          inMinutes: 10,
          expectedLoadPct: 150,
          reason: "uydurma",
        },
      ],
      reallocations: [
        { from: "8", to: "5", buses: 1, inMinutes: 10, reason: "8 boşdur" },
      ],
      risks: ["Yağış ehtimalı"],
    });
    const before = geminiCalls;
    const r = await api(base, "/analytics/predict", { token: opToken });
    assert.equal(r.status, 200);
    const d = r.body.data;
    assert.equal(d.source, "gemini");
    assert.equal(d.model, "gemini-test");
    assert.equal(d.spikes.length, 1, "naməlum xətt atıldı");
    assert.equal(d.spikes[0].number, "5");
    assert.ok(d.spikes[0].routeId && d.spikes[0].color);
    assert.equal(d.reallocations[0].from.number, "8");
    assert.equal(d.reallocations[0].to.number, "5");

    const again = await api(base, "/analytics/predict", { token: opToken });
    assert.equal(again.body.data.cached, true);
    assert.equal(geminiCalls, before + 1, "ikinci sorğu keşdən");
  });

  test("Gemini xəta verərsə baza modelinə keçir (500 yox)", async () => {
    config.gemini.apiKey = "test-key";
    geminiHandler = () =>
      new Response(JSON.stringify({ error: { message: "quota" } }), {
        status: 429,
      });
    const r = await api(base, "/analytics/predict?refresh=1", {
      token: opToken,
      lang: "en",
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.source, "rules");
    assert.equal(r.body.data.fallback, true);
    assert.match(r.body.data.summary, /[A-Za-z]/);
  });

  test("API açarı cavabda və status endpoint-də görünmür", async () => {
    config.gemini.apiKey = "secret-gemini-key";
    geminiHandler = geminiReply({
      summary: "ok",
      spikes: [],
      reallocations: [],
    });
    const r = await api(base, "/analytics/predict", { token: opToken });
    assert.ok(!JSON.stringify(r.body).includes("secret-gemini-key"));
    const s = await api(base, "/ai/status");
    assert.equal(s.body.data.gemini.enabled, true);
    assert.ok(!JSON.stringify(s.body).includes("secret-gemini-key"));
  });
});
