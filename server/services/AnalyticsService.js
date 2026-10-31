import { config } from "#config";
import { DensityReport, RouteAlert } from "#models";
import { boostScore, occupancyPct } from "#utils";
import { GeoService } from "#services/GeoService.js";
import socketService from "#services/SocketService.js";

const SCORE = { low: 1, mid: 2, high: 3 };
const RANK = { high: 3, mid: 2, low: 1, unknown: 0 };

/**
 * AnalyticsService (singleton)
 *  1) Crowdsourcing bildirişlərindən (GPS ilə) xətt / avtobus / seqment üzrə sıxlıq.
 *     Göstərilən bal/səviyyə/doluluq CROWD_DISPLAY_BOOST_PCT ilə artırılır (utils/crowdBoost.js);
 *     `rawScore` xam baldır. Trend və anomaliya qaydası xam bildirişlərlə işləyir.
 *  2) Anomaliya: xətt üzrə son N dəqiqədə sıxlıq "Yüksək" → RouteAlert (RESERVE_BUS_NEEDED).
 */
class AnalyticsService {
  constructor() {
    this.fleet = null;
    this.cache = null;
    this.timers = [];
    this.debounce = null;
    this.pending = new Set();
    this.locks = new Map();
    this.alertListeners = [];
  }

  get cfg() {
    return config.transit;
  }

  // ============ SAF FUNKSİYALAR (test oluna bilər) ============

  static levelFromScore(score) {
    if (score == null) return "unknown";
    if (score < 1.67) return "low";
    if (score < 2.34) return "mid";
    return "high";
  }

  /** Zamanla sönən çəki; GPS-təsdiqsiz bildiriş daha az çəkili */
  static weightOf(report, now, halfLifeMin) {
    const ageMin = (now - new Date(report.createdAt).getTime()) / 60000;
    return Math.pow(0.5, ageMin / halfLifeMin) * (report.verified ? 1 : 0.4);
  }

  static aggregate(reports, now, halfLifeMin) {
    let w = 0;
    let s = 0;
    const counts = { low: 0, mid: 0, high: 0 };
    for (const r of reports) {
      const wi = this.weightOf(r, now, halfLifeMin);
      w += wi;
      s += wi * SCORE[r.level];
      counts[r.level]++;
    }
    const score = w > 0 ? Math.round((s / w) * 100) / 100 : null;
    return {
      score,
      level: this.levelFromScore(score),
      counts,
      total: reports.length,
    };
  }

  /** Xam aqreqat → göstəriləcək (artırılmış) bal, səviyyə və təxmini doluluq */
  static present(agg) {
    const score = boostScore(agg.score);
    return {
      ...agg,
      rawScore: agg.score,
      score,
      level: this.levelFromScore(score),
      loadPct: occupancyPct(agg.score),
    };
  }

  static computeCrowd(
    reports,
    fleet,
    now = Date.now(),
    cfg = config.transit.crowd,
  ) {
    const byRoute = new Map();
    for (const r of reports) {
      const k = String(r.route);
      if (!byRoute.has(k)) byRoute.set(k, []);
      byRoute.get(k).push(r);
    }

    const routes = [];
    const buses = {};
    for (const [routeId, { route, geom }] of fleet.routes) {
      const list = byRoute.get(routeId) || [];
      const agg = this.present(this.aggregate(list, now, cfg.halfLifeMin));

      const recent = list.filter(
        (r) => now - new Date(r.createdAt) <= 5 * 60000,
      );
      const older = list.filter((r) => now - new Date(r.createdAt) > 5 * 60000);
      const a1 = this.aggregate(recent, now, cfg.halfLifeMin).score;
      const a0 = this.aggregate(older, now, cfg.halfLifeMin).score;
      let trend = "flat";
      if (a1 != null && a0 != null)
        trend = a1 - a0 > 0.3 ? "up" : a0 - a1 > 0.3 ? "down" : "flat";
      else if (a1 != null) trend = "new";

      // Dayanacaqlar arası seqmentlər üzrə sıxlıq xəritəsi
      const segBuckets = Array.from(
        { length: route.stops.length - 1 },
        () => [],
      );
      for (const r of list) {
        const c = r.location?.coordinates;
        if (!c) continue;
        const p = GeoService.project(geom, c[1], c[0]);
        if (p.offset > 1500) continue;
        segBuckets[GeoService.segmentIndex(geom, p.distance)].push(r);
      }
      const segments = segBuckets.map((b, i) => {
        const sa = this.present(this.aggregate(b, now, cfg.halfLifeMin));
        return {
          index: i,
          from: route.stops[i].name,
          to: route.stops[i + 1].name,
          level: sa.level,
          score: sa.score,
          rawScore: sa.rawScore,
          loadPct: sa.loadPct,
          total: sa.total,
        };
      });

      for (const bus of fleet.busesForRoute(routeId)) {
        const ba = this.present(
          this.aggregate(
            list.filter((r) => r.bus && String(r.bus) === bus.id),
            now,
            cfg.halfLifeMin,
          ),
        );
        buses[bus.id] = {
          level: ba.level,
          score: ba.score,
          rawScore: ba.rawScore,
          loadPct: ba.loadPct,
          total: ba.total,
        };
      }

      const last = list.reduce(
        (m, r) => Math.max(m, new Date(r.createdAt).getTime()),
        0,
      );
      routes.push({
        routeId,
        number: route.number,
        name: route.name,
        color: route.color,
        ...agg,
        verified: list.filter((r) => r.verified).length,
        trend,
        lastReportAt: last ? new Date(last).toISOString() : null,
        busCount: fleet.busesForRoute(routeId).length,
        segments,
      });
    }

    routes.sort(
      (x, y) =>
        RANK[y.level] - RANK[x.level] || (y.score || 0) - (x.score || 0),
    );
    return {
      generatedAt: new Date(now).toISOString(),
      windowMin: cfg.lookbackMin,
      routes,
      buses,
    };
  }

  /**
   * Anomaliya qaydası: pəncərədə "high" bildirən UNİKAL cihaz sayı ≥ minHighReports
   * və "high" payı ≥ minHighRatio.
   */
  /**
   * Unikal iştirakçı sayı — Sybil qorunması: `deviceId` müştəridən gəlir və saxtalaşdırıla bilər,
   * ona görə eyni şəbəkə mənbəyindən (ipHash) ən çox `maxPerSource` cihaz sayılır.
   * NAT / mobil operator arxasındakı real istifadəçilər üçün limit 1 deyil, 2-dir.
   */
  static contributors(reports, maxPerSource = 2) {
    const bySource = new Map();
    for (const r of reports) {
      const source = r.ipHash || `dev:${r.deviceId || String(r._id)}`;
      if (!bySource.has(source)) bySource.set(source, new Set());
      bySource.get(source).add(r.deviceId || String(r._id));
    }
    let n = 0;
    for (const devices of bySource.values())
      n += Math.min(devices.size, maxPerSource);
    return n;
  }

  static evaluateAnomaly(
    reports,
    now = Date.now(),
    cfg = config.transit.anomaly,
  ) {
    const from = now - cfg.windowMin * 60000;
    const win = reports.filter((r) => new Date(r.createdAt).getTime() >= from);
    const highs = win.filter((r) => r.level === "high");
    const highReports = AnalyticsService.contributors(
      highs,
      cfg.maxDevicesPerSource,
    );
    const totalReports = AnalyticsService.contributors(
      win,
      cfg.maxDevicesPerSource,
    );
    const highRatio = totalReports ? highReports / totalReports : 0;
    const times = highs.map((r) => new Date(r.createdAt).getTime());
    return {
      triggered:
        highReports >= cfg.minHighReports && highRatio >= cfg.minHighRatio,
      stats: {
        windowMin: cfg.windowMin,
        highReports,
        totalReports,
        highRatio: Math.round(highRatio * 100) / 100,
        firstHighAt: times.length ? new Date(Math.min(...times)) : null,
        lastHighAt: times.length ? new Date(Math.max(...times)) : null,
      },
    };
  }

  // ============ INSTANCE ============

  init(fleet) {
    this.fleet = fleet;
  }

  /** Yeni xəbərdarlıq yarananda çağırılacaq funksiya (məs. AI tövsiyəsi əlavə etmək) */
  onAlert(fn) {
    this.alertListeners.push(fn);
  }

  async notifyAlert(alert, isNew) {
    for (const fn of this.alertListeners) {
      try {
        await fn(alert, isNew);
      } catch (e) {
        console.error("❌ Alert listener:", e.message);
      }
    }
  }

  routeCrowd(routeId) {
    return (
      this.cache?.routes.find((r) => r.routeId === String(routeId)) || null
    );
  }

  async recompute() {
    const since = new Date(Date.now() - this.cfg.crowd.lookbackMin * 60000);
    const reports = await DensityReport.findSince(since);
    this.cache = AnalyticsService.computeCrowd(reports, this.fleet);
    socketService.broadcast("crowd:update", this.cache);
    return this.cache;
  }

  /** Yeni bildirişdən sonra — 1 san debounce */
  schedule(routeId) {
    if (routeId) this.pending.add(String(routeId));
    clearTimeout(this.debounce);
    this.debounce = setTimeout(async () => {
      const ids = [...this.pending];
      this.pending.clear();
      try {
        await this.recompute();
        for (const id of ids) await this.checkRoute(id);
      } catch (e) {
        console.error("❌ Analytics:", e.message);
      }
    }, 1000);
  }

  /** Eyni xətt üçün yoxlamalar ardıcıl icra olunur (dublikat xəbərdarlığın qarşısı) */
  checkRoute(routeId) {
    const id = String(routeId);
    const run = (this.locks.get(id) || Promise.resolve()).then(() =>
      this.#checkRoute(id),
    );
    this.locks.set(
      id,
      run.catch(() => {}),
    );
    return run;
  }

  async #checkRoute(routeId) {
    const r = this.fleet.getRoute(routeId);
    if (!r) return null;
    const { anomaly } = this.cfg;
    const since = new Date(Date.now() - anomaly.windowMin * 60000);
    const reports = await DensityReport.findSince(since, { route: routeId });
    const res = AnalyticsService.evaluateAnomaly(reports);
    if (!res.triggered) return null;

    const existing = await RouteAlert.findActiveFor(
      routeId,
      "RESERVE_BUS_NEEDED",
    );
    if (existing) {
      existing.stats = res.stats;
      await existing.save();
      const populated = await existing.populate("route", "number name color");
      socketService.toOperators("alert:update", populated);
      await this.notifyAlert(populated, false);
      return populated;
    }

    const alert = await RouteAlert.create({
      route: routeId,
      type: "RESERVE_BUS_NEEDED",
      message: `${r.route.number} nömrəli xətt (${r.route.name}): son ${anomaly.windowMin} dəqiqədə sıxlıq "Yüksək" — Əlavə avtobus ehtiyatı ayrılmalıdır`,
      stats: res.stats,
      history: [
        {
          status: "open",
          note: "Avtomatik yaradıldı (crowdsourcing)",
          noteKey: "auto_crowd",
        },
      ],
    });
    const populated = await alert.populate("route", "number name color");
    console.log(`⚠️  Anomaliya: ${alert.message}`);
    await this.notifyAlert(populated, true);
    socketService.toOperators("alert:new", populated);
    return populated;
  }

  async checkAll() {
    for (const id of this.fleet.routes.keys()) await this.checkRoute(id);
  }

  start() {
    this.recompute().catch(() => {});
    this.timers.push(
      setInterval(
        () =>
          this.recompute().catch((e) =>
            console.error("❌ Analytics:", e.message),
          ),
        30000,
      ),
    );
    this.timers.push(
      setInterval(
        () =>
          this.checkAll().catch((e) => console.error("❌ Anomaly:", e.message)),
        this.cfg.anomaly.checkEverySec * 1000,
      ),
    );
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }
}

const analyticsService = new AnalyticsService();

export { AnalyticsService, analyticsService };
