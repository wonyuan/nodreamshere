import { useState, type CSSProperties } from "react";
import { Stage } from "../components/Stage";

// Frame 3: a collage of real paper stickers — Post-its, torn scraps, tickets, a fortune
// cookie slip. They're cut-out PNGs in /public/stickers. Each one falls off the screen when
// clicked. They drop onto the card one by one when it opens, and all fall off on the way out.

type Sticker = {
  src: string;
  // What's written on it, for screen readers.
  alt: string;
  // Position and width in card units (the card is 150 × 180); height follows the image.
  x: number;
  y: number;
  w: number;
  rot: number;
};

// How long the pile takes to fall away before the next screen shows.
const LEAVE_MS = 950;

const s = (name: string) => `/stickers/${name}.png`;

// Big, tilted and piled on each other, split evenly above and below a clear window around
// the intro text and arrow (roughly x 16–134, y 60–120), and spilling well past the card.
const STICKERS: Sticker[] = [
  // above
  { src: s("fortune"), alt: "your dreams are never silly; depend on them to guide you.", x: -20, y: -20, w: 72, rot: -7 },
  { src: s("blue-korean"), alt: "a handwritten note in korean about living as yourself", x: 8, y: -2, w: 64, rot: 4 },
  { src: s("miss-u-mom"), alt: "miss u mom", x: -26, y: 6, w: 36, rot: -10 },
  { src: s("heart-breathe"), alt: "stop! rushing! your! life! how much time do we even take to breathe, like really breathe?", x: 102, y: -28, w: 72, rot: 10 },
  { src: s("stay-close-sunshine"), alt: "stay close to people who feel like sunshine.", x: 72, y: 6, w: 50, rot: 14 },
  { src: s("kill-the-fear"), alt: "kill the fear and let the artist be born.", x: 64, y: -24, w: 44, rot: -11 },
  { src: s("ticket-88"), alt: "ticket 88", x: 68, y: 34, w: 14, rot: -16 },
  { src: s("smile-like-an-idiot"), alt: "i smile like an idiot when i'm talking to you", x: -12, y: 40, w: 58, rot: 5 },
  { src: s("ticket-23"), alt: "ticket 23", x: 48, y: 44, w: 20, rot: -9 },
  { src: s("lilies"), alt: "i like lilies in the sun", x: 100, y: 42, w: 64, rot: -8 },
  // edges
  { src: s("im-not-here"), alt: "im not here", x: -22, y: 60, w: 36, rot: -13 },
  { src: s("ticket-0280"), alt: "ticket 0280", x: -15, y: 98, w: 24, rot: -78 },
  { src: s("ticket-1-1"), alt: "ticket 1-1", x: 4, y: 104, w: 11, rot: 12 },
  { src: s("library-card"), alt: "of all of the things that cannot be undone, you & i are my favorite one", x: 135, y: 56, w: 34, rot: 9 },
  { src: s("ticket-42"), alt: "ticket 42", x: 158, y: 50, w: 18, rot: 15 },
  { src: s("tag-3"), alt: "a green tag with a 3", x: 140, y: 100, w: 21, rot: -15 },
  // below
  { src: s("taking-every-day"), alt: "taking every day as it comes", x: -18, y: 124, w: 62, rot: -7 },
  { src: s("ticket-2535"), alt: "ticket 2535", x: 20, y: 114, w: 22, rot: -10 },
  { src: s("better-than-you-feel"), alt: "you are doing better than you feel", x: 30, y: 123, w: 52, rot: 6 },
  { src: s("love-anyone-else"), alt: "i could just love anyone else, but my heart wants to talk to you every day.", x: 102, y: 120, w: 68, rot: 5 },
  { src: s("best-day-orange"), alt: "every day is the best day ever with you", x: 70, y: 122, w: 42, rot: -13 },
  { src: s("adore-you"), alt: "i'm not good at telling stories, i am a messy eater, half the time i don't make sense. and i know i frustrate you a lot. but i do adore you", x: -2, y: 160, w: 60, rot: -5 },
  { src: s("without-a-doubt"), alt: "without a doubt, you're all i dream about", x: 116, y: 154, w: 52, rot: -9 },
  { src: s("things-will-get-better"), alt: "things will get better.. in time.", x: 64, y: 162, w: 54, rot: 8 },
  { src: s("ticket-your-number-30"), alt: "your number 30 — when called it's your turn for service", x: 108, y: 160, w: 19, rot: 15 },
  { src: s("ticket-circle"), alt: "a red ticket with a circle", x: -16, y: 176, w: 25, rot: -14 },
  { src: s("ticket-10-pieces"), alt: "ticket 10 pieces", x: 52, y: 188, w: 17, rot: 11 },
  { src: s("ticket-18"), alt: "ticket 18", x: 154, y: 182, w: 19, rot: -8 },
];

export function Intro({ onSeeds, error }: { onSeeds: () => void; error?: string | null }) {
  const [falling, setFalling] = useState<Set<number>>(new Set());
  const [gone, setGone] = useState<Set<number>>(new Set());

  const [leaving, setLeaving] = useState(false);

  const drop = (i: number) => setFalling((s) => new Set(s).add(i));
  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onSeeds, LEAVE_MS);
  };

  return (
    <Stage className="card--intro" aside={error ? <p>{error}</p> : null}>
      <div className={["intro", leaving && "intro--leaving"].filter(Boolean).join(" ")}>
        <p className="intro-kicker">your #deepcut</p>
        <p>
          name a few artists, genres or songs you love, and we'll leave you a little
          poem.
        </p>
        <button className="icon-pill" onClick={leave} aria-label="name your artists" data-label="name your artists">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {STICKERS.map((n, i) => {
        if (gone.has(i)) return null;
        return (
          <button
            key={i}
            className={["scrap", (leaving || falling.has(i)) && "scrap--falling"].filter(Boolean).join(" ")}
            style={
              {
                "--x": n.x,
                "--y": n.y,
                "--w": n.w,
                "--rot": `${n.rot}deg`,
                "--fall-rot": `${(i % 2 ? 1 : -1) * (25 + ((i * 17) % 40))}deg`,
                "--fall-x": `${((i % 3) - 1) * 10}vw`,
                // Landing order jumps around the card rather than going top to bottom.
                "--land-delay": `${((i * 11) % STICKERS.length) * 35}ms`,
                // A clicked sticker goes at once; on the way out they go in a quick scatter.
                "--fall-delay": leaving && !falling.has(i) ? `${(i * 7) % 6 * 40}ms` : "0ms",
              } as CSSProperties
            }
            onClick={() => drop(i)}
            onAnimationEnd={(e) => e.animationName === "fall" && setGone((s) => new Set(s).add(i))}
            aria-label={`clear note: ${n.alt}`}
          >
            <img src={n.src} alt="" draggable={false} />
          </button>
        );
      })}
    </Stage>
  );
}
