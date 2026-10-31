import { config } from "#config";

/**
 * EtaService (static)
 * Gözlənilən gəliş vaxtı. Avtobuslar xətt boyunca gediş/qayıdış edir,
 * ona görə qalan məsafə istiqamət nəzərə alınaraq hesablanır.
 */
class EtaService {
  static get sim() {
    return config.transit.sim;
  }

  /** Avtobusun stopD-yə (cari hərəkət istiqamətində, lazım olsa dönərək) məsafəsi */
  static distanceToStop(bus, stopD, length) {
    const d = bus.distance;
    if (bus.direction === 1) {
      return stopD >= d - 0.5 ? stopD - d : length - d + (length - stopD);
    }
    return stopD <= d + 0.5 ? d - stopD : d + stopD;
  }

  /** Avtobusla dayanacaq arasında keçiləcək dayanacaqların sayı */
  static stopsBetween(bus, stopD, geom) {
    const L = geom.length;
    const d = bus.distance;
    let n = 0;
    for (const s of geom.stopDist) {
      if (Math.abs(s - stopD) < 1) continue;
      if (bus.direction === 1) {
        if (stopD >= d) {
          if (s > d + 0.5 && s < stopD) n++;
        } else {
          if (s > d + 0.5) n++;
          if (s > stopD && s < L) n++;
        }
      } else if (stopD <= d) {
        if (s < d - 0.5 && s > stopD) n++;
      } else {
        if (s < d - 0.5) n++;
        if (s < stopD && s > 0) n++;
      }
    }
    return n;
  }

  /** Dayanacağa gələn ən yaxın avtobuslar */
  static forStop(fleet, routeId, stopIndex, limit = 4) {
    const r = fleet.getRoute(routeId);
    if (!r) return null;
    const { geom, route } = r;
    const stopD = geom.stopDist[stopIndex];
    if (stopD === undefined) return null;
    const now = Date.now();

    const items = fleet.busesForRoute(routeId).map((bus) => {
      const dist = this.distanceToStop(bus, stopD, geom.length);
      const between = this.stopsBetween(bus, stopD, geom);
      const dwellLeft = Math.max(0, (bus.dwellUntil - now) / 1000);
      const etaSec =
        dist < 15
          ? 0
          : Math.round(
              dist / bus.speed + between * this.sim.dwellSec + dwellLeft,
            );
      const heading =
        bus.direction === 1
          ? stopD >= bus.distance - 0.5
            ? 1
            : -1
          : stopD <= bus.distance + 0.5
            ? -1
            : 1;
      return {
        busId: bus.id,
        plate: bus.plate,
        isReserve: bus.isReserve,
        distanceM: Math.round(dist),
        stopsAway: between,
        etaSec,
        headsign:
          heading === 1
            ? route.stops[route.stops.length - 1].name
            : route.stops[0].name,
      };
    });
    return items.sort((a, b) => a.etaSec - b.etaSec).slice(0, limit);
  }

  /** Avtobusun stopD nöqtəsinə MÜƏYYƏN istiqamətdə (dirNeeded) çatması üçün məsafə */
  static travelInDirection(bus, stopD, dirNeeded, L) {
    const d = bus.distance;
    if (bus.direction === dirNeeded) {
      if (dirNeeded === 1)
        return stopD >= d - 0.5 ? stopD - d : L - d + L + stopD;
      return stopD <= d + 0.5 ? d - stopD : d + L + (L - stopD);
    }
    // əks istiqamətdə gedir — terminala çatıb dönəcək
    return bus.direction === 1 ? L - d + (L - stopD) : d + stopD;
  }

  /** Düzgün istiqamətdə gəliş vaxtı (saniyə) — planlayıcı üçün */
  static inDirection(bus, stopD, dirNeeded, geom, now = Date.now()) {
    const dist = this.travelInDirection(bus, stopD, dirNeeded, geom.length);
    const spacing = geom.length / Math.max(geom.stopDist.length - 1, 1);
    const stopsPassed = Math.max(0, Math.round(dist / spacing) - 1);
    const dwellLeft = Math.max(0, (bus.dwellUntil - now) / 1000);
    return dist < 15
      ? dwellLeft
      : dist / bus.speed + stopsPassed * this.sim.dwellSec + dwellLeft;
  }

  /** Bir avtobusun tam dövrəsi (gediş + qayıdış), saniyə */
  static cycleSec(geom) {
    const v = this.sim.avgSpeedKmh / 3.6;
    return (2 * geom.length) / v + 2 * geom.stopDist.length * this.sim.dwellSec;
  }

  /** İki dayanacaq arasında gediş vaxtı (saniyə) */
  static rideSec(geom, fromIdx, toIdx) {
    const v = this.sim.avgSpeedKmh / 3.6;
    const dist = Math.abs(geom.stopDist[toIdx] - geom.stopDist[fromIdx]);
    return (
      dist / v + Math.max(0, Math.abs(toIdx - fromIdx) - 1) * this.sim.dwellSec
    );
  }

  /** Orta interval (dəq) = dövrə / avtobus sayı */
  static headwayMin(geom, busCount) {
    if (!busCount) return null;
    return Math.round(this.cycleSec(geom) / busCount / 60);
  }
}

export { EtaService };
