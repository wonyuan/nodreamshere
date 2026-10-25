import type { Poem, Track } from "./types";

// Dev-only: open http://127.0.0.1:5173/?preview=intro|seeds|pick|writing|poem to look at
// any screen with sample data, without searching or spending LLM calls.

export const previewScreen = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("preview") : null;

const SAMPLE: [string, string, string][] = [
  ["White Flag", "Clairo", "Immunity"],
  ["Motion Sickness", "Phoebe Bridgers", "Stranger in the Alps"],
  ["Nikes", "Frank Ocean", "Blonde"],
  ["Liability", "Lorde", "Melodrama"],
  ["Cherry Wine", "Hozier", "Hozier"],
  ["Seventeen", "Sharon Van Etten", "Remind Me Tomorrow"],
  ["Ribs", "Lorde", "Pure Heroine"],
  ["Pink + White", "Frank Ocean", "Blonde"],
  ["Kyoto", "Phoebe Bridgers", "Punisher"],
  ["Sofia", "Clairo", "Immunity"],
  ["Ivy", "Frank Ocean", "Blonde"],
];

export function sampleTracks(covers: string[]): Track[] {
  return SAMPLE.map(([name, artist, album], i) => ({
    id: `sample-${i}`,
    name,
    artists: [artist],
    album,
    albumArt: covers[i % Math.max(covers.length, 1)] ?? null,
    isrc: null,
    durationMs: 200_000,
    url: "https://open.spotify.com",
  }));
}

export const samplePoem = (tracks: Track[]): Poem => ({
  poem: "I stop stitching us,\nold summers fold like paper,\none white flag held high.",
  scenario: "letting go of a friendship that has fallen apart, when effort alone can't repair it.",
  why: "you keep coming back to songs about the quiet after a friendship ends, and four of your nine sit right there.",
  tracks: [tracks[0], tracks[1], tracks[3], tracks[9]],
});
