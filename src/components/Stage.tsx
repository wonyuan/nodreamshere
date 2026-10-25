import { createContext, useContext, type ReactNode } from "react";

// What the apple logo does when clicked: back to the title screen. Provided by App.
export const GoHome = createContext<() => void>(() => {});

// The layout every frame in the Figma file shares: the apple sticker top-left, the card in the
// middle of the green page, notes to the right, and optionally controls to the left.
export function Stage({
  children,
  aside,
  left,
  className,
}: {
  children: ReactNode;
  aside?: ReactNode;
  left?: ReactNode;
  className?: string;
}) {
  const goHome = useContext(GoHome);
  return (
    <div className="stage">
      <header className="app-title">
        <button className="logo" onClick={goHome} aria-label="give me prose — back to the start">
          <img src="/logo.png" alt="" />
        </button>
      </header>
      <main className={`card ${className ?? ""}`}>{children}</main>
      {left && <div className="stage-left">{left}</div>}
      <aside className="aside">{aside}</aside>
    </div>
  );
}
