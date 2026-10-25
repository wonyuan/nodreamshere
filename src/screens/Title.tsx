import { useEffect, useState } from "react";
import { Stage } from "../components/Stage";
import { Reel } from "../components/Reel";

// Frame 1, plus the "spinning cd player" loading state, which is the same reel spun fast.
export function Title({ covers, onStart }: { covers: string[]; onStart: () => void }) {
  return (
    <Stage>
      <Reel covers={covers} />
      <button className="pill reel-button" onClick={onStart}>
        speak louder to me
      </button>
    </Stage>
  );
}

export function Spinning({ covers, messages }: { covers: (string | null)[]; messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, messages.length - 1)), 2600);
    return () => clearInterval(id);
  }, [messages.length]);
  return (
    <Stage>
      <Reel covers={covers} speed="fast" />
      <p className="pill reel-button" role="status">
        {messages[i]}
      </p>
    </Stage>
  );
}
