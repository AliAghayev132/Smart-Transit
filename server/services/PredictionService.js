import { config } from "#config";
import { DensityReport, RouteAlert } from "#models";
import { t, scoreFromLoad } from "#utils";
import { GeoService } from "#services/GeoService.js";
import { EtaService } from "#services/EtaService.js";
import { fleetService } from "#services/FleetService.js";
import {
  analyticsService,
  AnalyticsService,
} from "#services/AnalyticsService.js";
import { ForecastService, bakuSlot } from "#services/ForecastService.js";
import { weatherService } from "#services/WeatherService.js";
import { GeminiService } from "#services/GeminiService.js";

const HORIZON_MIN = 120;
const HISTORY_DAYS = 14;
const SPIKE_LOAD_PCT = 95; // bu doluluqdan yuxarı — «sıxlıq sıçrayışı»
const SPIKE_RISE_PCT = 15; // və ya indikindən bu qədər faiz bəndi artım (≥ 80%)
const ONGOING_MIN_PCT = 80; // indi dolu xətt növbəti saatda bundan yuxarı qalırsa — davam edən sıçrayış
const DONOR_MAX_LOAD_PCT = 60; // donor xətt bütün üfüq boyu bundan aşağı qalmalıdır
const MIN_DONOR_BUSES = 3; // donor xəttdə ən az bu qədər avtobus olmalıdır
const LEAD_MIN = 20; // yerdəyişmə sıçrayışdan bu qədər əvvəl başlamalıdır
const REFRESH_MIN_SEC = 30;
const LANG_NAME = { az: "Azerbaijani", en: "English", ru: "Russian" };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const int = (v, lo, hi, d = lo) =>
  Number.isFinite(Number(v)) ? clamp(Math.round(Number(v)), lo, hi) : d;
const text = (v, max) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
const levelOfLoad = (pct) =>
  pct == null
    ? "unknown"
    : AnalyticsService.levelFromScore(clamp(scoreFromLoad(pct / 100), 1, 3));

/**
 * Bakı tıxac profili (0..1) — GPS sürəti olmadıqda istifadə olunan təxmin.
 * İş günü: 08–10 və 17–20 ən sıx, gecə boş. Həftəsonu daha yüngül.
 */
const trafficPrior = (dow, hour) => {
  const weekend = dow === 0 || dow === 6;
  let x;
  if (hour >= 8 && hour < 10) x = 0.85;
  else if (hour === 7) x = 0.65;
  else if (hour >= 17 && hour < 20) x = 0.9;
  else if (hour >= 12 && hour < 15) x = 0.5;
  else if (hour >= 22 || hour < 6) x = 0.15;
  else x = 0.4;
  return weekend ? Math.max(0.1, x - 0.25) : x;
};

/** Gemini cavabının sxemi (OpenAPI alt çoxluğu) */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    spikes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          route: { type: "STRING" },
          inMinutes: { type: "INTEGER" },
          expectedLoadPct: { type: "INTEGER" },
          confidence: { type: "NUMBER" },
          reason: { type: "STRING" },
        },
        required: ["route", "inMinutes", "expectedLoadPct", "reason"],
      },
    },
    reallocations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          from: { type: "STRING" },
          to: { type: "STRING" },
          buses: { type: "INTEGER" },
          inMinutes: { type: "INTEGER" },
          reason: { type: "STRING" },
        },
        required: ["from", "to", "buses", "reason"],
      },
    },
    risks: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["summary", "spikes", "reallocations"],
};

/**
 * PredictionService (static)
 * Operator üçün 1–2 saatlıq proqnoz: gözlənilən sıxlıq sıçrayışları və avtobusların yerdəyişməsi.
 *
 * 1) Kontekst: 14 günlük crowdsourcing tarixçəsi (həftə günü × saat), pik saatlar,
 *    canlı sıxlıq, hava (Open-Meteo), tıxac (real GPS sürəti və ya Bakı profili), park.
 * 2) Deterministik baza modeli həmişə hesablanır (Gemini olmasa da işləyir).
 * 3) Gemini kontekst + baza modeli üzərində düşünür, strukturlu JSON qaytarır;
 *    cavab server tərəfində yoxlanılır (naməlum xətt, ağlasığmaz rəqəm atılır).
 * Gemini-yə şəxsi məlumat göndərilmir — yalnız xətt səviyyəsində aqreqatlar.
 */
class PredictionService {
  static cache = new Map(); // lang → { at, value }
  static inflight = new Map(); // lang → Promise

  static traffic(now, weather) {
    const { dow, hour } = bakuSlot(new Date(now));
    const gps = fleetService.gpsTraffic();
    let index;
    let source;
    if (gps && gps.buses >= 2) {
      // Sərbəst hərəkətdə şəhər avtobusu ~30 km/s; daha yavaş → daha çox tıxac
      index = clamp(1 - gps.avgSpeedKmh / 30, 0, 1);
      source = "gps";
    } else {
      index = trafficPrior(dow, hour);
      source = "estimated";
    }
    index = clamp(index + (weather?.impact || 0) * 0.2, 0, 1);
    return {
      index: Math.round(index * 100) / 100,
      level: index >= 0.66 ? "heavy" : index >= 0.4 ? "moderate" : "light",
      source,
      avgSpeedKmh: gps?.avgSpeedKmh ?? null,
      gpsBuses: gps?.buses ?? 0,
    };
  }

  /** Tarixçədən pik saatlar (Bakı vaxtı). Az data olduqda prior profil. */
  static peakHours(reports) {
    const byHour = new Map();
    for (const r of reports) {
      const { hour } = bakuSlot(new Date(r.createdAt));
      const b = byHour.get(hour) || { n: 0, high: 0 };
      b.n++;
      if (r.level === "high") b.high++;
      byHour.set(hour, b);
    }
    if (reports.length >= 30) {
      const list = [...byHour.entries()]
        .filter(([, b]) => b.n >= 3)
        .map(([hour, b]) => ({
          hour,
          highShare: Math.round((b.high / b.n) * 100) / 100,
          reports: b.n,
        }))
        .sort((a, b) => b.highShare - a.highShare || b.reports - a.reports)
        .slice(0, 3);
      if (list.length) return { source: "history", hours: list };
    }
    return {
      source: "prior",
      hours: [
        { hour: 8, highShare: null, reports: 0 },
        { hour: 18, highShare: null, reports: 0 },
        { hour: 13, highShare: null, reports: 0 },
      ],
    };
  }

  /** Bütün siqnalları yığır */
  static async gather(now = Date.now()) {
    const since = new Date(now - HISTORY_DAYS * 24 * 3600 * 1000);
    if (!analyticsService.cache) await analyticsService.recompute();
    const [weather, history, alerts] = await Promise.all([
      weatherService.current(),
      DensityReport.find(
        { createdAt: { $gte: since } },
        { route: 1, level: 1, createdAt: 1, verified: 1 },
      ).lean(),
      RouteAlert.find({ status: { $ne: "resolved" } }).lean(),
    ]);

    const byRoute = new Map();
    for (const r of history) {
      const k = String(r.route);
      if (!byRoute.has(k)) byRoute.set(k, []);
      byRoute.get(k).push(r);
    }

    const routes = [];
    for (const [routeId, { route, geom }] of fleetService.routes) {
      const live = analyticsService.routeCrowd(routeId);
      const f = ForecastService.build(byRoute.get(routeId) || [], {
        now,
        hours: 2,
        liveScore: live?.rawScore ?? null,
      });
      const buses = fleetService.busesForRoute(routeId);
      const [p0, p1, p2] = f.points;
      routes.push({
        routeId,
        number: route.number,
        name: route.name,
        color: route.color,
        stops: route.stops.map((s) => [s.lat, s.lng]),
        buses: buses.length,
        reserves: buses.filter((b) => b.isReserve).length,
        headwayMin: EtaService.headwayMin(geom, buses.length),
        activeAlerts: alerts.filter((a) => String(a.route) === routeId).length,
        now: {
          level: live?.level ?? p0.level,
          loadPct: live?.loadPct ?? p0.loadPct,
          trend: live?.trend ?? null,
          reports: live?.total ?? 0,
        },
        in1h: { hour: p1.hour, loadPct: p1.loadPct, confidence: p1.confidence },
        in2h: { hour: p2.hour, loadPct: p2.loadPct, confidence: p2.confidence },
        history: (byRoute.get(routeId) || []).length,
      });
    }

    return {
      now,
      weather,
      traffic: this.traffic(now, weather),
      peaks: this.peakHours(history),
      historyReports: history.length,
      routes,
    };
  }

  /** Hava + tıxac təsiri (faiz bəndi): yağış → avtobusa keçid, tıxac → az reys */
  static adjustment(ctx) {
    const w = Math.round((ctx.weather?.impact || 0) * 12);
    const tr = ctx.traffic.index >= 0.66 ? 5 : ctx.traffic.index >= 0.4 ? 2 : 0;
    return w + tr;
  }

  /** İki xəttin ən yaxın dayanacaqları arasındakı məsafə (m) */
  static nearness(a, b) {
    let best = Infinity;
    for (const p of a.stops)
      for (const q of b.stops)
        best = Math.min(best, GeoService.haversine(p, q));
    return best;
  }

  /**
   * Deterministik baza modeli (saf funksiya): sıçrayışlar + yerdəyişmə.
   * Mətnlər `lang` dilindədir.
   */
  static baseline(ctx, lang = "az") {
    const { targetLoad, maxReservePerAlert } = config.transit.dispatch;
    const adj = this.adjustment(ctx);
    const routes = ctx.routes.map((r) => {
      const l1 = r.in1h.loadPct == null ? null : r.in1h.loadPct + adj;
      const l2 = r.in2h.loadPct == null ? null : r.in2h.loadPct + adj;
      return { ...r, l1, l2, peak: Math.max(l1 ?? 0, l2 ?? 0) };
    });

    const spikes = [];
    for (const r of routes) {
      const at1 =
        r.l1 != null &&
        (r.l1 >= SPIKE_LOAD_PCT ||
          (r.l1 - (r.now.loadPct ?? r.l1) >= SPIKE_RISE_PCT && r.l1 >= 80));
      const at2 =
        r.l2 != null &&
        (r.l2 >= SPIKE_LOAD_PCT ||
          (r.l2 - (r.now.loadPct ?? r.l2) >= SPIKE_RISE_PCT && r.l2 >= 80));
      // Hazırda həddən artıq dolu və növbəti saatda da sıx qalacaq xətt — «davam edən» sıçrayış
      const ongoing =
        (r.now.loadPct ?? 0) >= SPIKE_LOAD_PCT &&
        r.l1 != null &&
        r.l1 >= ONGOING_MIN_PCT;
      if (!at1 && !at2 && !ongoing) continue;
      const use2 = !ongoing && (!at1 || (at2 && r.l2 > r.l1 + 5));
      const loadPct = ongoing ? r.now.loadPct : use2 ? r.l2 : r.l1;
      const conf = use2 ? r.in2h.confidence : r.in1h.confidence;
      const parts = [
        ongoing
          ? t(lang, "predict.reason.ongoing", {
              nowPct: r.now.loadPct,
              nextPct: Math.round(r.l1),
            })
          : t(lang, "predict.reason.forecast", {
              loadPct,
              confidencePct: Math.round(conf * 100),
            }),
      ];
      if ((ctx.weather?.impact || 0) >= 0.2)
        parts.push(
          t(lang, "predict.reason.weather", {
            condition: t(lang, `predict.weather.${ctx.weather.condition}`),
          }),
        );
      if (ctx.traffic.level === "heavy")
        parts.push(t(lang, "predict.reason.traffic"));
      spikes.push({
        routeId: r.routeId,
        ongoing,
        inMin: ongoing ? 0 : use2 ? 120 : 60,
        loadPct,
        confidence: ongoing ? null : conf, // indiki vəziyyət müşahidədir, proqnoz deyil
        reason: parts.join(" "),
      });
    }
    spikes.sort((a, b) => b.loadPct - a.loadPct);

    // Yerdəyişmə: sıx xəttə az yüklü (və yaxın) xəttdən, yoxdursa ehtiyat parkdan
    const donors = routes
      .filter(
        (r) =>
          r.buses >= MIN_DONOR_BUSES &&
          r.peak > 0 &&
          r.peak <= DONOR_MAX_LOAD_PCT &&
          (r.now.loadPct ?? 0) <= DONOR_MAX_LOAD_PCT &&
          !spikes.some((s) => s.routeId === r.routeId),
      )
      .map((r) => ({ ...r, spare: 1 }));
    const reallocations = [];
    for (const s of spikes) {
      const r = routes.find((x) => x.routeId === s.routeId);
      const n = Math.max(r.buses - r.reserves, 1);
      let need = clamp(
        Math.ceil((n * s.loadPct) / (targetLoad * 100)) - n,
        1,
        maxReservePerAlert,
      );
      const when = Math.max(s.inMin - LEAD_MIN - 30, 0);
      const ranked = donors
        .filter((d) => d.spare > 0)
        .sort((a, b) => this.nearness(a, r) - this.nearness(b, r));
      for (const d of ranked) {
        if (need <= 0) break;
        d.spare--;
        need--;
        reallocations.push({
          fromRouteId: d.routeId,
          toRouteId: r.routeId,
          buses: 1,
          inMin: when,
          reason: t(lang, "predict.realloc.donor", {
            from: d.number,
            fromLoad: Math.round(d.peak),
            to: r.number,
            toLoad: Math.round(s.loadPct),
          }),
        });
      }
      if (need > 0) {
        reallocations.push({
          fromRouteId: null,
          toRouteId: r.routeId,
          buses: need,
          inMin: when,
          reason: t(lang, "predict.realloc.depot", {
            count: need,
            to: r.number,
            toLoad: Math.round(s.loadPct),
          }),
        });
      }
    }

    const list = (arr) =>
      arr
        .slice(0, 5)
        .map((s) => `№${routes.find((r) => r.routeId === s.routeId).number}`)
        .join(", ");
    const now = spikes.filter((s) => s.ongoing);
    const next = spikes.filter((s) => !s.ongoing);
    const summary = [
      now.length
        ? t(lang, "predict.summary.ongoing", {
            count: now.length,
            list: list(now),
          })
        : null,
      next.length
        ? t(lang, "predict.summary.spikes", {
            count: next.length,
            list: list(next),
          })
        : null,
      !spikes.length ? t(lang, "predict.summary.calm") : null,
      ctx.weather
        ? t(lang, "predict.summary.weather", {
            condition: t(lang, `predict.weather.${ctx.weather.condition}`),
            temp: Math.round(ctx.weather.tempC),
          })
        : null,
      t(lang, "predict.summary.traffic", {
        level: t(lang, `predict.traffic.${ctx.traffic.level}`),
      }),
    ]
      .filter(Boolean)
      .join(" ");

    return { summary, spikes, reallocations, risks: [] };
  }

  /** Gemini üçün yığcam kontekst (koordinatsız, şəxsi məlumatsız) */
  static promptContext(ctx, base) {
    const byId = new Map(ctx.routes.map((r) => [r.routeId, r]));
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Baku",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(ctx.now));
    return {
      bakuLocalTime: local,
      horizonMinutes: HORIZON_MIN,
      weather: ctx.weather
        ? {
            condition: ctx.weather.condition,
            tempC: ctx.weather.tempC,
            precipMm: ctx.weather.precipMm,
            windKmh: ctx.weather.windKmh,
            precipProbNext2h: ctx.weather.precipProbNext2h,
            impact0to1: ctx.weather.impact,
          }
        : "unavailable",
      traffic: {
        level: ctx.traffic.level,
        index0to1: ctx.traffic.index,
        source: ctx.traffic.source,
        avgBusSpeedKmh: ctx.traffic.avgSpeedKmh,
      },
      historicalPeakHours: ctx.peaks,
      historyReports14d: ctx.historyReports,
      fleetRules: {
        busCapacity: config.transit.dispatch.busCapacity,
        targetLoadPct: Math.round(config.transit.dispatch.targetLoad * 100),
        maxExtraBusesPerRoute: config.transit.dispatch.maxReservePerAlert,
        donorMustKeepAtLeast: MIN_DONOR_BUSES - 1,
      },
      routes: ctx.routes.map((r) => ({
        route: r.number,
        name: r.name,
        buses: r.buses,
        reserves: r.reserves,
        headwayMin: r.headwayMin,
        activeAlerts: r.activeAlerts,
        nowLoadPct: r.now.loadPct,
        nowLevel: r.now.level,
        trend: r.now.trend,
        liveReports15m: r.now.reports,
        forecast1hLoadPct: r.in1h.loadPct,
        forecast2hLoadPct: r.in2h.loadPct,
        forecastConfidence: r.in1h.confidence,
        historyReports14d: r.history,
      })),
      baselineModel: {
        spikes: base.spikes.map((s) => ({
          route: byId.get(s.routeId).number,
          inMinutes: s.inMin,
          expectedLoadPct: s.loadPct,
          ongoingNow: !!s.ongoing,
        })),
        reallocations: base.reallocations.map((x) => ({
          from: x.fromRouteId ? byId.get(x.fromRouteId).number : "depot",
          to: byId.get(x.toRouteId).number,
          buses: x.buses,
        })),
      },
    };
  }

  static systemPrompt(lang) {
    return [
      "You are a transit operations analyst for BakuBus (Baku, Azerbaijan).",
      `Predict the next ${HORIZON_MIN} minutes for the operator dashboard: congestion spikes per route and fleet re-allocations.`,
      "Use ONLY the JSON data provided. Never invent routes; use the exact route numbers given.",
      "Load % is bus occupancy (100 = full). A spike is expected load >= 95% or a sharp rise.",
      "Rain, snow, strong wind and heavy traffic increase bus demand and reduce the number of trips; historical peak hours matter.",
      "A baseline statistical model output is included. Keep its numbers unless the data clearly justifies a change, and say why.",
      "Routes that are already overloaded now (ongoingNow) must be reported with inMinutes 0.",
      "Re-allocate only from routes that stay below 60% load and keep at least the minimum buses; use 'depot' for reserve buses.",
      "Keep each reason under 160 characters and the summary under 3 sentences.",
      `Write summary, reasons and risks in ${LANG_NAME[lang] || "Azerbaijani"}.`,
    ].join("\n");
  }

  /** Gemini cavabını yoxlayır və bizim formaya salır (saf funksiya) */
  static sanitize(raw, ctx) {
    const { maxReservePerAlert } = config.transit.dispatch;
    const byNum = new Map(ctx.routes.map((r) => [String(r.number), r]));
    const num = (v) =>
      byNum.get(
        String(v ?? "")
          .replace(/^№\s*/, "")
          .trim(),
      ) || null;

    const seen = new Set();
    const spikes = [];
    for (const s of Array.isArray(raw?.spikes) ? raw.spikes : []) {
      const r = num(s?.route);
      if (!r || seen.has(r.routeId)) continue;
      seen.add(r.routeId);
      spikes.push({
        routeId: r.routeId,
        inMin: int(s.inMinutes, 0, HORIZON_MIN, 60),
        ongoing: int(s.inMinutes, 0, HORIZON_MIN, 60) === 0,
        loadPct: int(s.expectedLoadPct, 0, 200, 0),
        confidence:
          s.confidence == null
            ? null
            : Math.round(clamp(Number(s.confidence) || 0, 0, 1) * 100) / 100,
        reason: text(s.reason, 240),
      });
      if (spikes.length >= 8) break;
    }

    const given = new Map(); // donor → verilən avtobus
    const reallocations = [];
    for (const x of Array.isArray(raw?.reallocations)
      ? raw.reallocations
      : []) {
      const to = num(x?.to);
      const depot = /^(depot|park|ehtiyat|депо|резерв|reserve)?$/i.test(
        String(x?.from ?? "").trim(),
      );
      const from = depot ? null : num(x?.from);
      if (!to || (!depot && !from) || from?.routeId === to.routeId) continue;
      let buses = int(x.buses, 1, maxReservePerAlert, 1);
      if (from) {
        const left =
          from.buses - (MIN_DONOR_BUSES - 1) - (given.get(from.routeId) || 0);
        buses = Math.min(buses, left);
        if (buses <= 0) continue;
        given.set(from.routeId, (given.get(from.routeId) || 0) + buses);
      }
      reallocations.push({
        fromRouteId: from?.routeId ?? null,
        toRouteId: to.routeId,
        buses,
        inMin: int(x.inMinutes, 0, HORIZON_MIN, 0),
        reason: text(x.reason, 240),
      });
      if (reallocations.length >= 6) break;
    }

    return {
      summary: text(raw?.summary, 600),
      spikes,
      reallocations,
      risks: (Array.isArray(raw?.risks) ? raw.risks : [])
        .map((r) => text(r, 200))
        .filter(Boolean)
        .slice(0, 4),
    };
  }

  /** Daxili formanı API cavabına çevirir (xətt məlumatı əlavə olunur) */
  static present(ctx, result, meta) {
    const byId = new Map(ctx.routes.map((r) => [r.routeId, r]));
    const ref = (id) => {
      const r = byId.get(id);
      return r
        ? { routeId: r.routeId, number: r.number, color: r.color, name: r.name }
        : null;
    };
    const at = (min) => new Date(ctx.now + min * 60000).toISOString();
    const adj = this.adjustment(ctx);
    const point = (p) =>
      p.loadPct == null
        ? { level: "unknown", loadPct: null }
        : { level: levelOfLoad(p.loadPct + adj), loadPct: p.loadPct + adj };
    return {
      generatedAt: new Date(ctx.now).toISOString(),
      horizonMin: HORIZON_MIN,
      ...meta,
      weather: ctx.weather,
      traffic: ctx.traffic,
      peakHours: ctx.peaks,
      historyReports: ctx.historyReports,
      summary: result.summary,
      spikes: result.spikes.map((s) => ({
        ...ref(s.routeId),
        inMin: s.inMin,
        at: at(s.inMin),
        ongoing: !!s.ongoing,
        loadPct: s.loadPct,
        level: levelOfLoad(s.loadPct),
        confidence: s.confidence,
        reason: s.reason,
      })),
      reallocations: result.reallocations.map((x) => ({
        from: x.fromRouteId ? ref(x.fromRouteId) : null,
        to: ref(x.toRouteId),
        buses: x.buses,
        inMin: x.inMin,
        at: at(x.inMin),
        reason: x.reason,
      })),
      risks: result.risks,
      routes: ctx.routes.map((r) => ({
        ...ref(r.routeId),
        now: { level: r.now.level, loadPct: r.now.loadPct },
        in1h: point(r.in1h),
        in2h: point(r.in2h),
      })),
    };
  }

  static async generate(lang, now = Date.now()) {
    const ctx = await this.gather(now);
    const base = this.baseline(ctx, lang);
    if (!GeminiService.enabled) {
      return this.present(ctx, base, { source: "rules", model: null });
    }
    try {
      const { data, model } = await GeminiService.generateJson({
        system: this.systemPrompt(lang),
        prompt:
          "Operational data (JSON):\n" +
          JSON.stringify(this.promptContext(ctx, base)),
        schema: RESPONSE_SCHEMA,
      });
      const clean = this.sanitize(data, ctx);
      if (!clean.summary) throw new Error("Gemini summary is empty");
      return this.present(ctx, clean, { source: "gemini", model });
    } catch (e) {
      console.warn("⚠️ Gemini proqnozu alınmadı, baza modeli:", e.message);
      return this.present(ctx, base, {
        source: "rules",
        model: null,
        fallback: true,
      });
    }
  }

  /** Keşlə: eyni dildə proqnoz cacheSec ərzində təkrar hesablanmır */
  static async predict({ lang = "az", refresh = false } = {}) {
    const hit = this.cache.get(lang);
    const age = hit ? (Date.now() - hit.at) / 1000 : Infinity;
    const fresh = refresh
      ? age < REFRESH_MIN_SEC
      : age < config.gemini.cacheSec;
    if (hit && fresh) return { ...hit.value, cached: true };
    if (this.inflight.has(lang)) return this.inflight.get(lang);

    const p = this.generate(lang)
      .then((value) => {
        this.cache.set(lang, { at: Date.now(), value });
        return { ...value, cached: false };
      })
      .finally(() => this.inflight.delete(lang));
    this.inflight.set(lang, p);
    return p;
  }

  static clearCache() {
    this.cache.clear();
  }
}

export { PredictionService, trafficPrior, RESPONSE_SCHEMA };
