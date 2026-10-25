import type { Seed, Suggestions, Track } from "../../src/lib/types";

// Deezer's public API: free, no key, no login and no user cap. Used to turn the artists,
// genres and songs someone names into songs for the captcha.

const DEEZER = "https://api.deezer.com";

type DzTrack = {
  id: number;
  title: string;
  rank?: number;
  duration: number;
  artist: { name: string };
  album: { title: string; cover_medium?: string };
};
type DzArtist = { id: number; name: string; nb_fan: number; picture_medium?: string };
type DzPlaylist = { id: number; title: string; nb_tracks: number };

async function dz<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(DEEZER + path, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.error ? null : (json as T);
  } catch {
    return null;
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// How alike two names are, 0–1, by edit distance — so "phobe bridgers" still finds Phoebe Bridgers.
function similarity(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length);
}

const toTrack = (t: DzTrack): Track => ({
  id: `dz-${t.id}`,
  name: t.title,
  artists: [t.artist.name],
  album: t.album.title,
  albumArt: t.album.cover_medium ?? null,
  isrc: null,
  durationMs: t.duration * 1000,
  // These songs don't come from Spotify, so link to a Spotify search for them instead.
  url: `https://open.spotify.com/search/${encodeURIComponent(`${t.title} ${t.artist.name}`)}`,
});

async function artistSongs(artist: DzArtist): Promise<Seed | null> {
  const top = await dz<{ data: DzTrack[] }>(`/artist/${artist.id}/top?limit=25`);
  const tracks = (top?.data ?? []).map(toTrack);
  return tracks.length ? { kind: "artist", label: artist.name, tracks, image: artist.picture_medium ?? null } : null;
}

export async function artistSeed(id: number): Promise<Seed | null> {
  const artist = await dz<DzArtist>(`/artist/${id}`);
  return artist ? artistSongs(artist) : null;
}

// A genre is read from a playlist named after it ("bedroom pop", "midwest emo"…), which
// copes with niche genres far better than Deezer's ~20 broad genre categories.
export async function genreSongs(query: string): Promise<Seed | null> {
  const found = await dz<{ data: DzPlaylist[] }>(`/search/playlist?q=${encodeURIComponent(query)}&limit=10`);
  const playlists = (found?.data ?? []).filter((p) => p.nb_tracks >= 20);
  const playlist = playlists.find((p) => norm(p.title).includes(norm(query))) ?? playlists[0];
  if (!playlist) return null;
  const list = await dz<{ data: DzTrack[] }>(`/playlist/${playlist.id}/tracks?limit=100`);
  const tracks = (list?.data ?? []).filter((t) => t.album?.cover_medium).map(toTrack);
  return tracks.length ? { kind: "genre", label: query.toLowerCase(), tracks } : null;
}

// An artist whose name matches (allowing typos) first, then a genre playlist, then the
// closest artist. Tiny artists that happen to share a genre's name ("Midwest Emo") are skipped.
export async function findSeed(query: string): Promise<Seed | null> {
  const artists = (await dz<{ data: DzArtist[] }>(`/search/artist?q=${encodeURIComponent(query)}&limit=5`))?.data ?? [];
  const named = artists.find((a) => a.nb_fan >= 1000 && similarity(a.name, query) >= 0.8);
  const asArtist = named ? await artistSongs(named) : null;
  if (asArtist) return asArtist;
  return (await genreSongs(query)) ?? (artists[0] ? artistSongs(artists[0]) : null);
}

// Live matches while typing: well-known artists and individual songs.
export async function suggest(query: string): Promise<Suggestions> {
  const q = encodeURIComponent(query);
  const [artists, songs] = await Promise.all([
    dz<{ data: DzArtist[] }>(`/search/artist?q=${q}&limit=5`),
    dz<{ data: DzTrack[] }>(`/search/track?q=${q}&limit=6`),
  ]);
  const seen = new Set<string>();
  return {
    artists: (artists?.data ?? [])
      .filter((a) => a.nb_fan >= 1000)
      .slice(0, 2)
      .map((a) => ({ id: a.id, name: a.name, image: a.picture_medium ?? null })),
    songs: (songs?.data ?? [])
      .filter((t) => t.album?.cover_medium)
      .filter((t) => {
        const key = `${t.title.replace(/\s*\(.*?\)/g, "")}|${t.artist.name}`.toLowerCase();
        return seen.has(key) ? false : (seen.add(key), true);
      })
      .slice(0, 4)
      // Deezer's rank is a popularity score; ~150k and up is a song people know by title.
      .map((t) => ({ track: toTrack(t), popular: (t.rank ?? 0) >= 150_000 })),
  };
}
