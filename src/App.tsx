import { useCallback, useEffect, useRef, useState } from "react";
import { GoHome } from "./components/Stage";
import { Title, Spinning } from "./screens/Title";
import { Intro } from "./screens/Intro";
import { Seeds } from "./screens/Seeds";
import { Pick } from "./screens/Pick";
import { Result } from "./screens/Result";
import { fetchCovers, readSongs, writePoem } from "./lib/api";
import { handleCallback, isCallback, SpotifyAuthError, topTracks, type TimeRange } from "./lib/spotify";
import { previewScreen, samplePoem, sampleTracks } from "./lib/preview";
import type { Poem, Seed, SongReading, Track } from "./lib/types";

type Screen = "title" | "intro" | "seeds" | "connecting" | "pick" | "writing" | "poem";

const WRITING_MESSAGES = [
  "listening closely…",
  "reading the lyrics…",
  "finding the thread…",
  "choosing your moment…",
  "feeding the typewriter…",
  "almost there…",
];

const message = (err: unknown) => (err instanceof Error ? err.message : "something went wrong");

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Songs someone picked by name go first, so each is sure of a square; then songs from each
// named artist/genre are dealt in turn, so the captcha mixes them all.
function mixSeeds(seeds: Seed[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  const take = (t: Track | undefined) => {
    if (!t) return;
    const key = `${t.name}|${t.artists[0]}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  };
  seeds.filter((s) => s.kind === "song").forEach((s) => take(s.tracks[0]));
  const piles = seeds.filter((s) => s.kind !== "song").map((s) => shuffled(s.tracks));
  for (let i = 0; out.length < 60 && piles.some((p) => i < p.length); i++) piles.forEach((pile) => take(pile[i]));
  return out;
}

// "clairo, bedroom pop, plus 1 song you picked" for the captcha's side note.
function seedLabels(seeds: Seed[]): string[] {
  const broad = seeds.filter((s) => s.kind !== "song").map((s) => s.label);
  const songs = seeds.length - broad.length;
  return songs ? [...broad, `${broad.length ? "plus " : ""}${songs} song${songs > 1 ? "s" : ""} you picked`] : broad;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>((previewScreen as Screen) ?? (isCallback() ? "connecting" : "title"));
  const [covers, setCovers] = useState<string[]>([]);
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [poem, setPoem] = useState<Poem | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The songs' readings, started the moment the nine are chosen (see api/read.ts).
  const reading = useRef<{ key: string; readings: Promise<SongReading[] | null> } | null>(null);
  // Haikus already written for the current nine, sent back so "write another" doesn't repeat.
  const written = useRef<{ key: string; poems: string[] }>({ key: "", poems: [] });

  useEffect(() => {
    fetchCovers().then((c) => {
      setCovers(c.sort(() => Math.random() - 0.5));
      if (previewScreen) {
        const sample = sampleTracks(c);
        setTracks(sample.slice(0, 9));
        setPoem(samplePoem(sample));
      }
    });
    if (isCallback()) {
      handleCallback()
        .then(() => setScreen("pick"))
        .catch((err) => {
          setError(message(err));
          setScreen("intro");
        });
    }
  }, []);

  const go = (next: Screen) => {
    setError(null);
    setScreen(next);
  };

  const onError = useCallback((err: unknown) => {
    setError(message(err));
    if (err instanceof SpotifyAuthError) setScreen("intro");
  }, []);

  const loadTracks = useCallback(
    (range: TimeRange) =>
      seeds.length
        ? Promise.resolve(mixSeeds(seeds))
        : previewScreen
          ? Promise.resolve(sampleTracks(covers))
          : topTracks(range),
    // Only preview mode needs covers; real songs shouldn't reload when they arrive.
    [previewScreen ? covers : null, seeds],
  );

  // Writes a haiku for these songs. Each song's reading is fetched once and kept, so
  // "write another" for the same nine only has to write.
  const generate = async (songs: Track[]) => {
    const key = songs.map((t) => t.id).join();
    if (reading.current?.key !== key) {
      // A failure here is fine: the poem request reads the songs itself.
      reading.current = { key, readings: readSongs(songs).catch(() => null) };
    }
    go("writing");
    try {
      const readings = await reading.current.readings;
      if (written.current.key !== key) written.current = { key, poems: [] };
      const next = await writePoem({ tracks: songs, readings: readings ?? undefined, avoid: written.current.poems });
      written.current.poems.push(next.poem);
      setPoem(next);
      setScreen("poem");
    } catch (err) {
      setError(message(err));
      setScreen("pick");
    }
  };

  const chooseSongs = (chosen: Track[]) => {
    setTracks(chosen);
    generate(chosen);
  };

  return <GoHome.Provider value={() => go("title")}>{view()}</GoHome.Provider>;

  function view() {
    switch (screen) {
      case "title":
        return <Title covers={covers} onStart={() => go("intro")} />;
      case "intro":
        return <Intro onSeeds={() => go("seeds")} error={error} />;
      case "seeds":
        return (
          <Seeds
            initial={seeds}
            onDone={(s) => {
              setSeeds(s);
              go("pick");
            }}
          />
        );
      case "connecting":
        return <Spinning covers={covers} messages={["connecting…"]} />;
      case "pick":
        return (
          <Pick
            load={loadTracks}
            seedLabels={seeds.length ? seedLabels(seeds) : undefined}
            onError={onError}
            error={error}
            onDone={chooseSongs}
          />
        );
      case "writing":
        return <Spinning covers={tracks.map((t) => t.albumArt)} messages={WRITING_MESSAGES} />;
      case "poem":
        return (
          poem && <Result poem={poem} onAgain={() => generate(tracks)} onRestart={() => go(seeds.length ? "seeds" : "pick")} />
        );
    }
  }
}
