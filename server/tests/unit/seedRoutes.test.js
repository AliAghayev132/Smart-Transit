import { test } from "node:test";
import assert from "node:assert/strict";
import { seedRoutes } from "#constants";
import { GeoService } from "#services";

// Bakı (Abşeron) sərhədləri — bütün nöqtələr şəhər daxilində olmalıdır
const inBaku = ([lat, lng]) =>
  lat > 40.25 && lat < 40.62 && lng > 49.6 && lng < 50.3;

test("seed xətləri: unikal nömrə, düzgün həndəsə, dayanacaqlar marşrut üzərindədir", () => {
  const numbers = seedRoutes.map((r) => r.number);
  assert.equal(new Set(numbers).size, numbers.length);
  assert.ok(seedRoutes.length >= 10, "şəhəri əhatə edən kifayət qədər xətt");
  for (const r of seedRoutes) {
    assert.ok(r.stops.length >= 3, r.number);
    assert.ok(r.buses > 0);
    assert.match(r.color, /^#[0-9a-f]{6}$/i);
    assert.ok(r.path.every(inBaku), `${r.number}: path Bakıdan kənardadır`);
    const geom = GeoService.buildGeometry({ ...r, stops: r.stops });
    // dayanacaqlar marşrut boyunca ardıcıl düzülməlidir
    for (let i = 1; i < geom.stopDist.length; i++)
      assert.ok(
        geom.stopDist[i] > geom.stopDist[i - 1],
        `${r.number} dayanacaq ${i}`,
      );
    for (const s of r.stops)
      assert.ok(
        GeoService.project(geom, s.lat, s.lng).offset < 5,
        `${r.number}: ${s.name} xətdən kənardadır`,
      );
  }
});
