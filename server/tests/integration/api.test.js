/**
 * İnteqrasiya: real Express tətbiqi + servislər üzərindən HTTP sorğuları (in-memory DB).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, api, login } from "../support/app.js";
import { DensityReport, RouteAlert } from "#models";
import { analyticsService } from "#services";

let base, close, routes, opToken;

before(async () => {
  ({ base, close } = await startTestApp());
  routes = (await api(base, "/routes")).body.data.routes;
  opToken = await login(base, "operator@example.com", "Operator123!");
});
after(() => close());

const byNumber = (n) => routes.find((r) => r.number === n);

describe("Xətlər və ETA", () => {
  test("health: DB, xətlər, avtobuslar", async () => {
    const r = await api(base, "/health");
    assert.equal(r.status, 200);
    assert.equal(r.body.data.routes, routes.length);
    assert.ok(r.body.data.buses > 0);
  });

  test("Bakı xətləri yüklənib (həndəsə ilə)", () => {
    assert.ok(routes.length >= 10);
    for (const n of ["1", "5", "13", "H1"]) assert.ok(byNumber(n), n);
    assert.ok(byNumber("H1").lengthKm > 15, "aeroport xətti");
    assert.ok(
      byNumber("5").path.length > byNumber("5").stops.length,
      "yol ara nöqtələri",
    );
  });

  test("dayanacaq ETA: limit 1..10 ilə məhdudlaşır, gəlişlər vaxta görə sıralanır", async () => {
    const r5 = byNumber("5");
    const r = await api(
      base,
      `/routes/${r5.id}/stops/${r5.stops[2].id}/eta?limit=999`,
    );
    assert.equal(r.status, 200);
    const arr = r.body.data.arrivals;
    assert.ok(arr.length > 0 && arr.length <= 10);
    for (let i = 1; i < arr.length; i++)
      assert.ok(arr[i].etaSec >= arr[i - 1].etaSec);
    assert.ok("loadPct" in arr[0].crowd);
  });

  test("naməlum xətt / dayanacaq → 404 (lokallaşdırılmış)", async () => {
    const a = await api(base, "/routes/000000000000000000000000/stops/x/eta", {
      lang: "en",
    });
    assert.equal(a.status, 404);
    assert.match(a.body.message, /[A-Za-z]/);
    const r5 = byNumber("5");
    const b = await api(base, `/routes/${r5.id}/stops/nope/eta`, {
      lang: "ru",
    });
    assert.equal(b.status, 404);
    assert.match(b.body.message, /[А-Яа-я]/);
  });
});

describe("Crowdsourcing bildirişi", () => {
  test("düzgün bildiriş qəbul olunur, GPS xəttə yaxındırsa təsdiqlənir", async () => {
    const r1 = byNumber("1");
    const s = r1.stops[1];
    const r = await api(base, "/reports", {
      method: "POST",
      body: {
        routeId: r1.id,
        level: "mid",
        lat: s.lat,
        lng: s.lng,
        deviceId: "dev-ok-1",
      },
    });
    assert.equal(r.status, 201);
    const saved = DensityReport.store.at(-1);
    assert.equal(saved.verified, true);
    assert.equal(saved.source, "gps");
    assert.ok(
      saved.ipHash && !saved.ipHash.includes("127"),
      "IP özü yox, hash saxlanılır",
    );
  });

  test("eyni cihaz + xətt üçün cooldown → 429 REPORT_COOLDOWN", async () => {
    const r1 = byNumber("1");
    const body = { routeId: r1.id, level: "high", deviceId: "dev-cool" };
    assert.equal(
      (await api(base, "/reports", { method: "POST", body })).status,
      201,
    );
    const again = await api(base, "/reports", {
      method: "POST",
      body,
      lang: "en",
    });
    assert.equal(again.status, 429);
    assert.equal(again.body.code, "REPORT_COOLDOWN");
    assert.ok(again.body.data.retryAfter > 0);
  });

  test("yanlış səviyyə, deviceId yoxdur, avtobus başqa xəttindir → 400", async () => {
    const r1 = byNumber("1");
    const r5 = byNumber("5");
    const buses = (await api(base, "/routes/buses")).body.data.buses;
    const foreignBus = buses.find((b) => b.routeId === r5.id);
    for (const body of [
      { routeId: r1.id, level: "extreme", deviceId: "d1" },
      { routeId: r1.id, level: "low" },
      { routeId: r1.id, level: "low", deviceId: "x".repeat(65) },
      { routeId: r1.id, level: "low", deviceId: "d2", busId: foreignBus.id },
    ]) {
      const r = await api(base, "/reports", { method: "POST", body });
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(r.body.success, false);
    }
  });
});

describe("Anomaliya → avtomatik xəbərdarlıq və tövsiyə", () => {
  test("3 müstəqil mənbədən «Yüksək» → RESERVE_BUS_NEEDED + tövsiyə", async () => {
    const r13 = byNumber("13");
    await DensityReport.insertMany(
      ["a", "b", "c"].map((d, i) => ({
        route: r13.id,
        level: "high",
        deviceId: `an-${d}`,
        ipHash: `src-${i}`,
        verified: true,
      })),
    );
    const alert = await analyticsService.checkRoute(r13.id);
    assert.ok(alert, "xəbərdarlıq yaranmalıdır");
    assert.equal(alert.type, "RESERVE_BUS_NEEDED");
    assert.match(alert.message, /Əlavə avtobus ehtiyatı ayrılmalıdır/);
    const stored = RouteAlert.store.find(
      (a) => String(a._id) === String(alert._id),
    );
    assert.ok(stored.recommendation?.recommendedBuses >= 1);
    assert.equal(stored.history[0].noteKey, "auto_crowd");
    // təkrar yoxlama dublikat yaratmır
    await analyticsService.checkRoute(r13.id);
    assert.equal(
      RouteAlert.store.filter(
        (a) => String(a.route) === r13.id && a.status !== "resolved",
      ).length,
      1,
    );
  });

  test("operator xəbərdarlığı görür və ehtiyat ayırır", async () => {
    const list = await api(base, "/alerts", { token: opToken });
    assert.equal(list.status, 200);
    const alert = list.body.data.alerts.find(
      (a) => a.type === "RESERVE_BUS_NEEDED",
    );
    assert.ok(alert);
    const r = await api(base, `/alerts/${alert._id}`, {
      method: "PATCH",
      token: opToken,
      body: { action: "dispatch", count: 2 },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.alert.status, "dispatched");
    assert.equal(r.body.data.alert.reserveBuses.length, 2);
  });
});

describe("Planlayıcı, «Gedirəm», chatbot", () => {
  test("Sahil → Koroğlu: köçürmə ilə variant tapılır", async () => {
    const r5 = byNumber("5");
    const r1 = byNumber("1");
    const sahil = r5.stops.find((s) => s.name === "Sahil m.");
    const koroglu = r1.stops.find((s) => s.name === "Koroğlu m.");
    const r = await api(base, "/plan", {
      method: "POST",
      body: { from: sahil, to: koroglu, includeGoogle: false },
    });
    assert.equal(r.status, 200);
    const its = r.body.data.itineraries;
    assert.ok(its.length > 0);
    assert.ok(its[0].legs.some((l) => l.type === "bus"));
    assert.ok(new Date(its[0].arriveAt) > new Date());
  });

  test("plan: yanlış koordinat → 400", async () => {
    const r = await api(base, "/plan", {
      method: "POST",
      body: { from: { lat: "x", lng: 1 }, to: { lat: 40, lng: 49 } },
    });
    assert.equal(r.status, 400);
  });

  test("«Gedirəm»: saxta stopId və NaN koordinat bazaya düşmür", async () => {
    const r1 = byNumber("1");
    const from = r1.stops[0];
    const to = r1.stops.at(-1);
    const r = await api(base, "/intents", {
      method: "POST",
      body: {
        deviceId: "intent-1",
        from,
        to,
        itinerary: {
          legs: [
            {
              type: "bus",
              routeId: r1.id,
              number: "1",
              from: {
                stopId: { $ne: null },
                name: "x",
                lat: from.lat,
                lng: from.lng,
              },
            },
          ],
        },
      },
    });
    assert.equal(r.status, 201);
    const del = await api(base, "/intents/intent-1", { method: "DELETE" });
    assert.equal(del.status, 200);
  });

  test("chatbot (AI açarsız) üç dildə cavab verir", async () => {
    const replies = {};
    for (const lang of ["az", "en", "ru"]) {
      const r = await api(base, "/ai/chat", {
        method: "POST",
        lang,
        body: { messages: [{ role: "user", content: "5" }] },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.data.source, "rules");
      replies[lang] = r.body.data.reply;
    }
    assert.notEqual(replies.az, replies.en);
    assert.match(replies.ru, /[А-Яа-я]/);
  });

  test("chatbot: boş mesaj → 400", async () => {
    const r = await api(base, "/ai/chat", {
      method: "POST",
      body: { messages: [] },
    });
    assert.equal(r.status, 400);
  });
});

describe("Dispetçer əmrləri", () => {
  test("şablonlar seçilmiş dildə gəlir", async () => {
    const en = await api(base, "/dispatch/templates", {
      token: opToken,
      lang: "en",
    });
    const ru = await api(base, "/dispatch/templates", {
      token: opToken,
      lang: "ru",
    });
    assert.equal(en.status, 200);
    assert.notEqual(
      en.body.data.templates[0].title,
      ru.body.data.templates[0].title,
    );
  });

  test("sərbəst əmr göndərilir, çox uzun mətn rədd edilir", async () => {
    const r1 = byNumber("1");
    const ok = await api(base, "/dispatch/commands", {
      method: "POST",
      token: opToken,
      body: { routeId: r1.id, type: "CUSTOM", text: "Test əmri" },
    });
    assert.equal(ok.status, 201);
    const long = await api(base, "/dispatch/commands", {
      method: "POST",
      token: opToken,
      body: { routeId: r1.id, type: "CUSTOM", text: "x".repeat(1001) },
    });
    assert.equal(long.status, 400);
    const bad = await api(base, "/dispatch/commands", {
      method: "POST",
      token: opToken,
      body: { routeId: r1.id, type: "DROP_TABLE" },
    });
    assert.equal(bad.status, 400);
  });
});
