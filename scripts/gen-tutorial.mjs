// Generates public/charts/tutorial.json from a plan in beat units on the beat grid of Apparatus Overlord.
// Plain node, no deps. Run: npm run chart:tutorial   (or node scripts/gen-tutorial.mjs from anywhere)
// The plan below is the source of truth for the tutorial chart; features/tutorial/model/chart.test.ts
// checks the generated file against the caption script (TUTORIAL_PLAN) and the design rules.
import { readFileSync, writeFileSync } from 'node:fs';

const CHARTS = new URL('../public/charts/', import.meta.url);
const OUT = new URL('tutorial.json', CHARTS);

const src = JSON.parse(readFileSync(new URL('apparatus-overlord.json', CHARTS), 'utf8'));
const beats = src.beats;

/** Beat index (fractional) → seconds on the tracked grid (same maths as features/tutorial beatTime). */
function beatTime(beat) {
  const i = Math.max(0, Math.min(beats.length - 2, Math.floor(beat)));
  const step = beats[i + 1] - beats[i];
  return beats[i] + (beat - i) * step;
}
const r3 = (x) => Math.round(x * 1000) / 1000;
/** Duration in seconds from beat `b` for `len` beats, so the tail lands on the grid too. */
const dur = (b, len) => r3(beatTime(b + len) - beatTime(b));

// [beat, lane, lenBeats?, kind?, extra?]
const plan = [
  // --- 1 lane: taps on beats (Magic Tiles), then holds ---
  [10, 0], [11, 0], [12, 0], [13, 0],
  [15, 0], [16, 0], [17, 0], [18, 0],
  [22, 0, 2], [25, 0, 2], [28, 0, 2],
  // --- 2 lanes (section at 32): alternating taps, then slides ---
  [36, 0], [37, 1], [38, 0], [39, 1], [40, 0], [40.5, 1], [42, 0], [42.5, 1],
  [46, 0, 2, 'slide', 1], [50, 1, 2, 'slide', 0],
  // --- 3 lanes (section at 54): rolls ---
  [60, 1, 2, 'roll', 3], [63, 0, 2, 'roll', 3], [66, 2, 2, 'roll', 4],
  // --- 4 lanes (section at 70): circle window, then the slow spell ---
  [76, 0, 0, 'circle'], [77, 3, 0, 'circle'], [78, 1, 0, 'circle'], [79, 2, 0, 'circle'],
  [84, 1, 0, 'slow'], [85, 2], [86, 0], [87, 3], [88, 1], [89, 2], [90, 0], [91, 3],
  // --- 5 lanes (section at 93): everything mixed ---
  [98, 0], [99, 4], [100, 2], [101, 1, 2], [103.5, 3], [105, 2, 2, 'roll', 4], [108, 3, 2, 'slide', 4],
  [111, 0], [111.5, 1], [112, 2], [113.5, 0], [113.5, 4],
  // --- 6 lanes (section at 115.5): short finale ---
  [120, 0], [121, 5], [122, 1], [123, 4], [124, 2], [125, 3], [126.5, 2], [127, 3], [128, 0], [128, 5], [130, 2, 2],
];
// The first section starts at song time 0 (not at the first tracked beat), so parseSections does not
// prepend a second one-lane section before it.
const sectionBeats = [[null, 1], [32, 2], [54, 3], [70, 4], [93, 5], [115.5, 6]];

const notes = plan.map(([b, lane, len = 0, kind, extra]) => {
  const t = r3(beatTime(b));
  if (len === 0 && kind === undefined) return [t, lane];
  if (kind === undefined) return [t, lane, dur(b, len)];
  if (extra === undefined) return [t, lane, 0, kind];
  return [t, lane, dur(b, len), kind, extra];
});
const sections = sectionBeats.map(([b, lanes]) => [b === null ? 0 : r3(beatTime(b)), lanes]);

const out = {
  id: 'tutorial',
  title: 'Обучение',
  artist: src.artist,
  license: src.license,
  sourceUrl: src.sourceUrl,
  audio: src.audio,
  bpm: src.bpm,
  offset: src.offset,
  duration: src.duration,
  genre: src.genre,
  beats: src.beats,
  chart: { stars: 1, notes, sections },
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`notes ${notes.length}, sections ${sections.map((s) => `${s[1]}@${s[0]}`).join(' ')}, last ${notes[notes.length - 1][0]} s`);
