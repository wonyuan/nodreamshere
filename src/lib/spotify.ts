import type { Track } from "./types";

// Authorization Code with PKCE: runs entirely in the browser, so no client secret is needed.

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
const SCOPES = "user-top-read";
const TOKEN_KEY = "gmp_token";
const VERIFIER_KEY = "gmp_verifier";
const STATE_KEY = "gmp_state";

export type TimeRange = "short_term" | "medium_term" | "long_term";

export const RANGE_LABELS: Record<TimeRange, string> = {
  short_term: "last 4 weeks",
  medium_term: "last 6 months",
  long_term: "last year",
};

export const isConfigured = () => Boolean(CLIENT_ID);

export const redirectUri = () => `${window.location.origin}/callback`;

function randomString(bytes: number) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(data);
}

function base64url(data: Uint8Array) {
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function login() {
  if (!CLIENT_ID) throw new Error("VITE_SPOTIFY_CLIENT_ID is missing from .env");
  const verifier = randomString(64);
  const state = randomString(16);
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

// React's StrictMode runs effects twice in dev; an auth code can only be exchanged once.
let callbackPromise: Promise<void> | null = null;

export const isCallback = () => window.location.pathname === "/callback";

export function handleCallback(): Promise<void> {
  callbackPromise ??= exchangeCode().finally(() => window.history.replaceState(null, "", "/"));
  return callbackPromise;
}

async function exchangeCode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("error")) throw new Error(`spotify said: ${params.get("error")}`);
  const code = params.get("code");
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!code || !verifier || params.get("state") !== sessionStorage.getItem(STATE_KEY)) {
    throw new Error("that spotify sign-in didn't line up, try again");
  }
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error("spotify sign-in failed, try again");
  const json = await res.json();
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }));
}

export function getToken(): string | null {
  const raw = sessionStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  const { token, expiresAt } = JSON.parse(raw) as { token: string; expiresAt: number };
  return Date.now() < expiresAt - 60_000 ? token : null;
}

export class SpotifyAuthError extends Error {}

type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string; width: number }[] };
  external_ids?: { isrc?: string };
  external_urls: { spotify: string };
};

export async function topTracks(range: TimeRange): Promise<Track[]> {
  const token = getToken();
  if (!token) throw new SpotifyAuthError("please reconnect spotify");
  const res = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${range}&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new SpotifyAuthError("please reconnect spotify");
  if (res.status === 403) {
    throw new SpotifyAuthError("spotify login only works for invited accounts — try “name your artists” instead");
  }
  if (!res.ok) throw new Error(`spotify hiccuped (${res.status}), try again`);
  const json = (await res.json()) as { items: SpotifyTrack[] };
  return json.items.map((t) => ({
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => a.name),
    album: t.album.name,
    // Images come widest first; the 300px one is plenty for a tile.
    albumArt: t.album.images.find((i) => i.width <= 320)?.url ?? t.album.images[0]?.url ?? null,
    isrc: t.external_ids?.isrc ?? null,
    durationMs: t.duration_ms,
    url: t.external_urls.spotify,
  }));
}
