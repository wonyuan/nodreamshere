// One small switch between Cohere and OpenAI, chosen with LLM_PROVIDER in .env.
// Both are asked for a JSON object back. "fast" picks a quicker model for simple jobs.

type Options = { fast?: boolean };

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
  // Provider hiccups (5xx) and rate limits (429) are worth one more try.
  get retryable() {
    return this.status === 429 || this.status >= 500;
  }
}

async function cohere(system: string, user: string, { fast }: Options): Promise<string> {
  const key = process.env.COHERE_API_KEY;
  if (!key) throw new LlmError("COHERE_API_KEY is missing from .env");
  const res = await fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: fast
        ? process.env.COHERE_FAST_MODEL || "command-a-03-2025"
        : process.env.COHERE_MODEL || "command-a-reasoning-08-2025",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new LlmError(`Cohere ${res.status}: ${await res.text()}`, res.status);
  const json = await res.json();
  const part = json.message?.content?.find((c: { type: string }) => c.type === "text");
  return part?.text ?? "";
}

async function openai(system: string, user: string, { fast }: Options): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new LlmError("OPENAI_API_KEY is missing from .env");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: fast
        ? process.env.OPENAI_FAST_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini"
        : process.env.OPENAI_MODEL || "gpt-5.4-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new LlmError(`OpenAI ${res.status}: ${await res.text()}`, res.status);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export async function completeJson<T>(system: string, user: string, options: Options = {}): Promise<T> {
  const provider = (process.env.LLM_PROVIDER || "cohere").toLowerCase();
  const call = provider === "openai" ? openai : cohere;
  let raw: string;
  try {
    raw = await call(system, user, options);
  } catch (err) {
    if (!(err instanceof LlmError && err.retryable)) throw err;
    await new Promise((r) => setTimeout(r, 1500));
    raw = await call(system, user, options);
  }
  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new LlmError(`model returned something that isn't JSON: ${cleaned.slice(0, 200)}`);
  }
}
