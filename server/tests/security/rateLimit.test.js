/**
 * Rate limit (ayrıca proses — limit sayğacları digər testlərə təsir etmir).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, api } from "../support/app.js";

let base, close, routeId;
before(async () => {
  ({ base, close } = await startTestApp());
  routeId = (await api(base, "/routes")).body.data.routes[0].id;
});
after(() => close());

test("bildiriş: dəqiqədə 20-dən çox → 429 (fərqli deviceId ilə belə)", async () => {
  const statuses = [];
  for (let i = 0; i < 22; i++) {
    const r = await api(base, "/reports", {
      method: "POST",
      body: { routeId, level: "low", deviceId: `rl-${i}` },
    });
    statuses.push(r.status);
  }
  assert.ok(
    statuses.slice(0, 20).every((s) => s === 201),
    statuses.join(","),
  );
  assert.equal(statuses.at(-1), 429);
});

test("login: 15 dəqiqədə 10-dan çox cəhd → 429 (brute force qorunması)", async () => {
  let last;
  for (let i = 0; i < 11; i++)
    last = await api(base, "/auth/login", {
      method: "POST",
      body: { email: "operator@example.com", password: `guess-${i}` },
    });
  assert.equal(last.status, 429);
});

test("AI chatbot: dəqiqədə 15-dən çox → 429 (xərc qorunması)", async () => {
  let last;
  for (let i = 0; i < 16; i++)
    last = await api(base, "/ai/chat", {
      method: "POST",
      body: { messages: [{ role: "user", content: "salam" }] },
    });
  assert.equal(last.status, 429);
});

test("«Gedirəm»: dəqiqədə 10-dan çox → 429", async () => {
  let last;
  for (let i = 0; i < 11; i++)
    last = await api(base, "/intents/none-" + i, { method: "DELETE" });
  assert.equal(last.status, 429);
});
