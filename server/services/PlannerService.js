import { config } from "#config";
import { GeoService } from "#services/GeoService.js";
import { EtaService } from "#services/EtaService.js";

const RANK = { unknown: 0, low: 1, mid: 2, high: 3 };
const worst = (levels) =>
  levels.reduce((w, l) => (RANK[l] > RANK[w] ? l : w), "unknown");

/**
 * PlannerService (static)
 * "Haradan → Haraya" marşrut mühərriki öz xətlərimiz üzərində:
 *   piyada → avtobus → (köçürmə → avtobus) → piyada
 *  - gözləmə vaxtı CANLI avtobus mövqelərindən (düzgün istiqamətdə gələn avtobus);
 *  - hər avtobus mərhələsinə sıxlıq (avtobus → seqment → xətt);
 *  - "Ən sürətli" və "Ən rahat" (sıxlıq cəriməsi ilə) sıralaması.
 * Kiçik şəbəkə üçün tam axtarış; yüzlərlə xətt üçün RAPTOR/CSA tövsiyə olunur.
 */
class PlannerService {
  static get cfg() {
    return config.transit.planner;
  }

  static walkLeg(from, to) {
    const distanceM = Math.round(
      GeoService.haversine([from.lat, from.lng], [to.lat, to.lng]) *
        this.cfg.walkDetour,
    );
    return {
      type: "walk",
      from,
      to,
      distanceM,
      durationSec: Math.round(distanceM / this.cfg.walkSpeedMs),
      path: [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
    };
  }

  static stopPoint(route, idx) {
    const s = route.stops[idx];
    return { stopId: String(s._id), name: s.name, lat: s.lat, lng: s.lng };
  }

  /** Dayanacaqdan dir istiqamətində, earliestSec-dən tez olmayaraq gələn ilk avtobus */
  static nextDeparture(fleet, routeId, geom, stopIdx, dir, earliestSec, now) {
    const buses = fleet.busesForRoute(routeId);
    if (!buses.length) return null;
    const stopD = geom.stopDist[stopIdx];
    const cyc = EtaService.cycleSec(geom);
    let best = null;
    for (const bus of buses) {
      const eta = EtaService.inDirection(bus, stopD, dir, geom, now);
      let t = eta;
      let guard = 0;
      while (t < earliestSec && guard++ < 6) t += cyc; // bu reysə çatmırıq → növbəti dövrə
      if (!best || t < best.t) best = { bus, t, live: t === eta };
    }
    return best;
  }

  static legCrowd(crowd, routeId, busId, fromIdx, toIdx) {
    if (!crowd) return { level: "unknown", source: "none" };
    const b = crowd.buses[busId];
    if (b && b.level !== "unknown")
      return {
        level: b.level,
        source: "bus",
        reports: b.total,
        loadPct: b.loadPct ?? null,
      };
    const r = crowd.routes.find((x) => x.routeId === String(routeId));
    if (!r) return { level: "unknown", source: "none", loadPct: null };
    const lo = Math.min(fromIdx, toIdx);
    const hi = Math.max(fromIdx, toIdx);
    const segs = r.segments.filter(
      (s) => s.index >= lo && s.index < hi && s.level !== "unknown",
    );
    const seg = worst(segs.map((s) => s.level));
    if (seg !== "unknown") {
      const loads = segs.map((s) => s.loadPct).filter((v) => v != null);
      return {
        level: seg,
        source: "segment",
        loadPct: loads.length ? Math.max(...loads) : null,
      };
    }
    return {
      level: r.level,
      source: r.level === "unknown" ? "none" : "route",
      loadPct: r.loadPct ?? null,
    };
  }

  static busLeg({ route, geom, fromIdx, toIdx, dep, startSec, crowd }) {
    const dir = Math.sign(geom.stopDist[toIdx] - geom.stopDist[fromIdx]);
    const ride = Math.round(EtaService.rideSec(geom, fromIdx, toIdx));
    const waitSec = Math.max(0, Math.round(dep.t - startSec));
    return {
      type: "bus",
      routeId: String(route._id),
      number: route.number,
      name: route.name,
      color: route.color,
      busId: dep.bus.id,
      plate: dep.bus.plate,
      isReserve: dep.bus.isReserve,
      live: dep.live,
      headsign:
        dir === 1
          ? route.stops[route.stops.length - 1].name
          : route.stops[0].name,
      from: this.stopPoint(route, fromIdx),
      to: this.stopPoint(route, toIdx),
      departInSec: Math.round(dep.t),
      waitSec,
      rideSec: ride,
      durationSec: waitSec + ride,
      stopsCount: Math.abs(toIdx - fromIdx),
      distanceM: Math.round(
        Math.abs(geom.stopDist[toIdx] - geom.stopDist[fromIdx]),
      ),
      crowd: this.legCrowd(crowd, route._id, dep.bus.id, fromIdx, toIdx),
      path: GeoService.slicePath(
        geom,
        geom.stopDist[fromIdx],
        geom.stopDist[toIdx],
      ),
    };
  }

  static finalize(legs, now, source = "smart-transit") {
    const totalSec = legs.reduce((s, l) => s + l.durationSec, 0);
    const busLegs = legs.filter((l) => l.type !== "walk");
    const penalty = busLegs.reduce(
      (s, l) =>
        s + (this.cfg.crowdPenaltyMin[l.crowd?.level || "unknown"] || 0),
      0,
    );
    return {
      id: `${source}:${legs.map((l) => (l.type === "walk" ? "w" : `${l.number}@${l.from?.stopId || l.from?.name}`)).join("-")}`,
      source,
      legs,
      totalSec,
      walkM: legs
        .filter((l) => l.type === "walk")
        .reduce((s, l) => s + l.distanceM, 0),
      transfers: Math.max(0, busLegs.length - 1),
      departInSec: busLegs.length ? busLegs[0].departInSec : 0,
      arriveAt: new Date(now + totalSec * 1000).toISOString(),
      crowd: worst(busLegs.map((l) => l.crowd?.level || "unknown")),
      loadPct: busLegs.some((l) => l.crowd?.loadPct != null)
        ? Math.max(...busLegs.map((l) => l.crowd?.loadPct ?? 0))
        : null,
      comfortScore: totalSec + penalty * 60,
      // Dildən asılı olmayan qısa xülasə (xətt nömrələri); yalnız piyada → "🚶"
      summary: busLegs.length ? busLegs.map((l) => l.number).join(" → ") : "🚶",
      tags: [],
    };
  }

  /**
   * from, to: { lat, lng, name? }; prefer: "fast" | "comfort"
   */
  static plan(fleet, crowd, from, to, { prefer = "fast", limit = 6 } = {}) {
    const now = Date.now();
    const c = this.cfg;
    const results = [];
    const routes = [...fleet.routes.values()];

    const near = (pt, route, maxM) =>
      route.stops
        .map((s, idx) => ({
          idx,
          m:
            GeoService.haversine([pt.lat, pt.lng], [s.lat, s.lng]) *
            c.walkDetour,
        }))
        .filter((x) => x.m <= maxM)
        .sort((a, b) => a.m - b.m)
        .slice(0, 3);

    // 0) Yalnız piyada
    const direct = this.walkLeg(from, to);
    if (direct.distanceM <= 2500) results.push(this.finalize([direct], now));

    // 1) Birbaşa (köçürməsiz)
    const bestDirect = new Map();
    for (const { route, geom } of routes) {
      const rid = String(route._id);
      for (const b of near(from, route, c.maxWalkM)) {
        for (const a of near(to, route, c.maxWalkM)) {
          if (a.idx === b.idx) continue;
          const dir = Math.sign(geom.stopDist[a.idx] - geom.stopDist[b.idx]);
          const w1 = this.walkLeg(from, this.stopPoint(route, b.idx));
          const dep = this.nextDeparture(
            fleet,
            rid,
            geom,
            b.idx,
            dir,
            w1.durationSec,
            now,
          );
          if (!dep) continue;
          const leg = this.busLeg({
            route,
            geom,
            fromIdx: b.idx,
            toIdx: a.idx,
            dep,
            startSec: w1.durationSec,
            crowd,
          });
          const it = this.finalize(
            [w1, leg, this.walkLeg(this.stopPoint(route, a.idx), to)],
            now,
          );
          const cur = bestDirect.get(rid);
          if (!cur || it.totalSec < cur.totalSec) bestDirect.set(rid, it);
        }
      }
    }
    results.push(...bestDirect.values());
    const bestDirectSec = Math.min(
      ...[...bestDirect.values()].map((i) => i.totalSec),
      Infinity,
    );

    // 2) Bir köçürmə ilə
    const bestTransfer = new Map();
    for (const r1 of routes) {
      const id1 = String(r1.route._id);
      const boards = near(from, r1.route, c.maxWalkM);
      if (!boards.length) continue;
      for (const r2 of routes) {
        const id2 = String(r2.route._id);
        if (id1 === id2) continue;
        const alights = near(to, r2.route, c.maxWalkM);
        if (!alights.length) continue;
        r1.route.stops.forEach((s1, t1) => {
          r2.route.stops.forEach((s2, t2) => {
            if (
              GeoService.haversine([s1.lat, s1.lng], [s2.lat, s2.lng]) *
                c.walkDetour >
              c.transferWalkM
            )
              return;
            for (const b of boards) {
              if (b.idx === t1) continue;
              for (const a of alights) {
                if (a.idx === t2) continue;
                const dir1 = Math.sign(
                  r1.geom.stopDist[t1] - r1.geom.stopDist[b.idx],
                );
                const dir2 = Math.sign(
                  r2.geom.stopDist[a.idx] - r2.geom.stopDist[t2],
                );
                const w1 = this.walkLeg(from, this.stopPoint(r1.route, b.idx));
                const dep1 = this.nextDeparture(
                  fleet,
                  id1,
                  r1.geom,
                  b.idx,
                  dir1,
                  w1.durationSec,
                  now,
                );
                if (!dep1) continue;
                const leg1 = this.busLeg({
                  route: r1.route,
                  geom: r1.geom,
                  fromIdx: b.idx,
                  toIdx: t1,
                  dep: dep1,
                  startSec: w1.durationSec,
                  crowd,
                });
                const tLeg = this.walkLeg(
                  this.stopPoint(r1.route, t1),
                  this.stopPoint(r2.route, t2),
                );
                const atT2 =
                  w1.durationSec + leg1.durationSec + tLeg.durationSec;
                const dep2 = this.nextDeparture(
                  fleet,
                  id2,
                  r2.geom,
                  t2,
                  dir2,
                  atT2,
                  now,
                );
                if (!dep2) continue;
                const leg2 = this.busLeg({
                  route: r2.route,
                  geom: r2.geom,
                  fromIdx: t2,
                  toIdx: a.idx,
                  dep: dep2,
                  startSec: atT2,
                  crowd,
                });
                const w2 = this.walkLeg(this.stopPoint(r2.route, a.idx), to);
                const legs =
                  tLeg.distanceM > 20
                    ? [w1, leg1, tLeg, leg2, w2]
                    : [w1, leg1, leg2, w2];
                const it = this.finalize(legs, now);
                const key = `${id1}>${id2}`;
                const cur = bestTransfer.get(key);
                if (!cur || it.totalSec < cur.totalSec)
                  bestTransfer.set(key, it);
              }
            }
          });
        });
      }
    }
    for (const it of bestTransfer.values()) {
      if (it.totalSec <= bestDirectSec + 10 * 60) results.push(it);
    }

    return this.rank(results, prefer, limit);
  }

  static rank(results, prefer, limit) {
    if (!results.length) return [];
    const fastest = results.reduce((m, x) => (x.totalSec < m.totalSec ? x : m));
    const transit = results.filter((x) =>
      x.legs.some((l) => l.type !== "walk"),
    );
    const comfiest = transit.length
      ? transit.reduce((m, x) => (x.comfortScore < m.comfortScore ? x : m))
      : null;
    fastest.tags.push("fastest");
    if (comfiest) comfiest.tags.push("comfort");
    const key = prefer === "comfort" ? "comfortScore" : "totalSec";
    return results
      .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)
      .sort((a, b) => a[key] - b[key])
      .slice(0, limit);
  }
}

export { PlannerService };
