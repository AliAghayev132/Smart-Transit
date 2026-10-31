import { config } from "#config";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Strip a leading/trailing markdown code fence (```json ... ```), then parse.
 * Returns the parsed value or null on failure.
 */
const tryParseJson = (raw) => {
  let cleaned = (raw || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

/**
 * AIService (static)
 * OpenRouter (OpenAI-uyğun) chat completions sarğısı.
 * Açar yoxdursa `enabled === false`; çağıran servislər qayda əsaslı fallback istifadə edir.
 */
class AIService {
  static get enabled() {
    return !!config.ai.apiKey;
  }

  static get model() {
    return config.ai.model;
  }

  static get reasoningModel() {
    return config.ai.reasoningModel || config.ai.model;
  }

  /**
   * Bir chat sorğusu. tools verilərsə, model tool_calls qaytara bilər.
   * @returns {{ content: string, toolCalls: Array, message: object }}
   */
  static async complete({
    messages,
    model = this.model,
    temperature = 0.3,
    maxTokens = 800,
    tools,
    json = false,
  }) {
    if (!this.enabled) {
      const err = new Error("AI service is not configured");
      err.statusCode = 503;
      throw err;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.ai.timeoutMs);
    try {
      const body = { model, messages, temperature, max_tokens: maxTokens };
      if (tools?.length) {
        body.tools = tools;
        body.tool_choice = "auto";
      }
      if (json) body.response_format = { type: "json_object" };

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.ai.apiKey}`,
          "HTTP-Referer": config.appUrl,
          "X-Title": `${config.siteName}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          "❌ OpenRouter error:",
          errorData?.error?.message || response.status,
        );
        const err = new Error(errorData?.error?.message || "AI service error");
        err.statusCode = response.status === 401 ? 503 : 502;
        throw err;
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message || {};
      return {
        content: (message.content || "").trim(),
        toolCalls: message.tool_calls || [],
        message,
      };
    } catch (e) {
      if (e.name === "AbortError") {
        const err = new Error("AI response timed out");
        err.statusCode = 504;
        throw err;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /** JSON cavab gözlənilən sorğu (parse olunmazsa null) */
  static async completeJson(opts) {
    const { content } = await this.complete({ ...opts, json: true });
    return tryParseJson(content);
  }

  /**
   * Tool-calling dövrü: model alət çağırır → server icra edir → nəticə modelə qayıdır.
   * executors: { [toolName]: async (args) => result }
   */
  static async runWithTools({
    system,
    messages,
    tools,
    executors,
    maxSteps = 4,
    model,
    temperature = 0.2,
  }) {
    const convo = [{ role: "system", content: system }, ...messages];
    const used = [];
    for (let step = 0; step < maxSteps; step++) {
      const { content, toolCalls, message } = await this.complete({
        messages: convo,
        tools,
        model,
        temperature,
        maxTokens: 900,
      });
      if (!toolCalls.length) return { content, toolsUsed: used };
      convo.push({
        role: "assistant",
        content: message.content || "",
        tool_calls: toolCalls,
      });
      for (const call of toolCalls) {
        const name = call.function?.name;
        const args = tryParseJson(call.function?.arguments) || {};
        let result;
        try {
          result = executors[name]
            ? await executors[name](args)
            : { error: `Unknown tool: ${name}` };
        } catch (e) {
          result = { error: e.message };
        }
        used.push({ name, args });
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 6000),
        });
      }
    }
    const { content } = await this.complete({
      messages: convo,
      model,
      temperature,
      maxTokens: 700,
    });
    return { content, toolsUsed: used };
  }
}

export { AIService, tryParseJson };
