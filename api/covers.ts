// Album covers for the title-screen reel, shown before anyone has signed in.
// Deezer's public chart needs no key, and its albums are the same ones on Spotify.

export async function GET(): Promise<Response> {
  let covers: string[] = [];
  try {
    const res = await fetch("https://api.deezer.com/chart/0/albums?limit=40", { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    covers = (json.data ?? []).map((a: { cover_medium: string }) => a.cover_medium).filter(Boolean);
  } catch {
    // An empty reel still works: the windows just show the card underneath.
  }
  return new Response(JSON.stringify({ covers }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=3600" },
  });
}
