/**
 * Gözlənilən gəliş vaxtı (ETA) hesablanması.
 * Avtobus xətt boyunca irəli-geri (gediş/qayıdış) hərəkət edir, buna görə dayanacağa
 * çatmaq üçün qalan məsafə istiqamət nəzərə alınaraq hesablanır.
 */
const config = require('../config');

function distanceToStop(bus, stopD, length) {
  const d = bus.distance;
  if (bus.direction === 1) {
    return stopD >= d - 0.5 ? stopD - d : length - d + (length - stopD);
  }
  return stopD <= d + 0.5 ? d - stopD : d + stopD;
}

/** Avtobusla dayanacaq arasında keçiləcək dayanacaqların sayı */
function stopsBetween(bus, stopD, geom) {
  const L = geom.length;
  const d = bus.distance;
  let n = 0;
  for (const s of geom.stopDist) {
    if (Math.abs(s - stopD) < 1) continue;
    if (bus.direction === 1) {
      if (stopD >= d) { if (s > d + 0.5 && s < stopD) n++; }
      else { if (s > d + 0.5) n++; if (s > stopD && s < L) n++; }
    } else {
      if (stopD <= d) { if (s < d - 0.5 && s > stopD) n++; }
      else { if (s < d - 0.5) n++; if (s < stopD && s > 0) n++; }
    }
  }
  return n;
}

function etaForStop(fleet, routeId, stopIndex, limit = 3) {
  const r = fleet.getRoute(routeId);
  if (!r) return null;
  const { geom, route } = r;
  const stopD = geom.stopDist[stopIndex];
  if (stopD === undefined) return null;
  const now = Date.now();

  const items = fleet.busesForRoute(routeId).map((bus) => {
    const dist = distanceToStop(bus, stopD, geom.length);
    const between = stopsBetween(bus, stopD, geom);
    const dwellLeft = Math.max(0, (bus.dwellUntil - now) / 1000);
    const etaSec = dist < 15 ? 0 : Math.round(dist / bus.speed + between * config.sim.dwellSec + dwellLeft);
    // Avtobus dayanacaqdan bu istiqamətdə hansı terminala gedəcək
    const arrivesHeading =
      bus.direction === 1
        ? stopD >= bus.distance - 0.5 ? 1 : -1
        : stopD <= bus.distance + 0.5 ? -1 : 1;
    return {
      busId: bus.id,
      plate: bus.plate,
      isReserve: bus.isReserve,
      distanceM: Math.round(dist),
      stopsAway: between,
      etaSec,
      headsign: arrivesHeading === 1 ? route.stops[route.stops.length - 1].name : route.stops[0].name,
    };
  });
  items.sort((a, b) => a.etaSec - b.etaSec);
  return items.slice(0, limit);
}

/**
 * Avtobusun stopD nöqtəsinə MÜƏYYƏN istiqamətdə (dirNeeded) gəlməsi üçün qət edəcəyi məsafə.
 * Marşrut planlayıcısı üçün: sərnişin A→B getmək üçün düzgün istiqamətdə gedən avtobusa minməlidir.
 */
function travelInDirection(bus, stopD, dirNeeded, L) {
  const d = bus.distance;
  if (bus.direction === dirNeeded) {
    if (dirNeeded === 1) return stopD >= d - 0.5 ? stopD - d : L - d + L + stopD;
    return stopD <= d + 0.5 ? d - stopD : d + L + (L - stopD);
  }
  // avtobus əks istiqamətdə gedir — terminala çatıb dönəcək
  return bus.direction === 1 ? L - d + (L - stopD) : d + stopD;
}

/** Avtobusun dayanacağa düzgün istiqamətdə çatma vaxtı (saniyə) */
function etaInDirection(bus, stopD, dirNeeded, geom, now = Date.now()) {
  const dist = travelInDirection(bus, stopD, dirNeeded, geom.length);
  const spacing = geom.length / Math.max(geom.stopDist.length - 1, 1);
  const stopsPassed = Math.max(0, Math.round(dist / spacing) - 1);
  const dwellLeft = Math.max(0, (bus.dwellUntil - now) / 1000);
  return dist < 15 ? dwellLeft : dist / bus.speed + stopsPassed * config.sim.dwellSec + dwellLeft;
}

/** Bir avtobusun tam dövrəsi (gediş + qayıdış), saniyə */
function cycleSec(geom) {
  const v = config.sim.avgSpeedKmh / 3.6;
  return (2 * geom.length) / v + 2 * (geom.stopDist.length - 1) * config.sim.dwellSec + 2 * config.sim.dwellSec;
}

/** İki dayanacaq arasında gediş vaxtı (saniyə) */
function rideSec(geom, fromIdx, toIdx) {
  const v = config.sim.avgSpeedKmh / 3.6;
  const dist = Math.abs(geom.stopDist[toIdx] - geom.stopDist[fromIdx]);
  const between = Math.max(0, Math.abs(toIdx - fromIdx) - 1);
  return dist / v + between * config.sim.dwellSec;
}

module.exports = { etaForStop, distanceToStop, stopsBetween, travelInDirection, etaInDirection, cycleSec, rideSec };
