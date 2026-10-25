import { artistSeed, findSeed, genreSongs } from "./_lib/deezer.js";
import { json, rateLimited, tooMany } from "./_lib/http.js";

// GET /api/seed?artist=11573699  — a suggested artist's top songs
// GET /api/seed?genre=bedroom pop — songs from a playlist of that genre
// GET /api/seed?q=clairo          — best guess at whichever it is
export async function GET(req: Request): Promise<Response> {
  if (rateLimited(req, "seed", 120)) return tooMany();
  const params = new URL(req.url).searchParams;
  const artist = Number(params.get("artist"));
  const genre = params.get("genre")?.trim().slice(0, 60);
  const query = params.get("q")?.trim().slice(0, 60);

  const seed = artist ? await artistSeed(artist) : genre ? await genreSongs(genre) : query ? await findSeed(query) : null;
  if (!seed) {
    const what = genre ?? query;
    return json({ error: what ? `couldn't find "${what}" — try another spelling or a broader genre` : "type an artist, genre or song" }, 404);
  }
  return json(seed, 200, { "Cache-Control": "public, s-maxage=86400" });
}
