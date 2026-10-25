import type { SongReading, Track } from "../../src/lib/types";
import { fetchLyrics } from "./lyrics";
import { completeJson } from "./llm";

// The slow part of making a poem: reading each song's full lyrics and working out what it is
// really about. Each song gets its own call (in parallel), so none is skimmed, and uses the
// careful model. The app starts it the moment the nine are chosen and reuses it for "another".

const READER = `You understand songs deeply: what the artist is actually saying, the context it was written in, and how the song moves from start to finish.
Be faithful to the song. Don't invent settings, events or feelings that aren't in it.
Reply with a single JSON object and nothing else.`;

async function readSong(track: Track): Promise<SongReading> {
  const lyrics = await fetchLyrics(track);
  const answer = await completeJson<Partial<SongReading>>(
    READER,
    `"${track.name}" by ${track.artists.join(", ")} (album: ${track.album})

${lyrics ? `Full lyrics:\n${lyrics}` : "[lyrics not found]"}

Read the whole song, especially how it ends: the last verse, bridge or outro often changes its meaning. Use what you know about the song and the artist's situation when it was written, but only if you're sure; if the lyrics weren't found and you don't truly know the song, say "unknown".
Use your own words. Never quote lyrics.

Return JSON:
{"situation": "1-2 sentences on what the song is really about and its context, e.g. feeling empty and far from home even after the success they wanted",
 "mood": "a few words, e.g. lonely, numb, quietly hopeful",
 "ending": "one sentence on where the song lands, e.g. it turns toward wanting more out of life"}`,
  );
  return {
    situation: String(answer.situation ?? "unknown").slice(0, 400),
    mood: String(answer.mood ?? "").slice(0, 120),
    ending: String(answer.ending ?? "").slice(0, 300),
  };
}

export async function readSongs(tracks: Track[]): Promise<SongReading[]> {
  return Promise.all(tracks.map(readSong));
}
