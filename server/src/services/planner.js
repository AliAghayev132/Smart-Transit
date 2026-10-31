/**
 * Marşrut planlayıcısı (Haradan → Haraya).
 *
 * Öz xətlərimiz üzərində işləyir:  piyada → avtobus → (köçürmə → avtobus) → piyada
 *  - gözləmə vaxtı CANLI avtobus mövqelərindən hesablanır (istiqamət nəzərə alınır);
 *  - hər avtobus mərhələsinə sıxlıq (avtobus → seqment → xətt) əlavə olunur;
 *  - nəticələr iki cür sıralanır: "Ən sürətli" və "Ən rahat" (sıxlıq cəriməsi ilə).
 *
 * Kiçik şəbəkə üçün tam axtarış kifayətdir. Yüzlərlə xətt olduqda RAPTOR/CSA alqoritminə keçmək tövsiyə olunur.
 */
const config = require('../config');
const { haversine, slicePath } = require('./geo');
const { etaInDirection, cycleSec, rideSec } = require('./eta');

const RANK = { unknown: 0, low: 1, mid: 2, high: 3 };
const worst = (levels) => levels.reduce((w, l) => (RANK[l] > RANK[w] ? l : w), 'unknown');

function walkLeg(from, to) {
  const c = config.planner;
  const distanceM = Math.round(haversine([from.lat, from.lng], [to.lat, to.lng]) * c.walkDetour);
  return {
    type: 'walk',
    from,
    to,
    distanceM,
    durationSec: Math.round(distanceM / c.walkSpeedMs),
    path: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
  };
}

const stopPoint = (route, idx) => {
  const s = route.stops[idx];
  return { stopId: String(s._id), name: s.name, lat: s.lat, lng: s.lng };
};

/** Müəyyən dayanacaqdan müəyyən istiqamətdə, earliestSec-dən gec olmayaraq gələn ilk avtobus */
function nextDeparture(fleet, routeId, geom, stopIdx, dir, earliestSec, now) {
  const buses = fleet.busesForRoute(routeId);
  if (!buses.length) return null;
  const stopD = geom.stopDist[stopIdx];
  const cyc = cycleSec(geom);
  let best = null;
  for (const bus of buses) {
    const eta = etaInDirection(bus, stopD, dir, geom, now);
    let t = eta;
    let guard = 0;
    while (t < earliestSec && guard++ < 6) t += cyc; // bu avtobusa çatmırıq → növbəti dövrəsi
    if (!best || t < best.t) best = { bus, t, live: t === eta };
  }
  return best;
}

function legCrowd(crowd, routeId, busId, fromIdx, toIdx) {
  if (!crowd) return { level: 'unknown', source: 'none' };
  const b = crowd.buses[busId];
  if (b && b.level !== 'unknown') return { level: b.level, source: 'bus', reports: b.total };
  const r = crowd.routes.find((x) => x.routeId === String(routeId));
  if (!r) return { level: 'unknown', source: 'none' };
  const lo = Math.min(fromIdx, toIdx), hi = Math.max(fromIdx, toIdx);
  const seg = worst(r.segments.filter((s) => s.index >= lo && s.index < hi).map((s) => s.level));
  if (seg !== 'unknown') return { level: seg, source: 'segment' };
  return { level: r.level, source: r.level === 'unknown' ? 'none' : 'route' };
}

function busLeg({ route, geom, fromIdx, toIdx, dep, startSec, crowd }) {
  const dir = Math.sign(geom.stopDist[toIdx] - geom.stopDist[fromIdx]);
  const ride = Math.round(rideSec(geom, fromIdx, toIdx));
  const waitSec = Math.max(0, Math.round(dep.t - startSec));
  return {
    type: 'bus',
    routeId: String(route._id),
    number: route.number,
    name: route.name,
    color: route.color,
    busId: dep.bus.id,
    plate: dep.bus.plate,
    isReserve: dep.bus.isReserve,
    live: dep.live,
    headsign: dir === 1 ? route.stops[route.stops.length - 1].name : route.stops[0].name,
    from: stopPoint(route, fromIdx),
    to: stopPoint(route, toIdx),
    departInSec: Math.round(dep.t),
    waitSec,
    rideSec: ride,
    durationSec: waitSec + ride,
    stopsCount: Math.abs(toIdx - fromIdx),
    distanceM: Math.round(Math.abs(geom.stopDist[toIdx] - geom.stopDist[fromIdx])),
    crowd: legCrowd(crowd, route._id, dep.bus.id, fromIdx, toIdx),
    path: slicePath(geom, geom.stopDist[fromIdx], geom.stopDist[toIdx]),
  };
}

function finalize(legs, now, source = 'smart-transit') {
  const totalSec = legs.reduce((s, l) => s + l.durationSec, 0);
  const busLegs = legs.filter((l) => l.type !== 'walk');
  const crowdLevel = worst(busLegs.map((l) => l.crowd?.level || 'unknown'));
  const penalty = busLegs.reduce((s, l) => s + (config.planner.crowdPenaltyMin[l.crowd?.level || 'unknown'] || 0), 0);
  return {
    id: `${source}:${legs.map((l) => (l.type === 'walk' ? 'w' : `${l.number}@${l.from?.stopId || l.from?.name}`)).join('-')}`,
    source,
    legs,
    totalSec,
    walkM: legs.filter((l) => l.type === 'walk').reduce((s, l) => s + l.distanceM, 0),
    transfers: Math.max(0, busLegs.length - 1),
    departInSec: busLegs.length ? busLegs[0].departInSec : 0,
    arriveAt: new Date(now + totalSec * 1000).toISOString(),
    crowd: crowdLevel,
    comfortScore: totalSec + penalty * 60,
    summary: busLegs.length ? busLegs.map((l) => l.number).join(' → ') : 'Piyada',
    tags: [],
  };
}

/**
 * from, to: { lat, lng, name? }
 * prefer: 'fast' | 'comfort'
 */
function plan(fleet, crowd, from, to, { prefer = 'fast', limit = 6 } = {}) {
  const now = Date.now();
  const c = config.planner;
  const results = [];
  const routes = [...fleet.routes.values()];

  const near = (pt, route, maxM) =>
    route.stops
      .map((s, idx) => ({ idx, m: haversine([pt.lat, pt.lng], [s.lat, s.lng]) * c.walkDetour }))
      .filter((x) => x.m <= maxM)
      .sort((a, b) => a.m - b.m)
      .slice(0, 3);

  // 0) Yalnız piyada (qısa məsafələr üçün)
  const direct = walkLeg(from, to);
  if (direct.distanceM <= 2500) results.push(finalize([direct], now));

  // 1) Birbaşa (köçürməsiz)
  const bestDirectByRoute = new Map();
  for (const { route, geom } of routes) {
    const rid = String(route._id);
    for (const b of near(from, route, c.maxWalkM)) {
      for (const a of near(to, route, c.maxWalkM)) {
        if (a.idx === b.idx) continue;
        const dir = Math.sign(geom.stopDist[a.idx] - geom.stopDist[b.idx]);
        const w1 = walkLeg(from, stopPoint(route, b.idx));
        const dep = nextDeparture(fleet, rid, geom, b.idx, dir, w1.durationSec, now);
        if (!dep) continue;
        const leg = busLeg({ route, geom, fromIdx: b.idx, toIdx: a.idx, dep, startSec: w1.durationSec, crowd });
        const w2 = walkLeg(stopPoint(route, a.idx), to);
        const it = finalize([w1, leg, w2], now);
        const cur = bestDirectByRoute.get(rid);
        if (!cur || it.totalSec < cur.totalSec) bestDirectByRoute.set(rid, it);
      }
    }
  }
  results.push(...bestDirectByRoute.values());
  const bestDirect = Math.min(...[...bestDirectByRoute.values()].map((i) => i.totalSec), Infinity);

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
      // köçürmə cütləri: r1-in dayanacağı t1 ↔ r2-nin dayanacağı t2 (piyada məsafəsində)
      r1.route.stops.forEach((s1, t1) => {
        r2.route.stops.forEach((s2, t2) => {
          const tw = haversine([s1.lat, s1.lng], [s2.lat, s2.lng]) * c.walkDetour;
          if (tw > c.transferWalkM) return;
          for (const b of boards) {
            if (b.idx === t1) continue;
            for (const a of alights) {
              if (a.idx === t2) continue;
              const dir1 = Math.sign(r1.geom.stopDist[t1] - r1.geom.stopDist[b.idx]);
              const dir2 = Math.sign(r2.geom.stopDist[a.idx] - r2.geom.stopDist[t2]);
              const w1 = walkLeg(from, stopPoint(r1.route, b.idx));
              const dep1 = nextDeparture(fleet, id1, r1.geom, b.idx, dir1, w1.durationSec, now);
              if (!dep1) continue;
              const leg1 = busLeg({ route: r1.route, geom: r1.geom, fromIdx: b.idx, toIdx: t1, dep: dep1, startSec: w1.durationSec, crowd });
              const tLeg = walkLeg(stopPoint(r1.route, t1), stopPoint(r2.route, t2));
              const atT2 = w1.durationSec + leg1.durationSec + tLeg.durationSec;
              const dep2 = nextDeparture(fleet, id2, r2.geom, t2, dir2, atT2, now);
              if (!dep2) continue;
              const leg2 = busLeg({ route: r2.route, geom: r2.geom, fromIdx: t2, toIdx: a.idx, dep: dep2, startSec: atT2, crowd });
              const w2 = walkLeg(stopPoint(r2.route, a.idx), to);
              const legs = tLeg.distanceM > 20 ? [w1, leg1, tLeg, leg2, w2] : [w1, leg1, leg2, w2];
              const it = finalize(legs, now);
              const key = `${id1}>${id2}`;
              const cur = bestTransfer.get(key);
              if (!cur || it.totalSec < cur.totalSec) bestTransfer.set(key, it);
            }
          }
        });
      });
    }
  }
  // köçürməli variant yalnız birbaşadan çox da gec deyilsə maraqlıdır
  for (const it of bestTransfer.values()) if (it.totalSec <= bestDirect + 10 * 60) results.push(it);

  return rank(results, prefer, limit);
}

function rank(results, prefer, limit) {
  if (!results.length) return [];
  const fastest = results.reduce((m, x) => (x.totalSec < m.totalSec ? x : m));
  const transit = results.filter((x) => x.legs.some((l) => l.type !== 'walk'));
  const comfiest = transit.length ? transit.reduce((m, x) => (x.comfortScore < m.comfortScore ? x : m)) : null;
  fastest.tags.push('fastest');
  if (comfiest) comfiest.tags.push('comfort');
  const key = prefer === 'comfort' ? 'comfortScore' : 'totalSec';
  return results
    .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)
    .sort((a, b) => a[key] - b[key])
    .slice(0, limit);
}

module.exports = { plan, rank, walkLeg, finalize };
