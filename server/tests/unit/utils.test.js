import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GeoService } from "#services";
import { pickLang, t, isValidLatLng, parsePoint, hashIp } from "#utils";
import { sanitize } from "#middlewares";
import { envProblems } from "#core/envCheck.js";

describe("i18n (server)", () => {
  test("Accept-Language → dəstəklənən dil", () => {
    assert.equal(pickLang("ru-RU,ru;q=0.9,en;q=0.8"), "ru");
    assert.equal(pickLang("de-DE,en;q=0.5"), "en");
    assert.equal(pickLang("fr"), "az");
    assert.equal(pickLang(undefined), "az");
    assert.equal(pickLang("en;q=0.1,ru;q=0.9"), "ru");
  });

  test("tərcümə, interpolasiya və fallback", () => {
    assert.match(t("en", "report.cooldown", { seconds: 30 }), /30/);
    assert.notEqual(
      t("ru", "report.cooldown", { seconds: 30 }),
      t("en", "report.cooldown", { seconds: 30 }),
    );
    assert.equal(t("en", "no.such.key"), "no.such.key");
  });
});

describe("Geo", () => {
  test("haversine: 28 May → Sahil ≈ 0.9 km", () => {
    const d = GeoService.haversine([40.3796, 49.8487], [40.3717, 49.8443]);
    assert.ok(d > 850 && d < 1000, String(d));
  });

  test("koordinat yoxlaması", () => {
    assert.equal(isValidLatLng(40.4, 49.8), true);
    assert.equal(isValidLatLng(91, 49.8), false);
    assert.equal(isValidLatLng("40", 49.8), false);
    assert.equal(isValidLatLng(NaN, 1), false);
    assert.deepEqual(
      parsePoint({ lat: "40.4", lng: "49.8", name: "x".repeat(500) }).name
        .length,
      120,
    );
    assert.throws(
      () => parsePoint({ lat: "abc", lng: 1 }),
      (e) => e.statusCode === 400,
    );
  });
});

describe("Təhlükəsizlik köməkçiləri", () => {
  test("sanitizer: Mongo operatorları və prototip açarları silinir", () => {
    const dirty = JSON.parse(
      '{"email":{"$gt":""},"a":{"b":{"$where":"1"}},"__proto__":{"admin":true},"constructor":{"x":1},"ok":1}',
    );
    const clean = sanitize(dirty);
    assert.deepEqual(clean.email, {});
    assert.deepEqual(clean.a, { b: {} });
    assert.equal(clean.ok, 1);
    assert.equal(Object.hasOwn(clean, "constructor"), false);
    assert.equal({}.admin, undefined, "Object.prototype çirklənmir");
  });

  test("IP hash: deterministik, geri çevrilməz, IP-ni ehtiva etmir", () => {
    const a = hashIp("192.168.1.10");
    assert.equal(a, hashIp("192.168.1.10"));
    assert.notEqual(a, hashIp("192.168.1.11"));
    assert.equal(a.length, 16);
    assert.ok(!a.includes("192"));
    assert.equal(hashIp(undefined), undefined);
  });

  test("prodakşn: defolt sirlər və demo parolları rədd edilir", () => {
    const weak = envProblems({ MONGODB_URI: "mongodb://x" });
    for (const k of [
      "ACCESS_SECRET_KEY",
      "REFRESH_SECRET_KEY",
      "ENCRYPTION_KEY",
      "DEFAULT_ADMIN_PASSWORD",
      "DEFAULT_OPERATOR_PASSWORD",
    ]) {
      assert.ok(weak.includes(k), k);
    }
    const strong = envProblems({
      MONGODB_URI: "mongodb://x",
      ACCESS_SECRET_KEY: "a".repeat(40),
      REFRESH_SECRET_KEY: "b".repeat(40),
      ENCRYPTION_KEY: "c".repeat(32),
      DEFAULT_ADMIN_PASSWORD: "S3cure!pass",
      DEFAULT_OPERATOR_EMAIL: "",
    });
    assert.deepEqual(strong, []);
  });
});
