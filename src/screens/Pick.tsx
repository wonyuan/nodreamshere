import { useEffect, useState } from "react";
import { Stage } from "../components/Stage";
import type { Track } from "../lib/types";

// Frame 4: a captcha of songs from the artists, genres and songs the listener named. Like a real image captcha, a clicked square gets ticked,
// fades, and is replaced by the next track in line.

const SLOTS = 9;

type Board = { slots: (Track | null)[]; queue: Track[] };

export function Pick({
  load,
  onDone,
  onError,
  error,
}: {
  load: () => Promise<Track[]>;
  onDone: (tracks: Track[]) => void;
  onError: (err: unknown) => void;
  error?: string | null;
}) {
  // Bumped by ↻ to deal a fresh shuffle.
  const [round, setRound] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [ticking, setTicking] = useState<Set<number>>(new Set());
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    let live = true;
    setBoard(null);
    load()
      .then((tracks) => {
        if (!live) return;
        const slots: (Track | null)[] = tracks.slice(0, SLOTS);
        while (slots.length < SLOTS) slots.push(null);
        setBoard({ slots, queue: tracks.slice(SLOTS) });
      })
      .catch((err) => live && onError(err));
    return () => {
      live = false;
    };
  }, [round, load, onError]);

  const reject = (i: number) => {
    if (ticking.has(i)) return;
    setTicking((s) => new Set(s).add(i));
    setTimeout(() => {
      setBoard((b) => {
        if (!b) return b;
        const slots = [...b.slots];
        slots[i] = b.queue[0] ?? null;
        return { slots, queue: b.queue.slice(1) };
      });
      setTicking((s) => {
        const next = new Set(s);
        next.delete(i);
        return next;
      });
    }, 450);
  };

  const chosen = board?.slots.filter((t): t is Track => t !== null) ?? [];

  return (
    <Stage
      aside={error ? <p>{error}</p> : null}
    >
      <div className="captcha">
        <div className="captcha-head">
          <p className="captcha-kicker">select all that aren't you</p>
          <p className="captcha-sub">tap a cover to swap it out. if they're all you, you're good.</p>
        </div>

        <div className="captcha-grid">
          {board === null
            ? Array.from({ length: SLOTS }, (_, i) => <div key={i} className="tile tile--loading" />)
            : board.slots.map((t, i) =>
                t ? (
                  <button
                    key={t.id}
                    className={`tile ${ticking.has(i) ? "tile--ticked" : ""}`}
                    onClick={() => reject(i)}
                    title={`${t.name} — ${t.artists.join(", ")}`}
                  >
                    {t.albumArt && <img src={t.albumArt} alt="" />}
                    <span className="tile-caption">
                      {t.name}
                      <br />
                      <em>{t.artists[0]}</em>
                    </span>
                    <span className="tile-check" aria-hidden />
                  </button>
                ) : (
                  <div key={`empty-${i}`} className="tile tile--empty" />
                ),
              )}
        </div>

        <div className="captcha-foot">
          <button
            className="icon-pill icon-pill--small"
            onClick={() => setRound((r) => r + 1)}
            aria-label="shuffle in different songs"
            data-label="shuffle"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" />
            </svg>
          </button>
          <button
            className="icon-pill icon-pill--small"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="what is this?"
            aria-pressed={showInfo}
            data-label="what is this?"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v6M12 7.5v.01" />
            </svg>
          </button>
          <button className="pill captcha-go" disabled={chosen.length === 0} onClick={() => onDone(chosen)}>
            i'm good →
          </button>
          {showInfo && (
            <p className="captcha-info" onClick={() => setShowInfo(false)}>
              these are songs from the artists and genres you named. remove the ones that don't represent
              you; ↻ deals a fresh shuffle.
            </p>
          )}
        </div>
      </div>
    </Stage>
  );
}
