import { RouteAlert, DensityReport } from "#models";
import { fleetService } from "#services/FleetService.js";
import { analyticsService } from "#services/AnalyticsService.js";
import { demandService } from "#services/DemandService.js";
import { presenceService } from "#services/PresenceService.js";
import { ForecastService } from "#services/ForecastService.js";
import { EtaService } from "#services/EtaService.js";
import { i18nError } from "#utils";

/**
 * InsightService (static)
 * Bir xətt üzrə bütün siqnalları bir yerə yığır — dispetçer tövsiyəsi və AI xülasəsi
 * üçün ümumi "kontekst": crowdsourcing, anomaliya, proqnoz, tələb (A), canlı lokasiya (B), interval.
 * Sıxlıq/doluluq göstərilən (artırılmış) dəyərlərdir — operator panelində görünənlə eyni.
 */
class InsightService {
  static async routeContext(routeId) {
    const r = fleetService.getRoute(routeId);
    if (!r) throw i18nError(404, "route.notFound");
    const { route, geom } = r;
    const crowd = analyticsService.routeCrowd(routeId);
    const buses = fleetService.busesForRoute(routeId);

    const [activeAlerts, recent, confirmedIntents, forecast] =
      await Promise.all([
        RouteAlert.find({ route: routeId, status: { $ne: "resolved" } }).lean(),
        DensityReport.find({
          route: routeId,
          createdAt: { $gte: new Date(Date.now() - 15 * 60000) },
        })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
        demandService.confirmedForRoute(routeId),
        ForecastService.forRoute(routeId, {
          hours: 3,
          liveScore: crowd?.rawScore ?? null,
        }),
      ]);

    const hotSegments = (crowd?.segments || [])
      .filter((s) => s.level === "high")
      .map((s) => `${s.from} → ${s.to}`);

    return {
      route: {
        id: String(route._id),
        number: route.number,
        name: route.name,
        color: route.color,
      },
      stops: route.stops.map((s) => s.name),
      lengthKm: Math.round(geom.length / 100) / 10,
      fleet: {
        buses: buses.length,
        reserves: buses.filter((b) => b.isReserve).length,
        headwayMin: EtaService.headwayMin(geom, buses.length),
        cycleMin: Math.round(EtaService.cycleSec(geom) / 60),
      },
      crowd: crowd
        ? {
            level: crowd.level,
            score: crowd.score,
            rawScore: crowd.rawScore,
            loadPct: crowd.loadPct,
            counts: crowd.counts,
            total: crowd.total,
            verified: crowd.verified,
            trend: crowd.trend,
            windowMin: analyticsService.cache?.windowMin,
          }
        : null,
      hotSegments,
      recentReports: recent
        .slice(0, 10)
        .map((x) => ({
          level: x.level,
          verified: x.verified,
          at: x.createdAt,
        })),
      demand: { confirmedIntents },
      live: { riders: presenceService.ridersOnRoute(routeId) },
      forecast: forecast.points.map((p) => ({
        hour: p.hour,
        level: p.level,
        score: p.score,
        rawScore: p.rawScore,
        loadPct: p.loadPct,
        confidence: p.confidence,
      })),
      activeAlerts: activeAlerts.map((a) => ({
        id: String(a._id),
        type: a.type,
        status: a.status,
        stats: a.stats,
        createdAt: a.createdAt,
      })),
    };
  }
}

export { InsightService };
