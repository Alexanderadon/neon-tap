// Generates public/charts/tutorial.json from a plan in beat units on the beat grid of the tutorial song
// (assets-src/tutorial.json: Apparatus Overlord by vitalezzz, CC0, kept as music/tutorial.mp3 — the track itself left the catalog).
// Plain node, no deps. Run: npm run chart:tutorial   (or node scripts/gen-tutorial.mjs from anywhere)
// The plan below is the source of truth for the tutorial chart; features/tutorial/model/chart.test.ts
// checks the generated file against the caption script (TUTORIAL_PLAN) and the design rules.
//
// music/tutorial.mp3 is the song's first AUDIO_SEC seconds (the chart is over at ~37 s; the rest plays
// under the «Готово!» frame), cut once from the full 150 s file with
//   ffmpeg -i tutorial-full.mp3 -t 75 -af afade=t=out:st=73.5:d=1.5 -c:a libmp3lame -q:a 1 tutorial.mp3
// The beat grid and `duration` below are cut to match.
import { readFileSync, writeFileSync } from 'node:fs';

const CHARTS = new URL('../public/charts/', import.meta.url);
const OUT = new URL('tutorial.json', CHARTS);
/** Length of music/tutorial.mp3, seconds. */
const AUDIO_SEC = 75;

const src = JSON.parse(readFileSync(new URL('../assets-src/tutorial.json', import.meta.url), 'utf8'));
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

// [beat, lane, lenBeats?, kind?] — only what chapter 1 has: taps, holds, a heart, 1 → 4 lanes, no chords.
// The first note of the steps that replay (tap, hold, lanes2) lands ≥ 3.5 beats (a whole fall) after the
// step starts, so a rewind to the step's start shows its notes from the top of the field.
// prettier-ignore
const plan = [
  // --- tap (1 lane): eight taps on the beats, Magic Tiles style ---
  [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0],
  // --- hold (1 lane) ---
  [20, 0, 2], [23, 0, 2], [26, 0, 2],
  // --- lanes2 (section at 30): left, left, right, right ---
  [32, 0], [33, 0], [34, 1], [35, 1],
  // --- alt: hand after hand ---
  [38, 0], [39, 1], [40, 0], [41, 1], [42, 0], [43, 1],
  // --- lanes3 (section at 45): across and back, a hold at the end ---
  [47, 0], [48, 1], [49, 2], [50, 1], [51, 0, 2],
  // --- lanes4 (section at 55): a run up and back ---
  [57, 0], [58, 1], [59, 2], [60, 3], [61, 2], [62, 1],
  // --- spell: the heart, then a short tail on all four lanes ---
  [66, 1, 0, 'heart'],
  [68, 2], [69, 3], [70, 0], [71, 1], [72, 2, 2],
];
// The first section starts at song time 0 (not at the first tracked beat), so parseSections does not
// prepend a second one-lane section before it.
// prettier-ignore
const sectionBeats = [[null, 1], [30, 2], [45, 3], [55, 4]];

const notes = plan.map(([b, lane, len = 0, kind]) => {
  const t = r3(beatTime(b));
  if (kind !== undefined) return [t, lane, len > 0 ? dur(b, len) : 0, kind];
  return len === 0 ? [t, lane] : [t, lane, dur(b, len)];
});
const sections = sectionBeats.map(([b, lanes]) => [b === null ? 0 : r3(beatTime(b)), lanes]);
const last = Math.max(...notes.map((n) => n[0] + (n[2] ?? 0)));
if (last + 1.5 > AUDIO_SEC - 1.5) throw new Error(`the chart ends at ${last} s — past the fade-out of the ${AUDIO_SEC} s song`);

const out = {
  id: 'tutorial',
  title: 'Обучение',
  artist: src.artist,
  license: src.license,
  sourceUrl: src.sourceUrl,
  audio: src.audio,
  bpm: src.bpm,
  offset: src.offset,
  duration: AUDIO_SEC,
  genre: src.genre,
  beats: beats.filter((t) => t <= AUDIO_SEC),
  chart: { stars: 1, notes, sections },
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`notes ${notes.length}, sections ${sections.map((s) => `${s[1]}@${s[0]}`).join(' ')}, last ends ${r3(last)} s, song ${AUDIO_SEC} s`);
