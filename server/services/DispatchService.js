import { config } from "#config";
import { Bus, RouteAlert, DispatchCommand } from "#models";
import { dispatchTemplates } from "#constants";
import { i18nError, t, loadFromScore, boostFactor } from "#utils";
import { GeoService } from "#services/GeoService.js";
import { EtaService } from "#services/EtaService.js";
import { fleetService } from "#services/FleetService.js";
import { analyticsService } from "#services/AnalyticsService.js";
import { InsightService } from "#services/InsightService.js";
import socketService from "#services/SocketService.js";

const RANK = { high: 3, mid: 2, low: 1, unknown: 0 };
const SCORE_OF = { low: 1, mid: 2, high: 3 };

/** Şablon sahəsi ({ az, en, ru } və ya sətir) → istənilən dil */
const pick = (v, lang) =>
  v && typeof v === "object" ? (v[lang] ?? v.az ?? "") : (v ?? "");

/**
 * DispatchService (static)
 * Smart Dispatcher Assistant-ın DETERMİNİSTİK nüvəsi: neçə əlavə avtobus lazımdır?
 * (LLM rəqəm hesablamır — yalnız izah edir; bax AssistantService.)
 * Həmçinin dispetçer əmri şablonları və ehtiyat avtobusların idarəsi.
 */
class DispatchService {
  static get cfg() {
    return config.transit.dispatch;
  }

  /**
   * Saf funksiya: kontekst → tövsiyə.
   * Formula: tələb olunan avtobus n' = ⌈ n × doluluq / hədəf_doluluq ⌉ + ⌈ (niyyətlər / tətbiq payı) / tutum ⌉
   * Doluluq — göstərilən (CROWD_DISPLAY_BOOST_PCT ilə artırılmış) `loadPct`; operator panelində görünənlə eynidir.
   * Səbəblər strukturludur: [{ code, params }] — mətn client-də / t(lang, "reason.<code>") ilə qurulur.
   */
  static computeRecommendation(ctx, { appShare = 0.2 } = {}) {
    const { busCapacity, targetLoad, maxReservePerAlert } = this.cfg;
    const n = Math.max(ctx.fleet.buses, 1);
    // Crowdsourcing balı ehtiyat avtobuslar xəttə çıxmazdan ƏVVƏLKİ vəziyyəti əks etdirir —
    // ona görə tələb əsas avtobus sayı üzərindən hesablanır, artıq ayrılmış ehtiyatlar çıxılır.
    const base = Math.max(ctx.fleet.buses - (ctx.fleet.reserves || 0), 1);
    const reasons = [];

    const liveScore = ctx.crowd?.score ?? null;
    const alertHigh = ctx.activeAlerts.some(
      (a) => a.type === "RESERVE_BUS_NEEDED",
    );
    const nextHour = ctx.forecast?.[1];

    // Göstərilən (artırılmış) doluluq: xam baldan dəqiq, yoxdursa loadPct, o da yoxdursa baldan
    const shownLoad = (p) =>
      p?.rawScore != null
        ? loadFromScore(p.rawScore) * boostFactor()
        : p?.loadPct != null
          ? p.loadPct / 100
          : p?.score != null
            ? loadFromScore(p.score)
            : null;
    const liveLoad = shownLoad(ctx.crowd);
    const forecastLoad = shownLoad(nextHour);

    const loadNow =
      liveLoad ??
      (alertHigh
        ? loadFromScore(3) * boostFactor()
        : (forecastLoad ?? loadFromScore(1.5) * boostFactor()));
    const loadNext = forecastLoad ?? loadNow;
    const load = Math.max(loadNow, loadNext * 0.9);

    let needed = Math.ceil((base * load) / targetLoad) - n;
    if (ctx.fleet.reserves)
      reasons.push({
        code: "reserves_on_line",
        params: { count: ctx.fleet.reserves },
      });
    if (liveScore != null) {
      reasons.push({
        code: "crowd_live",
        params: {
          score: liveScore,
          total: ctx.crowd.total,
          verified: ctx.crowd.verified,
          loadPct: Math.round(loadNow * 100),
        },
      });
    }
    if (forecastLoad != null) {
      reasons.push({
        code: "forecast_next",
        params: {
          hour: nextHour.hour,
          level: nextHour.level,
          loadPct: Math.round(loadNext * 100),
          confidencePct: Math.round((nextHour.confidence || 0) * 100),
        },
      });
    }

    const intents = ctx.demand?.confirmedIntents || 0;
    if (intents > 0) {
      const extraPax = intents / appShare;
      const add = Math.ceil(extraPax / busCapacity / 2); // 30 dəq horizont ≈ yarım dövrə
      if (add > 0) {
        needed += add;
        reasons.push({
          code: "demand_intents",
          params: {
            intents,
            appSharePct: Math.round(appShare * 100),
            pax: Math.round(extraPax),
          },
        });
      }
    }
    if (ctx.live?.riders)
      reasons.push({
        code: "live_riders",
        params: { riders: ctx.live.riders },
      });
    if (ctx.hotSegments.length) {
      reasons.push({
        code: "hot_segments",
        params: { segments: ctx.hotSegments.slice(0, 2).join("; ") },
      });
    }

    if (alertHigh && needed < 1 && !ctx.fleet.reserves) {
      needed = 1;
      reasons.push({ code: "alert_min_one", params: {} });
    }
    const recommended = Math.max(0, Math.min(needed, maxReservePerAlert));
    if (needed > maxReservePerAlert)
      reasons.push({ code: "limit_max", params: { max: maxReservePerAlert } });

    const samples = ctx.crowd?.total || 0;
    const verifiedShare = samples ? ctx.crowd.verified / samples : 0;
    const confidence = Math.min(
      0.95,
      0.3 + Math.min(samples, 15) / 30 + verifiedShare * 0.2,
    );

    const headwayAfter = ctx.fleet.headwayMin
      ? Math.round((ctx.fleet.headwayMin * n) / (n + recommended))
      : null;
    const loadAfter = Math.round(((load * base) / (n + recommended)) * 100);

    return {
      recommendedBuses: recommended,
      currentBuses: ctx.fleet.buses,
      headwayNowMin: ctx.fleet.headwayMin,
      headwayAfterMin: headwayAfter,
      loadNowPct: Math.round(loadNow * 100),
      loadAfterPct: loadAfter,
      confidence: Math.round(confidence * 100) / 100,
      reasons,
      suggestedStop: this.worstSegmentStop(ctx.route.id),
      generatedAt: new Date().toISOString(),
    };
  }

  /** Strukturlu səbəb → mətn (köhnə sətir səbəblər olduğu kimi qalır) */
  static reasonText(reason, lang = "az") {
    if (typeof reason === "string") return reason;
    const params = { ...(reason?.params || {}) };
    if (params.level) params.levelLabel = t(lang, `crowd.${params.level}`);
    return t(lang, `reason.${reason?.code}`, params);
  }

  static reasonsText(reasons = [], lang = "az") {
    return reasons.map((r) => this.reasonText(r, lang));
  }

  /** Ehtiyat avtobusun xəttə çıxacağı dayanacaq: ən sıx seqmentin başlanğıcı */
  static worstSegmentStop(routeId) {
    const r = fleetService.getRoute(routeId);
    const crowd = analyticsService.routeCrowd(routeId);
    if (!r) return null;
    const worst = [...(crowd?.segments || [])].sort(
      (a, b) =>
        RANK[b.level] - RANK[a.level] || (b.score || 0) - (a.score || 0),
    )[0];
    const idx = worst && worst.level !== "unknown" ? worst.index : 0;
    return {
      index: idx,
      name: r.route.stops[idx].name,
      id: String(r.route.stops[idx]._id),
    };
  }

  static async recommend(routeId) {
    const ctx = await InsightService.routeContext(routeId);
    return { context: ctx, recommendation: this.computeRecommendation(ctx) };
  }

  /** Yeni xəbərdarlığa tövsiyə əlavə edir (AnalyticsService/DemandService hook-u) */
  static async attachRecommendation(alert) {
    const routeId = alert.route?._id || alert.route;
    const { recommendation } = await this.recommend(routeId);
    alert.recommendation = recommendation;
    await RouteAlert.updateOne(
      { _id: alert._id },
      { $set: { recommendation } },
    );
    return alert;
  }

  // ============ ŞABLONLAR ============

  /** Şablonlar istənilən dildə: { type, title, text, fields, createsReserve } */
  static templates(lang = "az") {
    return dispatchTemplates.map((x) => ({
      type: x.type,
      title: pick(x.title, lang),
      text: pick(x.text, lang),
      fields: x.fields,
      createsReserve: !!x.createsReserve,
    }));
  }

  static fillTemplate(type, params = {}, route, lang = "az") {
    const tpl = dispatchTemplates.find((x) => x.type === type);
    if (!tpl) throw i18nError(400, "dispatch.unknownType");
    const values = { route: route?.number, ...params };
    return pick(tpl.text, lang)
      .replace(/\{(\w+)\}/g, (_, k) =>
        values[k] != null && values[k] !== "" ? String(values[k]) : `{${k}}`,
      )
      .replace(/\.\./g, ".");
  }

  // ============ EHTİYAT AVTOBUSLAR ============

  static async createReserveBuses(routeId, count = 1, stopIndex) {
    const r = fleetService.getRoute(routeId);
    if (!r) throw i18nError(404, "route.notFound");
    const { route, geom } = r;
    const idx = stopIndex ?? this.worstSegmentStop(routeId)?.index ?? 0;
    const distance = geom.stopDist[idx] || 0;
    const existing = await Bus.countDocuments({
      route: routeId,
      isReserve: true,
    });
    const created = [];
    for (let i = 0; i < count; i++) {
      const [lat, lng] = GeoService.pointAt(geom, distance);
      const doc = await Bus.create({
        route: routeId,
        plate: `EHT-${route.number}-${String(existing + i + 1).padStart(2, "0")}-${Date.now().toString(36).slice(-3).toUpperCase()}`,
        distance,
        direction: i % 2 === 0 ? 1 : -1,
        lat,
        lng,
        isReserve: true,
      });
      fleetService.addBus(doc.toObject());
      created.push(doc._id);
    }
    socketService.broadcast("buses:update", fleetService.snapshot());
    console.log(`🚌 Ehtiyat: ${count} avtobus → xətt ${route.number}`);
    return created;
  }

  static async recallBuses(busIds = []) {
    if (!busIds.length) return;
    await Bus.updateMany({ _id: { $in: busIds } }, { $set: { active: false } });
    busIds.forEach((id) => fleetService.removeBus(id));
    socketService.broadcast("buses:update", fleetService.snapshot());
  }

  /**
   * Dispetçer əmri: şablon/AI → mətn, lazım olsa ehtiyat avtobus yaradır,
   * bağlı xəbərdarlığı "dispatched" edir və operatorlara yayımlayır.
   */
  static async issueCommand({
    routeId,
    alertId,
    type,
    params = {},
    text,
    source = "manual",
    user,
    lang = "az",
  }) {
    const r = fleetService.getRoute(routeId);
    if (!r) throw i18nError(404, "route.notFound");
    const tpl = dispatchTemplates.find((x) => x.type === type);
    if (!tpl) throw i18nError(400, "dispatch.unknownType");

    const finalText =
      (text && String(text).trim()) ||
      this.fillTemplate(type, params, r.route, lang);
    if (!finalText) throw i18nError(400, "dispatch.emptyText");

    let reserveBuses = [];
    if (tpl.createsReserve) {
      const count = Math.min(
        Math.max(Number(params.count) || 1, 1),
        this.cfg.maxReservePerAlert,
      );
      const stopIndex = params.stop
        ? r.route.stops.findIndex((s) => s.name === params.stop)
        : undefined;
      reserveBuses = await this.createReserveBuses(
        routeId,
        count,
        stopIndex >= 0 ? stopIndex : undefined,
      );
    }

    const command = await DispatchCommand.create({
      route: routeId,
      alert: alertId || undefined,
      type,
      text: finalText,
      params,
      source,
      reserveBuses,
      issuedBy: user?._id,
    });

    let alert = null;
    if (alertId) {
      alert = await RouteAlert.findById(alertId);
      if (alert && alert.status !== "resolved") {
        alert.reserveBuses.push(...reserveBuses);
        alert.transition(
          reserveBuses.length
            ? "dispatched"
            : alert.status === "open"
              ? "acknowledged"
              : alert.status,
          `Əmr: ${pick(tpl.title, "az")}`,
          user?._id,
          { noteKey: "command", noteParams: { type } },
        );
        await alert.save();
        alert = await alert.populate("route", "number name color");
        socketService.toOperators("alert:update", alert);
      }
    }

    const populated = await command.populate([
      { path: "route", select: "number name color" },
      { path: "issuedBy", select: "firstName lastName" },
    ]);
    socketService.toOperators("dispatch:new", populated);
    return { command: populated, alert };
  }

  /** Bazadan sıxlıq səviyyəsinin rəqəm balı (UI üçün) */
  static scoreOf(level) {
    return SCORE_OF[level] || null;
  }

  /** Orta interval (dəq) */
  static headway(routeId) {
    const r = fleetService.getRoute(routeId);
    return r
      ? EtaService.headwayMin(
          r.geom,
          fleetService.busesForRoute(routeId).length,
        )
      : null;
  }
}

export { DispatchService };
