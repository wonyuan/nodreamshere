# nothing here

Name a few artists, genres or songs, keep the nine songs that really sound like you, and get a
haiku about a moment those songs share.

**Flow:** spinning reel → sticky-note intro → "name your artists" (anyone) or "connect spotify"
(invited accounts) → captcha of songs ("select all squares that aren't you") → typewriter haiku, with an ⓘ note on what it was written about and which songs it came from.

## Setup

```bash
npm install
cp .env.example .env   # then fill it in, see below
npm run dev            # http://127.0.0.1:5173  (not "localhost", Spotify rejects it)
```

### 1. Spotify (optional)

Only needed for "connect spotify". Without it, "name your artists" still works for everyone.

1. Go to https://developer.spotify.com/dashboard → **Create app**.
2. Redirect URI: `http://127.0.0.1:5173/callback`. API: tick **Web API**.
3. Copy the **Client ID** into `.env` as `VITE_SPOTIFY_CLIENT_ID` (no secret needed: the app uses PKCE).
4. **User Management** tab: add the Spotify email of everyone who will use it (yourself too).

Since February 2026, Spotify's development mode requires the **app owner to have Premium**
and allows **5 users per app**, which is why "name your artists" is the main way in.

### 2. The poet (LLM)

Set `LLM_PROVIDER` to `cohere` or `openai` and fill in that key.

- **Cohere**: a free trial key from https://dashboard.cohere.com/api-keys (1,000 calls/month, non-commercial).
- **OpenAI**: pay-as-you-go from https://platform.openai.com/api-keys.

### Where the other data comes from (free, no keys)

- **Artists, genres and songs**: [Deezer](https://developers.deezer.com/api), suggested as you
  type. An artist gives their top songs; a genre ("bedroom pop", "midwest emo") gives a playlist
  named after it; a song is pinned to the front of the captcha.
- **Lyrics**: [LRCLIB](https://lrclib.net), roughly the first verse and chorus of each song.
  Lyrics go only to the LLM, never to the browser.
- **Title-screen covers**: Deezer's public album chart.

### How a haiku is made

1. As soon as the nine songs are chosen, `/api/read` reads each one's lyrics and names its
   situation and mood (fast model). The result is kept, so "write another" skips this step.
2. `/api/poem` then makes one call (reasoning model) that finds the specific moment shared by
   the most songs and writes a haiku about it in the voice set out in `api/poem.ts`, its tone
   following the songs.

`/api/read`, `/api/poem` and `/api/seed` are rate-limited per visitor (`api/_lib/http.ts`) so a
public link can't burn through LLM credits. The limit is per server instance; use a shared
store (e.g. Upstash) if it ever needs to be exact.

## Previewing screens

In dev, `http://127.0.0.1:5173/?preview=intro` (or `seeds`, `pick`, `writing`, `poem`) shows a
screen with sample data. No Spotify login or LLM call needed.

## Deploying

The `/api` folder is written as Vercel functions, so `vercel deploy` works as-is. Set the same env
vars in Vercel and add `https://<your-domain>/callback` as a redirect URI in the Spotify dashboard.
