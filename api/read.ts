import { json, llmFailure, parseTracks, rateLimited, tooMany } from "./_lib/http";
import { readSongs } from "./_lib/reading";

// POST /api/read  { tracks }  →  { readings }
// Called as soon as someone settles on their nine songs, so the slow reading step is done
// by the time they've typed how they feel.
export async function POST(req: Request): Promise<Response> {
  if (rateLimited(req, "read", 30)) return tooMany();
  const tracks = parseTracks((await req.json().catch(() => null))?.tracks);
  if (!tracks) return json({ error: "bad request" }, 400);
  try {
    return json({ readings: await readSongs(tracks) });
  } catch (err) {
    return llmFailure(err);
  }
}
