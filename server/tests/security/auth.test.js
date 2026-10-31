/**
 * Təhlükəsizlik: autentifikasiya, rol icazələri, JWT, injection, prototip çirklənməsi,
 * HTTP başlıqları, CORS, payload limiti, məlumat sızması.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { startTestApp, api, login, tokenFor } from "../support/app.js";
import { config } from "#config";
import { User } from "#models";
import { AuthTokenService, socketService } from "#services";

let base, close, routeId, userToken, opToken;

before(async () => {
  ({ base, close } = await startTestApp());
  routeId = (await api(base, "/routes")).body.data.routes[0].id;
  userToken = await tokenFor("user");
  opToken = await login(base, "operator@example.com", "Operator123!");
});
after(() => close());

// Operator / admin tələb edən bütün endpoint-lər
const PROTECTED = () => [
  ["GET", "/alerts"],
  ["PATCH", "/alerts/000000000000000000000000", { action: "resolve" }],
  ["GET", "/dispatch/templates"],
  ["GET", `/dispatch/recommend/${routeId}`],
  ["POST", "/dispatch/commands", { routeId, type: "CUSTOM", text: "x" }],
  ["GET", "/analytics/heat"],
  ["GET", "/analytics/forecast"],
  ["GET", "/analytics/timeseries"],
  ["GET", "/reports/recent"],
  ["GET", "/demand/stops"],
  ["GET", "/density/history"],
  ["POST", "/demo/surge", { routeId }],
  ["POST", "/routes/buses/x/location", { lat: 40.4, lng: 49.8 }],
  ["GET", `/ai/summary/${routeId}`],
  ["GET", `/ai/dispatch/${routeId}`],
];

describe("Autentifikasiya və rol icazələri", () => {
  test("token olmadan → 401", async () => {
    for (const [method, path, body] of PROTECTED()) {
      const r = await api(base, path, { method, body });
      assert.equal(r.status, 401, `${method} ${path}`);
    }
  });

  test("adi istifadəçi (user rolu) → 403", async () => {
    for (const [method, path, body] of PROTECTED()) {
      const r = await api(base, path, { method, body, token: userToken });
      assert.equal(r.status, 403, `${method} ${path}`);
    }
  });

  test("operator → icazə var (401/403 deyil)", async () => {
    for (const [method, path, body] of PROTECTED().filter(
      ([m]) => m === "GET",
    )) {
      const r = await api(base, path, { method, body, token: opToken });
      assert.ok(
        ![401, 403].includes(r.status),
        `${method} ${path} → ${r.status}`,
      );
    }
  });

  test("sərnişin endpoint-ləri açıqdır", async () => {
    for (const path of [
      "/routes",
      "/routes/buses",
      "/analytics/crowd",
      "/density/live",
      "/ai/status",
    ]) {
      assert.equal((await api(base, path)).status, 200, path);
    }
  });
});

describe("JWT", () => {
  test("başqa açarla imzalanmış token → 401", async () => {
    const forged = jwt.sign(
      { id: "000000000000000000000000", role: "admin", tokenVersion: 0 },
      "attacker-secret",
    );
    assert.equal((await api(base, "/alerts", { token: forged })).status, 401);
  });

  test("alg=none token → 401", async () => {
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: "x", role: "admin" })}.`;
    assert.equal((await api(base, "/alerts", { token: none })).status, 401);
  });

  test("payload-da rolu dəyişmək imzanı pozur → 401", async () => {
    const [h, , s] = userToken.split(".");
    const decoded = jwt.decode(userToken);
    const tampered = `${h}.${Buffer.from(JSON.stringify({ ...decoded, role: "admin" })).toString("base64url")}.${s}`;
    assert.equal((await api(base, "/alerts", { token: tampered })).status, 401);
  });

  test("vaxtı keçmiş token → 401", async () => {
    const op = await User.findOne({ email: "operator@example.com" });
    const expired = jwt.sign(
      {
        id: String(op._id),
        role: "operator",
        tokenVersion: op.tokenVersion,
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      config.accessSecretKey,
    );
    assert.equal((await api(base, "/alerts", { token: expired })).status, 401);
  });

  test("tokenVersion dəyişəndə (çıxış / parol dəyişimi) köhnə token etibarsızdır", async () => {
    const u = await User.create({
      firstName: "R",
      lastName: "V",
      email: "rv@test.local",
      password: "x",
      role: "operator",
      status: "active",
      tokenVersion: 0,
    });
    const tok = AuthTokenService.generateAccessToken({
      id: String(u._id),
      role: "operator",
      tokenVersion: 0,
    });
    assert.equal((await api(base, "/alerts", { token: tok })).status, 200);
    u.tokenVersion = 1;
    assert.equal((await api(base, "/alerts", { token: tok })).status, 401);
  });

  test("bloklanmış hesab → 401", async () => {
    const u = await User.create({
      firstName: "B",
      lastName: "L",
      email: "bl@test.local",
      password: "x",
      role: "operator",
      status: "blocked",
      tokenVersion: 0,
    });
    const tok = AuthTokenService.generateAccessToken({
      id: String(u._id),
      role: "operator",
      tokenVersion: 0,
    });
    assert.equal((await api(base, "/alerts", { token: tok })).status, 401);
  });
});

describe("Injection və giriş məlumatlarının yoxlanması", () => {
  test("login: NoSQL operator inyeksiyası token qaytarmır", async () => {
    const r = await api(base, "/auth/login", {
      method: "POST",
      body: { email: { $gt: "" }, password: { $gt: "" } },
    });
    assert.notEqual(r.status, 200);
    assert.equal(r.body?.data?.tokens, undefined);
  });

  test("login: yanlış parol və mövcud olmayan email eyni cavabı verir (enumeration yoxdur)", async () => {
    const a = await api(base, "/auth/login", {
      method: "POST",
      body: { email: "operator@example.com", password: "wrong-pass" },
    });
    const b = await api(base, "/auth/login", {
      method: "POST",
      body: { email: "nobody@example.com", password: "wrong-pass" },
    });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.message, b.body.message);
  });

  test("query parametrində operator: /reports/recent?routeId[$ne]=x sanitizasiya olunur", async () => {
    const r = await api(base, "/reports/recent?routeId[$ne]=x&minutes[$gt]=0", {
      token: opToken,
    });
    assert.ok(r.status < 500, String(r.status));
  });

  test("prototip çirklənməsi: __proto__ gövdəsi Object.prototype-ı dəyişmir", async () => {
    await api(base, "/reports", {
      method: "POST",
      body: '{"routeId":"x","level":"low","deviceId":"p1","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}',
    });
    assert.equal({}.polluted, undefined);
    assert.equal(Object.prototype.polluted, undefined);
  });

  test("böyük JSON gövdəsi → 413", async () => {
    const r = await api(base, "/ai/chat", {
      method: "POST",
      body: { messages: [{ role: "user", content: "x".repeat(200 * 1024) }] },
    });
    assert.equal(r.status, 413);
  });

  test("səhv JSON → 400, cavabda stack trace yoxdur", async () => {
    const r = await api(base, "/reports", {
      method: "POST",
      body: "{bad json",
      headers: { "Content-Type": "application/json" },
    });
    assert.ok(r.status >= 400 && r.status < 500, String(r.status));
    const text = JSON.stringify(r.body);
    assert.ok(
      !/\bat \w+.*\.js:\d+/.test(text) && !text.includes("node_modules"),
      text,
    );
  });

  test("bildiriş siyahısı cihaz id-sini və IP hash-ini sızdırmır", async () => {
    await api(base, "/reports", {
      method: "POST",
      body: { routeId, level: "low", deviceId: "leak-check-device" },
    });
    const r = await api(base, "/reports/recent", { token: opToken });
    const text = JSON.stringify(r.body);
    assert.ok(!text.includes("leak-check-device"));
    assert.ok(!text.includes("ipHash"));
  });
});

describe("HTTP başlıqları və CORS", () => {
  test("helmet təhlükəsizlik başlıqları, X-Powered-By yoxdur", async () => {
    const r = await api(base, "/routes");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.ok(
      r.headers.get("x-frame-options") ||
        r.headers.get("content-security-policy"),
    );
    assert.equal(r.headers.get("x-powered-by"), null);
  });

  test("CORS: icazəsiz origin qəbul olunmur, client origin-i qəbul olunur", async () => {
    const evil = await api(base, "/routes", {
      headers: { Origin: "https://evil.example" },
    });
    assert.notEqual(
      evil.headers.get("access-control-allow-origin"),
      "https://evil.example",
    );
    const good = await api(base, "/routes", {
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(
      good.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );
  });

  test("dispetçer əmrinin parametrləri təmizlənir (obyekt / uzun sətir)", async () => {
    const r = await api(base, "/dispatch/commands", {
      method: "POST",
      token: opToken,
      body: {
        routeId,
        type: "SHORT_TURN",
        params: { stop: "y".repeat(5000), evil: { $where: "1" }, list: [1, 2] },
      },
    });
    assert.equal(r.status, 201);
    const p = r.body.data.command.params;
    assert.ok(p.stop.length <= 120);
    assert.equal(p.evil, undefined);
    assert.equal(p.list, undefined);
  });
});

describe("Canlı lokasiya (Sybil)", () => {
  test("bir IP-dən ən çox 3 socket mövqe göndərə bilər", () => {
    const sock = (id, ip = "10.0.0.1") => ({ id, handshake: { address: ip } });
    const results = ["s1", "s2", "s3", "s4", "s5"].map((id) =>
      socketService.allowPresence(sock(id)),
    );
    assert.deepEqual(results, [true, true, true, false, false]);
    assert.equal(
      socketService.allowPresence(sock("s1")),
      true,
      "mövcud socket davam edir",
    );
    assert.equal(
      socketService.allowPresence(sock("x", "10.0.0.2")),
      true,
      "başqa IP-yə təsir etmir",
    );
    socketService.releasePresence(sock("s1"));
    assert.equal(
      socketService.allowPresence(sock("s4")),
      true,
      "yer boşalanda yeni socket qəbul olunur",
    );
  });
});
