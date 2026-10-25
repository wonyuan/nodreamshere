// An album on the title reel, with what its thought bubble says on hover.
export type Album = { cover: string; title: string; artist: string };

export type Track = {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  isrc: string | null;
  durationMs: number;
  url: string;
};

// What one song is about, read from its lyrics.
export type SongReading = {
  // What the song is really about, including its context.
  situation: string;
  mood: string;
  // Where it ends up: the turn in the last verse, bridge or outro.
  ending: string;
};

export type PoemRequest = {
  tracks: Track[];
  // Readings for each track, in order, if the app already fetched them.
  readings?: SongReading[];
  // Haikus already written for these songs, so "write another" doesn't repeat their images.
  avoid?: string[];
};

// An artist, genre or single song someone picked, resolved to songs.
export type Seed = {
  kind: "artist" | "genre" | "song";
  label: string;
  tracks: Track[];
  // A picture for its sticker: the artist's photo or the song's cover. Genres have none.
  image?: string | null;
};

// What matches as someone types into the "name your artists" box.
export type Suggestions = {
  artists: { id: number; name: string; image: string | null }[];
  // "popular" songs are well known enough that typing just their title probably means them.
  songs: { track: Track; popular: boolean }[];
};

export type Poem = {
  poem: string;
  // The situation shared across their songs that the haiku was written about.
  scenario: string;
  // Why that situation runs through their songs.
  why: string;
  // The songs that share the situation.
  tracks: Track[];
};
