import { suggest } from "./_lib/deezer.js";
import { json, rateLimited, tooMany } from "./_lib/http.js";

// GET /api/suggest?q=white flag  →  { artists: [...], songs: [...] }, while someone types.
export async function GET(req: Request): Promise<Response> {
  if (rateLimited(req, "suggest", 600)) return tooMany();
  const query = new URL(req.url).searchParams.get("q")?.trim().slice(0, 60);
  if (!query || query.length < 2) return json({ artists: [], songs: [] });
  const found = await suggest(query);
  // Deezer refused both searches: say so, and don't let the CDN keep the empty answer.
  if (!found) return json({ error: "search is busy, try again in a moment" }, 503);
  return json(found, 200, { "Cache-Control": "public, s-maxage=3600" });
}
