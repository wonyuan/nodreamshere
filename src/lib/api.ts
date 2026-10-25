import type { Album, Poem, PoemRequest, Seed, SongReading, Suggestions, Track } from "./types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "something went wrong — try again");
  return json as T;
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function fetchCovers(): Promise<Album[]> {
  try {
    return (await call<{ albums: Album[] }>("/api/covers")).albums;
  } catch {
    return [];
  }
}

// Matches for what someone's typing: artists and individual songs.
export const fetchSuggestions = (query: string) => call<Suggestions>(`/api/suggest?q=${encodeURIComponent(query)}`);

// An artist (by Deezer id), a genre, or a best guess from free text, resolved to songs.
export const fetchSeed = (by: { artist: number } | { genre: string } | { q: string }) =>
  call<Seed>(`/api/seed?${new URLSearchParams(Object.entries(by).map(([k, v]) => [k, String(v)]))}`);

// What each song is about. Fetched once per set of nine and reused for "write another".
export const readSongs = (tracks: Track[]) =>
  call<{ readings: SongReading[] }>("/api/read", post({ tracks })).then((r) => r.readings);

export const writePoem = (body: PoemRequest) => call<Poem>("/api/poem", post(body));
