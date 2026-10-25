import { useRef, useState, type CSSProperties } from "react";
import type { Album } from "../lib/types";

// The View-Master reel from the title frame. Album covers sit *behind* the reel
// artwork (public/reel.svg) at each of its 14 windows, so they show through the holes.
// Hovering (or tapping) a window stops the reel and floats a thought bubble out of it naming
// the album and artist.

const W = 132.033;
const H = 131.674;
const CENTER = { x: 66, y: 65.8 };

// Bounding boxes of the reel's picture windows, in reel.svg coordinates.
const WINDOWS: [x: number, y: number, w: number, h: number][] = [
  [67.9, 9.7, 18.5, 19.5],
  [85.5, 18.4, 21.0, 20.9],
  [98.7, 36.0, 21.1, 19.6],
  [104.5, 57.7, 17.6, 17.1],
  [97.7, 77.4, 20.9, 20.1],
  [83.9, 93.3, 22.2, 21.0],
  [65.5, 102.9, 18.5, 19.1],
  [44.6, 102.0, 18.1, 19.5],
  [24.7, 91.4, 20.4, 20.9],
  [11.7, 75.2, 20.5, 19.4],
  [9.2, 56.3, 17.5, 16.0],
  [12.8, 34.0, 21.9, 19.4],
  [26.0, 17.3, 21.0, 20.8],
  [47.3, 9.4, 17.5, 19.3],
];

// The thought cloud's outline: bumps of slightly different sizes round an oval, joined by
// arcs that bulge outward. Drawn once in a 200 × 130 box and stretched over the cloud.
const CLOUD = (() => {
  const bumps = [1, 0.85, 1.1, 0.9, 1.05, 0.95, 1.15, 0.9, 1, 0.88];
  const pts = bumps.map((_, i) => {
    const a = (i / bumps.length) * Math.PI * 2 - Math.PI / 2;
    return [100 + 78 * Math.cos(a), 65 + 46 * Math.sin(a)];
  });
  const r = (i: number) => {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    return Math.hypot(bx - ax, by - ay) * 0.56 * bumps[i];
  };
  const arcs = pts.map((_, i) => {
    const [x, y] = pts[(i + 1) % pts.length];
    return `A${r(i).toFixed(1)} ${r(i).toFixed(1)} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} ${arcs.join(" ")}Z`;
})();

// The cloud is the buttons' frosted glass (an HTML layer, so it can blur what's behind it) cut
// to the cloud outline, with the same thin white edge and soft shadow drawn from that outline.
const VIEW = { x: -8, y: -12, w: 216, h: 154 };

function CloudShape() {
  return (
    <>
      <svg className="thought-defs" aria-hidden>
        <clipPath id="cloud-clip" clipPathUnits="objectBoundingBox">
          <path d={CLOUD} transform={`scale(${1 / VIEW.w} ${1 / VIEW.h}) translate(${-VIEW.x} ${-VIEW.y})`} />
        </clipPath>
        <filter id="cloud-shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </svg>
      <svg className="thought-shadow" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} preserveAspectRatio="none" aria-hidden>
        <path d={CLOUD} fill="rgba(60, 50, 30, 0.2)" filter="url(#cloud-shadow)" />
      </svg>
      <span className="thought-glass" aria-hidden />
      <svg className="thought-rim" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} preserveAspectRatio="none" aria-hidden>
        <path d={CLOUD} fill="none" stroke="rgba(255, 255, 255, 0.95)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </>
  );
}

// Where a thought bubble sits, in the card's own pixels: the window's centre, how far out its
// edge is, and the direction pointing away from the reel's middle.
type Bubble = { album: Album; x: number; y: number; r: number; dx: number; dy: number; u: number };

export function Reel({ albums, speed = "slow" }: { albums: Album[]; speed?: "slow" | "fast" }) {
  const reel = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);

  // The reel has stopped by the time this runs, so the window's on-screen box is where it'll stay.
  const think = (i: number, el: SVGRectElement) => {
    const card = reel.current?.offsetParent;
    if (!card || !reel.current) return;
    const box = card.getBoundingClientRect();
    const win = el.getBoundingClientRect();
    const hub = reel.current.getBoundingClientRect();
    const x = win.left + win.width / 2 - box.left;
    const y = win.top + win.height / 2 - box.top;
    const ox = x - (hub.left + hub.width / 2 - box.left);
    const oy = y - (hub.top + hub.height / 2 - box.top);
    const len = Math.hypot(ox, oy) || 1;
    setBubble({ album: albums[i % albums.length], x, y, r: Math.min(win.width, win.height) / 2, dx: ox / len, dy: oy / len, u: box.width / 150 });
  };

  // The trail of little puffs from the album out to the bubble: small near the album, bigger
  // further out, like a cartoon thought.
  const puffs = bubble
    ? [
        { at: bubble.r + 3 * bubble.u, size: 3.2 * bubble.u },
        { at: bubble.r + 8.5 * bubble.u, size: 5 * bubble.u },
      ]
    : [];
  const out = bubble ? bubble.r + 12.5 * bubble.u : 0;

  return (
    <>
      {/* Soft shadow under the wheel. Kept outside the spinning element so the light stays put. */}
      <div className="reel-shadow" aria-hidden />
      <div ref={reel} className={`reel reel--${speed} ${bubble ? "reel--paused" : ""}`} onMouseLeave={() => setBubble(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
          <defs>
            {/* Fine, even grain: pixel-sized specks (the reel is drawn ~3.7× its viewBox, hence
                the high frequency) that lighten and darken equally, so the cream keeps its colour. */}
            <filter id="grain" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="3.2" numOctaves="1" seed="5" result="noise" />
              <feColorMatrix in="noise" type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1" result="mono" />
              <feComposite in="SourceGraphic" in2="mono" operator="arithmetic" k1="0" k2="1" k3="0.28" k4="-0.14" result="grainy" />
              <feComposite in="grainy" in2="SourceGraphic" operator="in" />
            </filter>
            {/* The reel's window edges cast a soft shadow onto the covers behind them. Even on
                all sides (no offset), so it still looks right while the reel turns. */}
            <filter id="window-shadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="0" stdDeviation="1.1" floodColor="#000" floodOpacity="0.55" />
            </filter>
          </defs>
          <g>
            {albums.length > 0 &&
              WINDOWS.map(([x, y, w, h], i) => {
                const cx = x + w / 2;
                const cy = y + h / 2;
                const side = Math.max(w, h) * 1.08;
                const angle = (Math.atan2(cy - CENTER.y, cx - CENTER.x) * 180) / Math.PI + 90;
                return (
                  <image
                    key={i}
                    href={albums[i % albums.length].cover}
                    x={cx - side / 2}
                    y={cy - side / 2}
                    width={side}
                    height={side}
                    preserveAspectRatio="xMidYMid slice"
                    transform={`rotate(${angle} ${cx} ${cy})`}
                  />
                );
              })}
            <g filter="url(#grain)" pointerEvents="none">
              <image href="/reel.svg" x="0" y="0" width={W} height={H} filter="url(#window-shadow)" />
              {/* Hub cap over the centre hole, so the button always covers it while the reel turns. */}
              <circle cx={CENTER.x} cy={CENTER.y} r="8.5" fill="#EEEFDA" />
            </g>
            {/* Invisible targets over each window, on top of the artwork so they catch the pointer. */}
            {albums.length > 0 &&
              WINDOWS.map(([x, y, w, h], i) => (
                <rect
                  key={i}
                  className="reel-window"
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={4}
                  fill="transparent"
                  pointerEvents="all"
                  onMouseEnter={(e) => think(i, e.currentTarget)}
                  onClick={(e) => think(i, e.currentTarget)}
                />
              ))}
          </g>
        </svg>
      </div>
      {bubble && (
        <div key={`${bubble.x},${bubble.y}`} className="thought" aria-live="polite">
          {puffs.map((p, n) => (
            <span
              key={n}
              className="thought-puff"
              style={
                {
                  left: bubble.x + bubble.dx * p.at,
                  top: bubble.y + bubble.dy * p.at,
                  width: p.size,
                  height: p.size,
                  "--delay": `${n * 70}ms`,
                } as CSSProperties
              }
            />
          ))}
          <p
            className="thought-cloud"
            style={
              {
                left: bubble.x + bubble.dx * out,
                top: bubble.y + bubble.dy * out,
                "--dx": bubble.dx,
                "--dy": bubble.dy,
              } as CSSProperties
            }
          >
            <CloudShape />
            {/* Drop tags like "(Deluxe Edition)" so the name fits inside the cloud. */}
            <span className="thought-title">{bubble.album.title.replace(/\s*[([][^)\]]*[)\]]\s*$/, "")}</span>
            <span className="thought-artist">{bubble.album.artist}</span>
          </p>
        </div>
      )}
    </>
  );
}
