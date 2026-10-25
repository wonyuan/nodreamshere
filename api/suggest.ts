import { suggest } from "./_lib/deezer.js";
import { json, rateLimited, tooMany } from "./_lib/http.js";

// GET /api/suggest?q=white flag  →  { artists: [...], songs: [...] }, while someone types.
export async function GET(req: Request): Promise<Response> {
  if (rateLimited(req, "suggest", 600)) return tooMany();
  const query = new URL(req.url).searchParams.get("q")?.trim().slice(0, 60);
  if (!query || query.length < 2) return json({ artists: [], songs: [] });
  return json(await suggest(query), 200, { "Cache-Control": "public, s-maxage=3600" });
}
