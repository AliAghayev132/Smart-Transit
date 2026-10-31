import { t } from "#utils";
import { AIService } from "#services/AIService.js";
import { DispatchService } from "#services/DispatchService.js";
import { PlannerService } from "#services/PlannerService.js";
import { EtaService } from "#services/EtaService.js";
import { fleetService } from "#services/FleetService.js";
import { analyticsService } from "#services/AnalyticsService.js";

/** Azərbaycan hərflərini sadələşdirir (axtarış üçün) */
const norm = (s) =>
  (s || "")
    .toLocaleLowerCase("az")
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");

/** Kiril → latın (rus dilində yazılmış dayanacaq adlarını tanımaq üçün: «Сахил» → "sahil") */
const CYR = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "c",
  ш: "s",
  щ: "s",
  ъ: "",
  ы: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};
const translit = (s) =>
  (s || "").toLocaleLowerCase("az").replace(/[а-яё]/g, (ch) => CYR[ch] ?? ch);

/**
 * Mətn variantları: AZ normallaşdırma + kiril translit + ingilis transliterasiyası
 * ("Icherisheher" → "iceriseher", "Ajami" → "acami"); dayanacaq açarlarında "ə" həm "e", həm "a" kimi.
 */
const variants = (s) => {
  const base = norm(translit(s));
  const latin = base
    .replace(/dzh/g, "c")
    .replace(/sh/g, "s")
    .replace(/ch/g, "c")
    .replace(/kh/g, "x")
    .replace(/j/g, "c");
  return [...new Set([base, latin].map(fuzzy))];
};

/** "ə" rus/ingilis yazılışında həm "a", həm "e" ola bilər (Əhmədli → Ахмедли / Ahmadli) — a/e eyniləşdirilir */
const fuzzy = (s) => s.replace(/a/g, "e");

/** Dayanacaq adının açarları: tam ad + çoxsözlü adın son sözü («Nəriman Nərimanov» → "nerimenov") */
const stopKeys = (name) => {
  const full = fuzzy(norm(name).replace(/ m\.$/, "").trim());
  const words = full.split(/[\s/–-]+/).filter((w) => w.length >= 5);
  return [
    ...new Set([full, ...(words.length > 1 ? [words[words.length - 1]] : [])]),
  ];
};

const LANG_NAME = { az: "Azerbaijani", en: "English", ru: "Russian" };
const lvl = (lang, level) => t(lang, `crowd.${level || "unknown"}`);

// Bütün dillərdə "ən az sıx" / "rahat" niyyəti
const LEAST_CROWDED =
  /en az sixl|az sixl|bos avtobus|bosdur|least crowded|less crowded|emptiest|quietest|свободн|наименее загруж|менее загруж|самый пуст/;
const COMFORT =
  /az six|rahat|bos|less crowded|least crowded|comfort|empty|quiet|свобод|менее загруж|наименее|комфорт|пуст/;

/**
 * AssistantService (static)
 *  - Operator: xətt üzrə qısa AI xülasəsi + dispetçer tövsiyəsinin izahı və hazır əmr mətni.
 *  - Sərnişin: Transit Chatbot (tool calling — real-vaxt datanı alətlərlə alır, uydurmur).
 * Bütün cavablar sorğunun dilində (az | en | ru). AI açarı yoxdursa qayda əsaslı (rules) cavab
 * qaytarılır — funksionallıq itmir.
 */
class AssistantService {
  // ============ OPERATOR ============

  static rulesSummary(ctx, rec, lang = "az") {
    const c = ctx.crowd;
    const number = ctx.route.number;
    const parts = [];
    parts.push(
      c
        ? t(lang, "summary.crowd", {
            number,
            windowMin: c.windowMin,
            total: c.total,
            levelLabel: lvl(lang, c.level),
            trendLabel: t(lang, `trend.${c.trend}`),
          })
        : t(lang, "summary.noReports", { number }),
    );
    if (c?.loadPct != null)
      parts.push(t(lang, "summary.load", { loadPct: c.loadPct }));
    if (ctx.hotSegments.length)
      parts.push(
        t(lang, "summary.hot", {
          segment: ctx.hotSegments[0].replace(/\.$/, ""),
        }),
      );
    const next = ctx.forecast?.[1];
    if (next)
      parts.push(
        t(lang, "summary.forecast", {
          hour: next.hour,
          levelLabel: lvl(lang, next.level),
        }),
      );
    if (ctx.demand.confirmedIntents)
      parts.push(
        t(lang, "summary.demand", { count: ctx.demand.confirmedIntents }),
      );
    if (rec) {
      parts.push(
        rec.recommendedBuses
          ? t(lang, "summary.recommend", {
              count: rec.recommendedBuses,
              before: rec.headwayNowMin,
              after: rec.headwayAfterMin,
            })
          : t(lang, "summary.noNeed"),
      );
    }
    return parts.join(" ");
  }

  /** LLM üçün: strukturlu səbəblər həmin dildə mətnə çevrilir */
  static llmPayload(context, recommendation, lang) {
    return JSON.stringify({
      context,
      recommendation: {
        ...recommendation,
        reasons: DispatchService.reasonsText(recommendation.reasons, lang),
      },
    });
  }

  static async routeSummary(routeId, lang = "az") {
    const { context, recommendation } =
      await DispatchService.recommend(routeId);
    const fallback = {
      text: this.rulesSummary(context, recommendation, lang),
      source: "rules",
    };
    if (!AIService.enabled) return { ...fallback, context, recommendation };
    try {
      const { content } = await AIService.complete({
        messages: [
          {
            role: "system",
            content:
              "You are a dispatcher assistant for Baku public transport. " +
              `Write in ${LANG_NAME[lang]} only, 3-4 short sentences, summarising the route: current crowding and estimated load, ` +
              "the most problematic section, the next-hour forecast and the recommendation. " +
              "Use ONLY the numbers provided, invent nothing, and NEVER change the recommended number of buses. " +
              "Keep stop names exactly as given.",
          },
          {
            role: "user",
            content: this.llmPayload(context, recommendation, lang),
          },
        ],
        temperature: 0.2,
        maxTokens: 300,
      });
      return {
        text: content || fallback.text,
        source: "ai",
        model: AIService.model,
        context,
        recommendation,
      };
    } catch (e) {
      return { ...fallback, error: e.message, context, recommendation };
    }
  }

  /** Tövsiyənin izahı + hazır dispetçer əmri (AI) */
  static async explainRecommendation(routeId, lang = "az") {
    const { context, recommendation } =
      await DispatchService.recommend(routeId);
    const params = {
      count: recommendation.recommendedBuses || 1,
      stop: recommendation.suggestedStop?.name,
    };
    const rulesCommand = DispatchService.fillTemplate(
      "RESERVE_RELEASE",
      params,
      context.route,
      lang,
    );
    const base = {
      recommendation,
      rationale: DispatchService.reasonsText(recommendation.reasons, lang).join(
        ". ",
      ),
      command: { type: "RESERVE_RELEASE", text: rulesCommand, params },
      source: "rules",
    };
    if (!AIService.enabled) return base;
    try {
      const json = await AIService.completeJson({
        model: AIService.reasoningModel,
        messages: [
          {
            role: "system",
            content:
              "You are a dispatcher assistant. Justify the given recommendation (recommendedBuses) WITHOUT changing it. " +
              `Write in ${LANG_NAME[lang]} only. ` +
              'Reply as JSON: {"rationale": "2-3 sentences", "commandText": "a short order to send to drivers/the depot"}. ' +
              "Invent no numbers; keep stop names exactly as given.",
          },
          {
            role: "user",
            content: this.llmPayload(context, recommendation, lang),
          },
        ],
        temperature: 0.2,
        maxTokens: 400,
      });
      if (!json) return base;
      return {
        ...base,
        rationale: json.rationale || base.rationale,
        command: {
          ...base.command,
          text: json.commandText || base.command.text,
        },
        source: "ai",
        model: AIService.reasoningModel,
      };
    } catch (e) {
      return { ...base, error: e.message };
    }
  }

  // ============ SƏRNİŞİN CHATBOT ============

  static findStops(query, limit = 5) {
    const qs = variants(query)
      .map((v) => v.trim())
      .filter(Boolean);
    if (!qs.length) return [];
    const seen = new Map();
    for (const { route } of fleetService.routes.values()) {
      for (const s of route.stops) {
        const keys = stopKeys(s.name);
        const hit = qs.some((q) =>
          keys.some((k) => k.includes(q) || q.includes(k)),
        );
        if (!hit) continue;
        const cur = seen.get(s.name) || {
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          routes: [],
        };
        if (!cur.routes.includes(route.number)) cur.routes.push(route.number);
        seen.set(s.name, cur);
      }
    }
    return [...seen.values()].slice(0, limit);
  }

  static routeStatus(number, lang = "az") {
    const r = fleetService.findRouteByNumber(number);
    if (!r) return { error: t(lang, "chat.routeNotFound", { number }) };
    const c = analyticsService.routeCrowd(r.route._id);
    return {
      number: r.route.number,
      name: r.route.name,
      crowd: c
        ? {
            level: c.level,
            label: lvl(lang, c.level),
            loadPct: c.loadPct,
            reports: c.total,
            trend: c.trend,
          }
        : null,
      buses: fleetService.busesForRoute(r.route._id).length,
      headwayMin: DispatchService.headway(r.route._id),
      stops: r.route.stops.map((s) => s.name),
    };
  }

  static stopArrivals(number, stopName, lang = "az") {
    const r = fleetService.findRouteByNumber(number);
    if (!r) return { error: t(lang, "chat.routeNotFound", { number }) };
    const qs = variants(stopName);
    const idx = r.route.stops.findIndex((s) =>
      stopKeys(s.name).some((k) =>
        qs.some((q) => k.includes(q) || q.includes(k)),
      ),
    );
    if (idx < 0)
      return {
        error: t(lang, "chat.stopNotOnRoute", { stop: stopName }),
        stops: r.route.stops.map((s) => s.name),
      };
    const list = EtaService.forStop(fleetService, r.route._id, idx, 3);
    return {
      stop: r.route.stops[idx].name,
      arrivals: list.map((a) => {
        const bc = analyticsService.cache?.buses[a.busId];
        return {
          inMin: Math.round(a.etaSec / 60),
          headsign: a.headsign,
          plate: a.plate,
          crowd: lvl(lang, bc?.level),
          loadPct: bc?.loadPct ?? null,
        };
      }),
    };
  }

  /** Dəqiq ad uyğunluğu (rules chat dayanacağı artıq tanıyıb) → yoxdursa axtarış */
  static resolveStop(name) {
    for (const { route } of fleetService.routes.values()) {
      const s = route.stops.find((x) => x.name === name);
      if (s) return { name: s.name, lat: s.lat, lng: s.lng };
    }
    return this.findStops(name, 1)[0];
  }

  static planTrip(fromName, toName, prefer = "fast", lang = "az") {
    const from = this.resolveStop(fromName);
    const to = this.resolveStop(toName);
    if (!from || !to)
      return {
        error: t(lang, "chat.endpointsNotFound"),
        suggestions: this.findStops(fromName || toName),
      };
    const its = PlannerService.plan(
      fleetService,
      analyticsService.cache,
      from,
      to,
      { prefer, limit: 3 },
    );
    return {
      from: from.name,
      to: to.name,
      options: its.map((it) => {
        const busLegs = it.legs.filter((l) => l.type !== "walk");
        return {
          totalMin: Math.round(it.totalSec / 60),
          summary: busLegs.length
            ? busLegs.map((l) => `№${l.number}`).join(" → ")
            : t(lang, "chat.walkOnly"),
          crowd: lvl(lang, it.crowd),
          loadPct: it.loadPct ?? null,
          tags: it.tags,
          steps: it.legs
            .filter((l) => l.type !== "walk" || l.distanceM > 20) // dayanacağın özündən başlayanda "0 m piyada" göstərmə
            .map((l) =>
              l.type === "walk"
                ? t(lang, "chat.stepWalk", { meters: l.distanceM })
                : t(lang, "chat.stepBus", {
                    number: l.number,
                    from: l.from.name,
                    to: l.to.name,
                    wait: Math.round(l.waitSec / 60),
                    stops: l.stopsCount,
                    crowd: lvl(lang, l.crowd.level),
                  }),
            ),
        };
      }),
    };
  }

  static chatTools() {
    const fn = (name, description, properties, required = []) => ({
      type: "function",
      function: {
        name,
        description,
        parameters: { type: "object", properties, required },
      },
    });
    return [
      fn(
        "list_routes",
        "All bus routes with their current crowding level and estimated load %",
        {},
      ),
      fn(
        "find_stops",
        "Search stops by name (Azerbaijani names; Cyrillic spelling is accepted)",
        { query: { type: "string" } },
        ["query"],
      ),
      fn(
        "route_status",
        "Route's current crowding, estimated load, number of buses, headway and stops",
        { number: { type: "string" } },
        ["number"],
      ),
      fn(
        "stop_arrivals",
        "Buses arriving at a stop (minutes) and how crowded each one is",
        { number: { type: "string" }, stop: { type: "string" } },
        ["number", "stop"],
      ),
      fn(
        "plan_trip",
        "Route options from A to B (by stop names). prefer=comfort favours less crowded buses",
        {
          from: { type: "string" },
          to: { type: "string" },
          prefer: { type: "string", enum: ["fast", "comfort"] },
        },
        ["from", "to"],
      ),
    ];
  }

  static chatExecutors(lang = "az") {
    return {
      list_routes: () =>
        [...fleetService.routes.values()].map(({ route }) => {
          const c = analyticsService.routeCrowd(route._id);
          return {
            number: route.number,
            name: route.name,
            crowd: lvl(lang, c?.level),
            loadPct: c?.loadPct ?? null,
          };
        }),
      find_stops: ({ query }) => this.findStops(query),
      route_status: ({ number }) => this.routeStatus(number, lang),
      stop_arrivals: ({ number, stop }) =>
        this.stopArrivals(number, stop, lang),
      plan_trip: ({ from, to, prefer }) =>
        this.planTrip(from, to, prefer, lang),
    };
  }

  /** AI açarı olmadıqda sadə qayda əsaslı cavab (sual istənilən dildə ola bilər, cavab — lang dilində) */
  static rulesChat(text, lang = "az") {
    const raw = (text || "").toLocaleLowerCase("az");
    const qs = variants(text);
    const num = ((text || "").match(/(?:№|#|\b)(\d{1,3})\b/) || [])[1];
    // Mətndə adı çəkilən dayanacaqlar: hər uyğunluq üçün mövqe; üst-üstə düşənlərdən ən uzun açar qalır
    // («Sahil» həm "Sahil m.", həm "Bayıl yolu / Sahil" ilə uyğun gəlir → tam adlı "Sahil m." seçilir)
    const hits = [];
    for (const { route } of fleetService.routes.values()) {
      for (const s of route.stops) {
        for (const k of stopKeys(s.name).filter((x) => x.length >= 3)) {
          for (const q of qs) {
            const i = q.indexOf(k);
            if (i >= 0)
              hits.push({
                name: s.name,
                pos: i,
                end: i + k.length,
                full: k === stopKeys(s.name)[0],
              });
          }
        }
      }
    }
    hits.sort(
      (a, b) =>
        a.pos - b.pos || b.end - b.pos - (a.end - a.pos) || b.full - a.full,
    );
    const stopsMentioned = [];
    let lastEnd = -1;
    for (const h of hits) {
      if (h.pos < lastEnd || stopsMentioned.includes(h.name)) continue;
      stopsMentioned.push(h.name);
      lastEnd = h.end;
    }

    if (stopsMentioned.length >= 2) {
      const prefer =
        COMFORT.test(raw) || qs.some((q) => COMFORT.test(q))
          ? "comfort"
          : "fast";
      const p = this.planTrip(
        stopsMentioned[0],
        stopsMentioned[1],
        prefer,
        lang,
      );
      if (p.options?.length) {
        const best = p.options[0];
        return t(lang, "chat.tripBest", {
          from: p.from,
          to: p.to,
          summary: best.summary,
          min: best.totalMin,
          crowd: best.crowd,
          steps: best.steps.join("; "),
        });
      }
      return t(lang, "chat.noTrip");
    }
    if (LEAST_CROWDED.test(raw) || qs.some((q) => LEAST_CROWDED.test(q))) {
      const list = (analyticsService.cache?.routes || [])
        .filter((r) => r.level !== "unknown")
        .sort((a, b) => (a.score || 9) - (b.score || 9));
      if (list.length)
        return t(lang, "chat.leastCrowded", {
          number: list[0].number,
          name: list[0].name,
          crowd: lvl(lang, list[0].level),
        });
      return t(lang, "chat.notEnoughData");
    }
    if (num) {
      const s = this.routeStatus(num, lang);
      if (s.error) return s.error;
      return t(lang, "chat.routeStatus", {
        number: s.number,
        name: s.name,
        crowd: s.crowd?.label || lvl(lang, "unknown"),
        buses: s.buses,
        headway: s.headwayMin,
      });
    }
    return t(lang, "chat.help");
  }

  static async chat(messages, lang = "az") {
    const clean = (messages || [])
      .filter(
        (m) =>
          ["user", "assistant"].includes(m.role) &&
          typeof m.content === "string",
      )
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));
    const last = [...clean].reverse().find((m) => m.role === "user");
    if (!last) return { reply: this.rulesChat("", lang), source: "rules" };

    if (!AIService.enabled)
      return { reply: this.rulesChat(last.content, lang), source: "rules" };
    try {
      const { content, toolsUsed } = await AIService.runWithTools({
        system:
          "You are the «Smart Transit» assistant for Baku buses. " +
          `Always reply in ${LANG_NAME[lang]}, briefly and precisely. ` +
          "Answer about routes, arrival times and crowding ONLY from tool results; if you don't know, say so. " +
          `Crowding levels: ${lvl(lang, "low")}, ${lvl(lang, "mid")}, ${lvl(lang, "high")}. ` +
          "Keep stop and route names exactly as the tools return them. Politely decline questions unrelated to transport.",
        messages: clean,
        tools: this.chatTools(),
        executors: this.chatExecutors(lang),
      });
      return {
        reply: content || this.rulesChat(last.content, lang),
        source: "ai",
        model: AIService.model,
        toolsUsed,
      };
    } catch (e) {
      return {
        reply: this.rulesChat(last.content, lang),
        source: "rules",
        error: e.message,
      };
    }
  }
}

export { AssistantService };
