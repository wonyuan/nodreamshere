import type { Track } from "../../src/lib/types";

// LRCLIB is a free, keyless lyrics database. Lyrics only ever go to the LLM for
// interpretation; they are never sent back to the browser.

const LRCLIB = "https://lrclib.net/api";
const HEADERS = { "User-Agent": "givemeprose v0.1" };
// The whole song, so the reader sees how it turns and ends (bridges and outros often carry
// the meaning). Capped only to stay clear of runaway entries.
const EXCERPT_CHARS = 5000;

type LrcEntry = { plainLyrics: string | null; instrumental: boolean };

async function get<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function fetchLyrics(track: Track): Promise<string | null> {
  const exact = await get<LrcEntry>(
    `${LRCLIB}/get?` +
      new URLSearchParams({
        track_name: track.name,
        artist_name: track.artists[0],
        album_name: track.album,
        duration: String(Math.round(track.durationMs / 1000)),
      }),
  );
  let entry: LrcEntry | null | undefined = exact;
  if (!entry?.plainLyrics && !entry?.instrumental) {
    const results = await get<LrcEntry[]>(
      `${LRCLIB}/search?` + new URLSearchParams({ track_name: track.name, artist_name: track.artists[0] }),
    );
    entry = results?.find((r) => r.plainLyrics || r.instrumental);
  }
  if (!entry) return null;
  if (entry.instrumental) return "[instrumental]";
  return excerpt(withoutRepeats(entry.plainLyrics ?? "")) || null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// A run of one to four lines sung several times in a row, written once with a count.
function collapseRuns(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    let best = { size: 1, times: 1 };
    for (let size = 1; size <= 4; size++) {
      const block = lines.slice(i, i + size).map(norm).join("\n");
      let times = 1;
      while (lines.slice(i + times * size, i + (times + 1) * size).map(norm).join("\n") === block) times++;
      if (times > 1 && times * size > best.times * best.size) best = { size, times };
    }
    const block = lines.slice(i, i + best.size);
    if (best.times > 1) block[block.length - 1] += ` (×${best.times})`;
    out.push(...block);
    i += best.size * best.times;
  }
  return out;
}

// Choruses and hooks sung again and again add nothing for the reader and make the song look like
// it's mostly about its hook. Runs of repeated lines are written once with a count, and a section
// made only of lines already sung becomes a short marker.
export function withoutRepeats(text: string): string {
  const sung = new Set<string>();
  return text
    .split(/\n\s*\n/)
    .map((section) => {
      const lines = section.split("\n").filter((l) => norm(l));
      if (!lines.length) return "";
      if (lines.every((l) => sung.has(norm(l)))) return "[repeat of an earlier section]";
      lines.forEach((l) => sung.add(norm(l)));
      return collapseRuns(lines).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

// Cut at a line break so the excerpt never ends mid-line.
function excerpt(text: string): string {
  if (text.length <= EXCERPT_CHARS) return text;
  const cut = text.lastIndexOf("\n", EXCERPT_CHARS);
  return text.slice(0, cut > 0 ? cut : EXCERPT_CHARS).trimEnd();
}
