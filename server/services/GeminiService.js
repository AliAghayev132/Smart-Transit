import { config } from "#config";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** ```json ... ``` çərçivəsini təmizləyib parse edir; alınmazsa null */
const parseJson = (raw) => {
  let s = (raw || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const httpError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

/**
 * GeminiService (static)
 * Google Gemini API (generateContent) üçün nazik sarğı.
 * - Açar yalnız serverdə saxlanılır və `x-goog-api-key` başlığı ilə göndərilir (URL-də deyil — loqlara düşmür).
 * - Strukturlu cavab: `responseMimeType: application/json` + `responseSchema`.
 * - Model tapılmasa (404) `fallbackModel` ilə bir dəfə təkrar cəhd olunur.
 */
class GeminiService {
  static get enabled() {
    return !!config.gemini.apiKey;
  }

  static get model() {
    return config.gemini.model;
  }

  static async #call(model, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.gemini.timeoutMs);
    try {
      const res = await fetch(
        `${API_BASE}/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": config.gemini.apiKey,
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error?.message || `Gemini HTTP ${res.status}`;
        // Açar/icazə problemi müştəriyə 503 kimi çatır (daxili detal sızmır)
        const status =
          res.status === 404
            ? 404
            : [400, 401, 403].includes(res.status)
              ? 503
              : 502;
        throw httpError(msg, status);
      }
      const data = await res.json();
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts || [])
        .filter((p) => !p.thought)
        .map((p) => p.text || "")
        .join("")
        .trim();
      if (!text) {
        throw httpError(
          `Gemini empty response (${cand?.finishReason || data.promptFeedback?.blockReason || "unknown"})`,
          502,
        );
      }
      return { text, model: data.modelVersion || model };
    } catch (e) {
      if (e.name === "AbortError") throw httpError("Gemini timed out", 504);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * JSON cavab qaytaran sorğu.
   * @returns {{ data: object, model: string }}
   */
  static async generateJson({
    system,
    prompt,
    schema,
    temperature = 0.2,
    maxOutputTokens = 4096,
  }) {
    if (!this.enabled) throw httpError("Gemini is not configured", 503);
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: "application/json",
        ...(schema ? { responseSchema: schema } : {}),
      },
    };

    let out;
    try {
      out = await this.#call(this.model, body);
    } catch (e) {
      const fb = config.gemini.fallbackModel;
      if (e.statusCode !== 404 || !fb || fb === this.model) throw e;
      out = await this.#call(fb, body);
    }

    const data = parseJson(out.text);
    if (!data || typeof data !== "object") {
      throw httpError("Gemini returned invalid JSON", 502);
    }
    return { data, model: out.model };
  }
}

export { GeminiService, parseJson as parseGeminiJson };
