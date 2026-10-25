import type { Track } from "../../src/lib/types";
import { LlmError } from "./llm";

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

// Best-effort, per-instance limit so a public link can't burn through the LLM credits.
// Good enough for a small app; a shared store (e.g. Upstash) would make it exact.
const hits = new Map<string, number[]>();

export function rateLimited(req: Request, bucket: string, limit: number, windowMs = 60 * 60 * 1000): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  const limited = recent.length >= limit;
  if (!limited) recent.push(now);
  hits.set(key, recent);
  return limited;
}

export const tooMany = () => json({ error: "slow down a little — try again in a while" }, 429);

export function parseTracks(raw: unknown): Track[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 9) return null;
  const tracks = raw.filter((t): t is Track => typeof t?.name === "string" && Array.isArray(t.artists));
  return tracks.length === raw.length ? tracks : null;
}

export function llmFailure(err: unknown): Response {
  console.error(err);
  const message =
    err instanceof LlmError && !err.status
      ? err.message // setup problems, like a missing key
      : err instanceof DOMException && err.name === "TimeoutError"
        ? "the poet took too long — try again"
        : "the poet is unavailable right now";
  return json({ error: message }, 502);
}
