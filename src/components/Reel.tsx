// The View-Master reel from the title frame. Album covers sit *behind* the reel
// artwork (public/reel.svg) at each of its 14 windows, so they show through the holes.

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

export function Reel({ covers, speed = "slow" }: { covers: (string | null)[]; speed?: "slow" | "fast" }) {
  const art = covers.filter((c): c is string => Boolean(c));
  return (
    <>
      {/* Soft shadow under the wheel. Kept outside the spinning element so the light stays put. */}
      <div className="reel-shadow" aria-hidden />
      <div className={`reel reel--${speed}`} aria-hidden>
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
            {art.length > 0 &&
              WINDOWS.map(([x, y, w, h], i) => {
                const cx = x + w / 2;
                const cy = y + h / 2;
                const side = Math.max(w, h) * 1.08;
                const angle = (Math.atan2(cy - CENTER.y, cx - CENTER.x) * 180) / Math.PI + 90;
                return (
                  <image
                    key={i}
                    href={art[i % art.length]}
                    x={cx - side / 2}
                    y={cy - side / 2}
                    width={side}
                    height={side}
                    preserveAspectRatio="xMidYMid slice"
                    transform={`rotate(${angle} ${cx} ${cy})`}
                  />
                );
              })}
            <g filter="url(#grain)">
              <image href="/reel.svg" x="0" y="0" width={W} height={H} filter="url(#window-shadow)" />
              {/* Hub cap over the centre hole, so the button always covers it while the reel turns. */}
              <circle cx={CENTER.x} cy={CENTER.y} r="8.5" fill="#EEEFDA" />
            </g>
          </g>
        </svg>
      </div>
    </>
  );
}
