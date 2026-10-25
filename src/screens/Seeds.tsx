import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Stage } from "../components/Stage";
import { fetchSeed, fetchSuggestions } from "../lib/api";
import type { Seed, Suggestions, Track } from "../lib/types";

const MAX_BROAD = 3; // artists + genres
const MAX_SONGS = 6;

// One row in the suggestion list under the input.
type Option =
  | { kind: "song"; track: Track; popular: boolean }
  | { kind: "artist"; id: number; name: string; image: string | null }
  | { kind: "genre"; query: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Ordered by what the text most likely means, so Enter picks it: an artist whose name it is,
// then songs it names, then the genre, then the looser matches.
function optionsFor(query: string, found: Suggestions | null, canBroad: boolean, canSong: boolean): Option[] {
  const q = norm(query);
  if (!found || q.length < 2) return [];
  const artists = canBroad ? found.artists.map((a): Option => ({ kind: "artist", id: a.id, name: a.name, image: a.image })) : [];
  const songs = canSong ? found.songs.map(({ track, popular }): Option => ({ kind: "song", track, popular })) : [];
  const named = (o: Option) => {
    if (o.kind === "artist") return norm(o.name) === q;
    if (o.kind !== "song") return false;
    const title = norm(o.track.name);
    const artist = norm(o.track.artists[0]);
    // Title and artist together ("white flag clairo", "clairo white flag") clearly mean the song,
    // once at least 4 letters of the second part are typed. A bare title only does if the song is
    // well known — otherwise "bedroom pop" would pick a little-known song called Bedroom Pop.
    const spells = (whole: string, part: string) => part.length >= Math.min(4, whole.length) && whole.startsWith(part);
    const titleThenArtist = q.startsWith(title) && spells(artist, q.slice(title.length));
    const artistThenTitle = q.startsWith(artist) && spells(title, q.slice(artist.length));
    return titleThenArtist || artistThenTitle || ((title === q || title.startsWith(q)) && o.popular);
  };
  return [
    ...artists.filter(named),
    ...songs.filter(named),
    ...(canBroad ? [{ kind: "genre", query: query.trim().toLowerCase() } as Option] : []),
    ...songs.filter((o) => !named(o)),
    ...artists.filter((o) => !named(o)),
  ];
}

// Name a few artists, genres or specific songs, then pick from their songs. A glass search bar,
// with matches and picks both shown as tidy rows.
export function Seeds({ initial, onDone }: { initial: Seed[]; onDone: (seeds: Seed[]) => void }) {
  const [seeds, setSeeds] = useState<Seed[]>(initial);
  const [text, setText] = useState("");
  const [found, setFound] = useState<Suggestions | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const broad = seeds.filter((s) => s.kind !== "song").length;
  const songs = seeds.length - broad;
  const canBroad = broad < MAX_BROAD;
  const canSong = songs < MAX_SONGS;
  const options = optionsFor(text, found, canBroad, canSong);

  // Look up matches a moment after typing stops.
  useEffect(() => {
    const query = text.trim();
    if (query.length < 2) {
      setFound(null);
      return;
    }
    let live = true;
    const id = setTimeout(() => {
      fetchSuggestions(query)
        .then((s) => live && (setFound(s), setActive(0)))
        .catch(() => live && setFound(null));
    }, 220);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [text]);

  const addSeed = (seed: Seed) => {
    if (seeds.some((s) => s.label.toLowerCase() === seed.label.toLowerCase())) {
      setError(`you've already got ${seed.label}`);
      return;
    }
    setSeeds((s) => [...s, seed]);
    setText("");
    setFound(null);
  };

  const choose = async (option: Option | null) => {
    if (busy) return;
    setError(null);
    if (option?.kind === "song") {
      const t = option.track;
      addSeed({ kind: "song", label: `${t.name} — ${t.artists[0]}`, tracks: [t] });
      return;
    }
    const query = text.trim();
    if (!option && !query) return;
    if (!canBroad) {
      setError(`that's ${MAX_BROAD} artists and genres — pick a song, or remove one`);
      return;
    }
    setBusy(true);
    try {
      addSeed(
        await fetchSeed(
          option?.kind === "artist" ? { artist: option.id } : option?.kind === "genre" ? { genre: option.query } : { q: query },
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't look that up — try again");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    choose(options[active] ?? null);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!options.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
    } else if (e.key === "Escape") {
      setFound(null);
    }
  };

  const [peeling, setPeeling] = useState<string | null>(null);
  const remove = (label: string) => {
    setPeeling(label);
    setTimeout(() => {
      setSeeds((s) => s.filter((x) => x.label !== label));
      setPeeling(null);
    }, 260);
  };
  const full = !canBroad && !canSong;
  const typing = text.trim().length >= 2;

  return (
    <Stage
      aside={error ? <p>{error}</p> : null}
    >
      <div className="seeds">
        <p className="seeds-kicker">who do you listen to?</p>

        <form className="search" onSubmit={submit}>
          <svg className="search-icon" viewBox="0 0 24 24" aria-hidden>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5l5 5" />
          </svg>
          <input
            id="seed-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            maxLength={60}
            disabled={full}
            autoFocus
            autoComplete="off"
            role="combobox"
            aria-label="artists, genres or songs you love"
            aria-expanded={options.length > 0}
            aria-controls="seed-options"
            placeholder={full ? "that's plenty — lovely" : "artists, genres, songs…"}
          />
          {busy && <span className="search-busy" aria-hidden />}
        </form>

        {typing && (
          <ul id="seed-options" className="results" role="listbox">
            {options.length === 0 && <li className="results-empty">{busy ? "looking…" : "no matches yet — keep typing"}</li>}
            {options.map((o, i) => (
              <li
                key={o.kind === "song" ? o.track.id : o.kind === "artist" ? `a${o.id}` : "genre"}
                role="option"
                aria-selected={i === active}
                className={i === active ? "is-active" : ""}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
              >
                {o.kind === "genre" ? (
                  <span className="results-thumb results-thumb--genre">#</span>
                ) : (
                  <img
                    className={`results-thumb ${o.kind === "artist" ? "results-thumb--round" : ""}`}
                    src={(o.kind === "song" ? o.track.albumArt : o.image) ?? ""}
                    alt=""
                  />
                )}
                <span className="results-text">
                  <span className="results-name">
                    {o.kind === "song" ? o.track.name : o.kind === "artist" ? o.name : o.query}
                  </span>
                  <span className="results-sub">
                    {o.kind === "song" ? `song · ${o.track.artists[0]}` : o.kind === "artist" ? "artist" : "genre"}
                  </span>
                </span>
                <span className="results-add" aria-hidden>
                  +
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Picks, as rows in the same style as the results. */}
        {!typing && seeds.length > 0 && (
          <ul className="results picks">
            {seeds.map((s) => (
              <li key={s.label} className={peeling === s.label ? "is-leaving" : ""}>
                {s.kind === "genre" ? (
                  <span className="results-thumb results-thumb--genre">#</span>
                ) : (
                  <img
                    className={`results-thumb ${s.kind === "artist" ? "results-thumb--round" : ""}`}
                    src={s.image ?? s.tracks[0]?.albumArt ?? ""}
                    alt=""
                  />
                )}
                <span className="results-text">
                  <span className="results-name">{s.kind === "song" ? s.tracks[0]?.name ?? s.label : s.label}</span>
                  <span className="results-sub">
                    {s.kind === "song" ? `song · ${s.tracks[0]?.artists[0] ?? ""}` : s.kind}
                  </span>
                </span>
                <button className="picks-remove" onClick={() => remove(s.label)} aria-label={`remove ${s.label}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {!typing && seeds.length === 0 && <p className="picks-empty">search for artists, genres or songs you love</p>}

        <button
          className="icon-pill seeds-go"
          onClick={() => seeds.length && !busy && onDone(seeds)}
          disabled={seeds.length === 0 || busy}
          aria-label="show me songs"
          data-label="show me songs"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </Stage>
  );
}
