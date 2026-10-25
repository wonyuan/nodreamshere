import type { Poem, PoemRequest, SongReading } from "../src/lib/types";
import { completeJson } from "./_lib/llm.js";
import { json, llmFailure, parseTracks, rateLimited, tooMany } from "./_lib/http.js";
import { readSongs } from "./_lib/reading.js";

// Cohere can be slow on a bad day; let Vercel wait for it.
export const maxDuration = 300;

// Each song has already been read (api/read.ts) for its situation and mood, so a single call
// finds the scenario that runs through the most songs, then writes a
// haiku about that shared moment — the experience, rather than any one song.

const SYSTEM = `You understand music and the people who listen to it, and you write haiku in one specific voice: quiet, plain, first person, built from small physical things.
Everything you write is original.
Reply with a single JSON object and nothing else.`;

// The listener's own favourite haiku. It sets how simple and plain the wording should be,
// not what the poem is about: only one example, so its images don't become a template.
const EXAMPLE = `I stop stitching us,
old summers fold like paper,
one white flag held high.`;

function avoidList(avoid?: string[]) {
  if (!avoid?.length) return "";
  return `\nThese haikus were already written for this listener. Use none of their images, objects or verbs:\n${avoid
    .map((p) => p.replace(/\n/g, " / "))
    .join("\n")}`;
}

type Answer = { scenario: string; songs: number[]; why: string; drafts?: string[]; poem: string };

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function prompt(body: PoemRequest, readings: SongReading[], order: number[]) {
  const songs = order
    .map((i, n) => {
      const t = body.tracks[i];
      const r = readings[i];
      return `#${n + 1} "${t.name}" by ${t.artists.join(", ")}: ${r.situation} Mood: ${r.mood}.${r.ending ? ` Ends: ${r.ending}` : ""}`;
    })
    .join("\n");

  return `These are songs a listener says represent them (in no particular order), each with what it's really about, its mood, and where it ends up.

${songs}

Part 1, find what they share:
1. Group the songs by what they are really saying. Look for the experience underneath, the thing many people have lived through.
2. Choose ONE shared experience. Make it specific, never a broad theme: "feeling empty and far from home after getting what you wanted", not "emotional pain" or "relationships". It's better to fit two to four songs exactly than six loosely. Stay faithful to those songs. Don't add settings, events or habits they don't describe (no parties, drinking or phones unless the songs are about them).
3. Follow the songs' arc, not just their opening mood. If they turn at the end (toward hope, acceptance, wanting more), let the haiku's last line carry that turn, quietly and without a pep talk. If they stay in the ache, let it stay, tender, not hopeless.

Part 2, write the haiku about that experience.
Use plain, everyday words, nothing fancy or poetic-sounding. Keep it quiet and understated, and don't name the emotion.
How this voice works (see the example below):
- The speaker DOES something. It's a gesture or a decision, not a still life of objects someone left behind.
- It puts a plain, physical verb onto something you can't touch: a relationship, a stretch of time, an old version of yourself ("stitching us", "summers fold"). That's where it gets its surprise, not from fancy words.
- It ends on one simple, clear image of the turn, the way a raised white flag says "I give up" without saying it.
- Find that image in the particular world of these songs (what they're about, where they're set, what the person is doing), so the haiku couldn't belong to any other set of songs.
Avoid the stock "after it ended" still life. No sweaters, jackets, pockets, chairs, mugs, coffee, tea, kettles, photos, pillows, sheets, "your side of the bed", empty rooms, doors, windows, rain on glass, keys, dust, phones or texts, unless one of the songs is literally about that thing. If a line could appear in a thousand sad poems, throw it out and find the one that only fits here.
- 5-7-5 syllables, counted carefully; lowercase except "I"; commas end lines 1 and 2, a full stop ends line 3
- no names, song titles, artists or quoted lyrics
- no clichés: heart, soul, tears, whispers, echoes, shattered, broken, journey, embrace, dance, light and dark, sun, stars, wings, fading, healing, ghosts, haunting, ache, "let go", "move on", "weight on my chest"
- no advice, lessons or reassurance

This haiku is the voice to match: short, plain words, an action instead of a scene, a physical verb on something abstract, a clear closing image. Match how it works, not what it's about. Don't borrow its images (stitching, paper, flags) or its subject:

${EXAMPLE}
${avoidList(body.avoid)}
Write three drafts that each go somewhere completely different, then keep the one that would hit hardest for this person.

Never use em dashes (—) or en dashes (–) anywhere: not in the haiku, the scenario or the why. Use a comma, a full stop or a new sentence instead.

Return JSON with exactly these keys:
{"scenario": "one sentence naming the shared experience as the songs describe it, with no names, titles or lyrics",
 "songs": [the numbers of the songs that share it],
 "why": "1-2 short, plain sentences to the listener as 'you', on what these songs are actually saying and why it keeps coming back in the songs they love, including where the songs land. Plain words, like talking to a friend: no metaphors, no invented scenes, and don't mention the haiku's images as if they were in the songs. No reassurance like 'it's okay' or 'you deserve'. Start with 'you', never with 'This'",
 "drafts": ["haiku 1", "haiku 2", "haiku 3"],
 "poem": "the best of the three, lines separated by \\n"}`;
}

// Backstop for the no-dashes rule: a spaced or unspaced em/en dash becomes a comma.
const noDashes = (text: string) =>
  text
    .replace(/\s*[—–]\s*$/, ".")
    .replace(/\s*[—–]\s*(?=\n)/g, ",")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*([,.;:!?])/g, "$1");

// Hold the voice's lowercase style even when the model drifts: only "I" keeps its capital.
const lowercase = (poem: string) =>
  poem
    .split("\n")
    .map((line) => line.trim())
    .map((line) => (/^I(?!\p{L})/u.test(line) ? line : line.charAt(0).toLowerCase() + line.slice(1)))
    .map((line) => line.replace(/(?<!\p{L})i(?=$|[\s,.'’])/gu, "I"))
    // Commas end the first lines and a full stop the last, when the model leaves them off.
    .map((line, n, lines) => (/[\p{P}]$/u.test(line) ? line : line + (n === lines.length - 1 ? "." : ",")))
    .join("\n");

// Cohere doesn't reliably honour the banned lists, so check its drafts here too.
const STALE =
  /\b(heart|soul|tears?|whisper\w*|echo\w*|shattered|broken|journey|embrace|danc\w+|wings?|fading|healing|ghosts?|haunt\w*|ache\w*|sweaters?|jackets?|pockets?|chairs?|mugs?|coffee|kettle|photos?|pillows?|sheets|dust)\b|let go|move on/i;

// The model's pick if it's clean, otherwise the first clean draft (null if none are).
function freshPoem(answer: Answer): string | null {
  const drafts = Array.isArray(answer.drafts) ? answer.drafts.map(String) : [];
  return [String(answer.poem ?? ""), ...drafts].find((p) => p.trim() && !STALE.test(p)) ?? null;
}

function parseBody(raw: unknown): PoemRequest | null {
  const b = raw as Partial<PoemRequest> | null;
  const tracks = parseTracks(b?.tracks);
  if (!tracks) return null;
  // Readings are optional; ignore them unless there's one per track.
  const readings =
    Array.isArray(b?.readings) && b.readings.length === tracks.length
      ? b.readings.map((r) => ({
          situation: String(r?.situation ?? "").slice(0, 400),
          mood: String(r?.mood ?? "").slice(0, 120),
          ending: String(r?.ending ?? "").slice(0, 300),
        }))
      : undefined;
  const avoid = Array.isArray(b?.avoid) ? b.avoid.slice(-5).map((p) => String(p).slice(0, 200)) : undefined;
  return { tracks, readings, avoid };
}

export async function POST(req: Request): Promise<Response> {
  if (rateLimited(req, "poem", 20)) return tooMany();
  const body = parseBody(await req.json().catch(() => null));
  if (!body) return json({ error: "bad request" }, 400);

  // Shuffle so the model doesn't just favour whichever songs come first.
  const order = shuffled(body.tracks.map((_, i) => i));

  let answer: Answer;
  try {
    const readings = body.readings ?? (await readSongs(body.tracks));
    answer = await completeJson<Answer>(SYSTEM, prompt(body, readings, order));
    // Every draft fell back on a stock image: ask once more before settling.
    if (!freshPoem(answer)) answer = await completeJson<Answer>(SYSTEM, prompt(body, readings, order));
  } catch (err) {
    return llmFailure(err);
  }

  // Map the model's song numbers back to the listener's tracks, ignoring anything out of range.
  const picked = [...new Set((Array.isArray(answer.songs) ? answer.songs : []).map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= order.length)
    .map((n) => body.tracks[order[n - 1]]);

  const poem: Poem = {
    poem: lowercase(noDashes(freshPoem(answer) ?? String(answer.poem ?? ""))),
    scenario: noDashes(String(answer.scenario ?? "")),
    why: noDashes(String(answer.why ?? "")),
    tracks: picked,
  };
  if (!poem.poem) return json({ error: "the poet came back with a blank page — try again" }, 502);
  return json(poem);
}
