// Album covers for the title-screen reel, shown before anyone has signed in.
// Deezer's public chart needs no key, and its albums are the same ones on Spotify.

import type { Album } from "../src/lib/types";

type DeezerAlbum = { cover_medium?: string; title?: string; artist?: { name?: string } };

export async function GET(): Promise<Response> {
  let albums: Album[] = [];
  try {
    const res = await fetch("https://api.deezer.com/chart/0/albums?limit=40", { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    albums = ((json.data ?? []) as DeezerAlbum[])
      .filter((a) => a.cover_medium)
      .map((a) => ({ cover: a.cover_medium!, title: a.title ?? "", artist: a.artist?.name ?? "" }));
  } catch {
    // An empty reel still works: the windows just show the card underneath.
  }
  return new Response(JSON.stringify({ albums }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=3600" },
  });
}
