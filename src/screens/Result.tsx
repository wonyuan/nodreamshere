import { useEffect, useState, type ReactNode } from "react";
import { Stage } from "../components/Stage";
import type { Poem } from "../lib/types";

// A round glass button holding a 24×24 line icon; the label shows on hover and is read aloud.
function IconButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      className="icon-pill"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      data-label={label}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Types the poem out one character at a time, pausing a beat at each line break.
function useTyped(text: string) {
  const [count, setCount] = useState(() => (reducedMotion() ? text.length : 0));
  useEffect(() => {
    if (count >= text.length) return;
    const delay = text[count - 1] === "\n" ? 380 : 38 + Math.random() * 50;
    const id = setTimeout(() => setCount((c) => c + 1), delay);
    return () => clearTimeout(id);
  }, [count, text]);
  return { typed: text.slice(0, count), done: count >= text.length };
}

// Frame 2: the poem comes out of the typewriter. Behind the ⓘ button, a note on the shared
// moment it was written about, why it fits, and the songs it came from.
export function Result({
  poem,
  onAgain,
  onRestart,
}: {
  poem: Poem;
  onAgain: () => void;
  onRestart: () => void;
}) {
  const { typed, done } = useTyped(poem.poem);
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(poem.poem);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (e.g. no permission); the haiku is still selectable on the page.
    }
  };

  return (
    <Stage
      className="card--poem"
      left={
        <div className={`result-notes ${done ? "result-notes--in" : ""}`}>
          <div className="result-actions">
            <IconButton
              label="why this haiku"
              onClick={() => setShowInfo((v) => !v)}
              pressed={showInfo}
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v6M12 7.5v.01" />
            </IconButton>
            <IconButton
              label={copied ? "copied" : "copy the haiku"}
              onClick={copy}
            >
              {copied ? (
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              ) : (
                <>
                  <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
                  <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
                </>
              )}
            </IconButton>
            <IconButton label="write another" onClick={onAgain}>
              <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
              <path d="M13.5 8.5l2 2" />
            </IconButton>
            <IconButton label="start over" onClick={onRestart}>
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </IconButton>
          </div>
        </div>
      }
      aside={
        <div className={`result-notes ${done ? "result-notes--in" : ""}`}>
          {showInfo && (
            <div className="result-info">
              <p className="result-info-label">written about</p>
              <p>{poem.scenario}</p>
              <p>{poem.why}</p>
              {poem.tracks.length > 0 && (
                <>
                  <p className="result-info-label">from your songs</p>
                  <ul>
                    {poem.tracks.map((t) => (
                      <li key={t.id}>
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          title="open in spotify"
                        >
                          {t.albumArt && <img src={t.albumArt} alt="" />}
                          <span>
                            {t.name}
                            <em>{t.artists.join(", ")}</em>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      }
    >
      <div className="typewriter">
        <img src="/typewriter.png" alt="" />
        <p className="typewriter-paper" aria-label={poem.poem}>
          {typed}
          {!done && <span className="caret" />}
        </p>
      </div>
    </Stage>
  );
}
