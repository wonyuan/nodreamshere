import { useEffect, useState } from "react";
import { Stage } from "../components/Stage";
import { Reel } from "../components/Reel";
import type { Album } from "../lib/types";

// Frame 1, plus the "spinning cd player" loading state, which is the same reel spun fast.
// Hovering an album on the reel shows what it is in a glass note beside the card.

function AlbumNote({ album }: { album: Album | null }) {
  if (!album) return null;
  return (
    <div key={album.cover} className="result-info album-note">
      <img src={album.cover} alt="" />
      <span>
        {/* Drop tags like "(Deluxe Edition)": the album's name is enough. */}
        <strong>{album.title.replace(/\s*[([][^)\]]*[)\]]\s*$/, "")}</strong>
        <em>{album.artist}</em>
      </span>
    </div>
  );
}
export function Title({ albums, onStart }: { albums: Album[]; onStart: () => void }) {
  const [album, setAlbum] = useState<Album | null>(null);
  return (
    <Stage aside={<AlbumNote album={album} />}>
      <Reel albums={albums} onHover={setAlbum} />
      <button className="pill reel-button" onClick={onStart}>
        speak louder to me
      </button>
    </Stage>
  );
}

export function Spinning({ albums, messages }: { albums: Album[]; messages: string[] }) {
  const [i, setI] = useState(0);
  const [album, setAlbum] = useState<Album | null>(null);
  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, messages.length - 1)), 2600);
    return () => clearInterval(id);
  }, [messages.length]);
  return (
    <Stage aside={<AlbumNote album={album} />}>
      <Reel albums={albums} speed="fast" onHover={setAlbum} />
      <p className="pill reel-button" role="status">
        {messages[i]}
      </p>
    </Stage>
  );
}
