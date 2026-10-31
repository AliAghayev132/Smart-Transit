/**
 * Analitika mühərriki:
 *  1) Sərnişin bildirişlərindən (GPS koordinatı ilə) xətt, avtobus və seqment üzrə sıxlıq.
 *  2) Anomaliya aşkarlanması: xəttdə son N dəqiqədə sıxlıq "Yüksək" kimi qeyd olunursa
 *     operator panelinə "Əlavə avtobus ehtiyatı ayrılmalıdır" bildirişi yaradılır.
 */
const { EventEmitter } = require('events');
const Report = require('../models/Report');
const Alert = require('../models/Alert');
const config = require('../config');
const { project, segmentIndex } = require('./geo');

const SCORE = { low: 1, mid: 2, high: 3 };
const LABEL = { low: 'Az', mid: 'Orta', high: 'Yüksək', unknown: 'Məlumat yoxdur' };

function levelFromScore(score) {
  if (score == null) return 'unknown';
  if (score < 1.67) return 'low';
  if (score < 2.34) return 'mid';
  return 'high';
}

/** Zamanla sönən çəki: yeni bildirişlər daha əhəmiyyətlidir; təsdiqlənməmişlər daha az çəkiyə malikdir */
function weightOf(report, now, halfLifeMin) {
  const ageMin = (now - new Date(report.createdAt).getTime()) / 60000;
  const decay = Math.pow(0.5, ageMin / halfLifeMin);
  return decay * (report.verified ? 1 : 0.4);
}

function aggregate(reports, now, halfLifeMin) {
  let w = 0, s = 0;
  const counts = { low: 0, mid: 0, high: 0 };
  for (const r of reports) {
    const wi = weightOf(r, now, halfLifeMin);
    w += wi;
    s += wi * SCORE[r.level];
    counts[r.level]++;
  }
  const score = w > 0 ? s / w : null;
  return { score: score && Math.round(score * 100) / 100, level: levelFromScore(score), counts, total: reports.length };
}

/**
 * Saf funksiya — DB-dən asılı deyil (test oluna bilər).
 * reports: son lookbackMin dəqiqənin bildirişləri (lean)
 */
function computeCrowd(reports, fleet, now = Date.now(), cfg = config.crowd) {
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
    const agg = aggregate(list, now, cfg.halfLifeMin);

    // Trend: son 5 dəq vs. əvvəlki
    const recent = list.filter((r) => now - new Date(r.createdAt) <= 5 * 60000);
    const older = list.filter((r) => now - new Date(r.createdAt) > 5 * 60000);
    const a1 = aggregate(recent, now, cfg.halfLifeMin).score;
    const a0 = aggregate(older, now, cfg.halfLifeMin).score;
    let trend = 'flat';
    if (a1 != null && a0 != null) trend = a1 - a0 > 0.3 ? 'up' : a0 - a1 > 0.3 ? 'down' : 'flat';
    else if (a1 != null && a0 == null) trend = 'new';

    // Seqmentlər üzrə (dayanacaqlar arası) sıxlıq xəritəsi
    const segBuckets = Array.from({ length: route.stops.length - 1 }, () => []);
    for (const r of list) {
      const c = r.location && r.location.coordinates;
      if (!c) continue;
      const p = project(geom, c[1], c[0]);
      if (p.offset > 1500) continue; // xəttdən çox uzaq nöqtələr seqmentə yazılmır
      segBuckets[segmentIndex(geom, p.distance)].push(r);
    }
    const segments = segBuckets.map((b, i) => {
      const sa = aggregate(b, now, cfg.halfLifeMin);
      return {
        index: i,
        from: route.stops[i].name,
        to: route.stops[i + 1].name,
        level: sa.level,
        score: sa.score,
        total: sa.total,
      };
    });

    // Avtobuslar üzrə
    for (const bus of fleet.busesForRoute(routeId)) {
      const bl = list.filter((r) => r.bus && String(r.bus) === bus.id);
      const ba = aggregate(bl, now, cfg.halfLifeMin);
      buses[bus.id] = { level: ba.level, score: ba.score, total: ba.total };
    }

    const last = list.reduce((m, r) => Math.max(m, new Date(r.createdAt).getTime()), 0);
    routes.push({
      routeId,
      number: route.number,
      name: route.name,
      color: route.color,
      ...agg,
      label: LABEL[agg.level],
      verified: list.filter((r) => r.verified).length,
      trend,
      lastReportAt: last ? new Date(last).toISOString() : null,
      busCount: fleet.busesForRoute(routeId).length,
      segments,
    });
  }

  const rank = { high: 3, mid: 2, low: 1, unknown: 0 };
  routes.sort((x, y) => rank[y.level] - rank[x.level] || (y.score || 0) - (x.score || 0));
  return { generatedAt: new Date(now).toISOString(), windowMin: cfg.lookbackMin, routes, buses };
}

/**
 * Saf funksiya — anomaliya qaydası.
 * Pəncərə ərzində: "Yüksək" bildirən UNİKAL cihaz sayı >= minHighReports
 * və "Yüksək" payı >= minHighRatio olarsa — anomaliya.
 */
function evaluateAnomaly(reports, now = Date.now(), cfg = config.anomaly) {
  const from = now - cfg.windowMin * 60000;
  const win = reports.filter((r) => new Date(r.createdAt).getTime() >= from);
  const highs = win.filter((r) => r.level === 'high');
  const uniq = (arr) => new Set(arr.map((r) => r.deviceId || String(r._id))).size;
  const highReports = uniq(highs);
  const totalReports = uniq(win);
  const highRatio = totalReports ? highReports / totalReports : 0;
  const times = highs.map((r) => new Date(r.createdAt).getTime());
  return {
    triggered: highReports >= cfg.minHighReports && highRatio >= cfg.minHighRatio,
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

class Analytics extends EventEmitter {
  constructor(fleet) {
    super();
    this.fleet = fleet;
    this.cache = null;
    this.debounce = null;
    this.timers = [];
  }

  async recompute() {
    const since = new Date(Date.now() - config.crowd.lookbackMin * 60000);
    const reports = await Report.find({ createdAt: { $gte: since } }).lean();
    this.cache = computeCrowd(reports, this.fleet);
    this.emit('crowd', this.cache);
    return this.cache;
  }

  /** Yeni bildirişdən sonra — 1 saniyəlik debounce */
  schedule(routeId) {
    this.pending = this.pending || new Set();
    if (routeId) this.pending.add(String(routeId));
    clearTimeout(this.debounce);
    this.debounce = setTimeout(async () => {
      const ids = [...this.pending];
      this.pending.clear();
      try {
        await this.recompute();
        for (const id of ids) await this.checkRoute(id);
      } catch (e) {
        console.error('[analytics]', e.message);
      }
    }, 1000);
  }

  /** Eyni xətt üçün yoxlamaları ardıcıl icra edir (paralel çağırışlarda dublikat xəbərdarlığın qarşısını alır) */
  checkRoute(routeId) {
    this.locks = this.locks || new Map();
    const id = String(routeId);
    const run = (this.locks.get(id) || Promise.resolve()).then(() => this._checkRoute(id));
    this.locks.set(id, run.catch(() => {}));
    return run;
  }

  async _checkRoute(routeId) {
    const r = this.fleet.getRoute(routeId);
    if (!r) return null;
    const since = new Date(Date.now() - config.anomaly.windowMin * 60000);
    const reports = await Report.find({ route: routeId, createdAt: { $gte: since } }).lean();
    const res = evaluateAnomaly(reports);
    if (!res.triggered) return null;

    // Bu xətt üçün açıq (həll olunmamış) xəbərdarlıq varsa, yalnız statistikanı yeniləyirik
    const existing = await Alert.findOne({ route: routeId, type: 'RESERVE_BUS_NEEDED', status: { $ne: 'resolved' } });
    if (existing) {
      existing.stats = res.stats;
      await existing.save();
      this.emit('alert:update', await existing.populate('route', 'number name color'));
      return existing;
    }

    const alert = await Alert.create({
      route: routeId,
      message: `${r.route.number} nömrəli xətt (${r.route.name}): son ${config.anomaly.windowMin} dəqiqədə sıxlıq "Yüksək" — Əlavə avtobus ehtiyatı ayrılmalıdır`,
      stats: res.stats,
      history: [{ status: 'open', note: 'Avtomatik yaradıldı' }],
    });
    const populated = await alert.populate('route', 'number name color');
    console.log(`[anomaly] YENİ: ${alert.message}`);
    this.emit('alert:new', populated);
    return populated;
  }

  async checkAll() {
    for (const routeId of this.fleet.routes.keys()) await this.checkRoute(routeId);
  }

  start() {
    this.recompute().catch(() => {});
    this.timers.push(setInterval(() => this.recompute().catch((e) => console.error('[analytics]', e.message)), 30000));
    this.timers.push(
      setInterval(() => this.checkAll().catch((e) => console.error('[anomaly]', e.message)), config.anomaly.checkEverySec * 1000)
    );
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }
}

module.exports = { Analytics, computeCrowd, evaluateAnomaly, levelFromScore, aggregate, LABEL };
