import { GENRES, type Genre } from '@/shared/types/chart';
import { findTrack } from './catalog';

/**
 * Procedural cover art — a deterministic list of SVG primitives built from the track id hash
 * and its genre. Pure data (no DOM) so it is unit-testable; `ui/TrackCover.tsx` renders it.
 * Everything lives in a 100 × 100 viewBox.
 */

export interface CoverPalette {
  /** Background gradient, top → bottom. */
  bg: readonly [string, string];
  accent: string;
  accent2: string;
}

export const COVER_PALETTES: Record<Genre, CoverPalette> = {
  synthwave: { bg: ['#1a0533', '#3a0c6e'], accent: '#ff2bd6', accent2: '#00f0ff' },
  chiptune: { bg: ['#0b1d2a', '#0f3b3d'], accent: '#b6ff00', accent2: '#00f0ff' },
  lofi: { bg: ['#2a1b2e', '#4a2f45'], accent: '#ffb385', accent2: '#c9a0dc' },
  rock: { bg: ['#1a0a0a', '#3a1010'], accent: '#ff3b3b', accent2: '#ff8a00' },
  orchestral: { bg: ['#0d1330', '#223070'], accent: '#ffd700', accent2: '#ffffff' },
  jazz: { bg: ['#1c1206', '#3a2410'], accent: '#ffb020', accent2: '#ff5c8a' },
  dnb: { bg: ['#0a0f1a', '#0f1f45'], accent: '#00f0ff', accent2: '#ff2bd6' },
  techno: { bg: ['#0a0a0a', '#222222'], accent: '#b6ff00', accent2: '#ffffff' },
  ambient: { bg: ['#071a2a', '#0c3a4a'], accent: '#7ee8fa', accent2: '#a78bfa' },
  acoustic: { bg: ['#2a1a0c', '#4a2e14'], accent: '#d9a066', accent2: '#f2c98a' },
  world: { bg: ['#1f0d1a', '#3a1530'], accent: '#ff8a00', accent2: '#2dd4bf' },
  electronic: { bg: ['#0b0b2a', '#181860'], accent: '#7c6cff', accent2: '#00f0ff' },
  // --- tracks2 ---
  trance: { bg: ['#03102b', '#0a3d7a'], accent: '#5ad7ff', accent2: '#ffffff' },
  house: { bg: ['#2a0a1a', '#5a1638'], accent: '#ff7a1a', accent2: '#ffd23f' },
  hardstyle: { bg: ['#120000', '#3a0a14'], accent: '#ff1e3c', accent2: '#ffe14d' },
  hardcore: { bg: ['#0a0a0a', '#2a0f0f'], accent: '#ff4d00', accent2: '#ff2bd6' },
  breakbeat: { bg: ['#061a12', '#0e3d2c'], accent: '#3dff9a', accent2: '#ffe14d' },
  eurobeat: { bg: ['#1a0a2e', '#3d1466'], accent: '#ff3d8f', accent2: '#5ad7ff' },
  synthpop: { bg: ['#25104a', '#4a2a86'], accent: '#ff8ad6', accent2: '#7ee8fa' },
  metal: { bg: ['#0c0c10', '#26262e'], accent: '#c0c8d8', accent2: '#ff3b3b' },
};

/** Genre used for covers when the chart has none (user files, old catalogs). */
export const DEFAULT_GENRE: Genre = 'electronic';

export function isGenre(x: unknown): x is Genre {
  return typeof x === 'string' && (GENRES as readonly string[]).includes(x);
}

/** FNV-1a 32-bit — stable across platforms, cheap. */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32 — small deterministic PRNG in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Num = number | string;
export type CoverShape =
  | { kind: 'rect'; x: Num; y: Num; w: Num; h: Num; fill: string; opacity?: number; rx?: number }
  | { kind: 'circle'; cx: Num; cy: Num; r: Num; fill: string; opacity?: number; stroke?: string; strokeWidth?: number }
  | { kind: 'path'; d: string; fill: string; stroke?: string; strokeWidth?: number; opacity?: number }
  | { kind: 'line'; x1: Num; y1: Num; x2: Num; y2: Num; stroke: string; strokeWidth: number; opacity?: number };

export interface CoverSpec {
  id: string;
  genre: Genre;
  seed: number;
  palette: CoverPalette;
  shapes: CoverShape[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Build the full cover description. Same `id` + `genre` → identical output. */
/** The track's picture cover (`/covers/<id>.webp`) when the catalog has one; null → procedural art. */
export function coverImage(id: string): string | null {
  const cover = findTrack(id)?.cover;
  return cover ? `/${cover}` : null;
}

export function coverSpec(id: string, genre: Genre | undefined): CoverSpec {
  const g = genre && isGenre(genre) ? genre : DEFAULT_GENRE;
  // A pack's tracks share one cover: the art is seeded by the pack, not the track.
  const seed = hashId(`${findTrack(id)?.pack ?? id}|${g}`);
  const palette = COVER_PALETTES[g];
  const rnd = seededRandom(seed);
  const shapes = MOTIFS[g](rnd, palette);
  return { id, genre: g, seed, palette, shapes };
}

type Motif = (rnd: () => number, p: CoverPalette) => CoverShape[];

const pixelBlocks: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const n = 8;
  const cell = 100 / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = rnd();
      if (v < 0.42) continue;
      const fill = v > 0.85 ? p.accent2 : p.accent;
      out.push({ kind: 'rect', x: r1(x * cell + 1), y: r1(y * cell + 1), w: r1(cell - 2), h: r1(cell - 2), fill, opacity: r1(0.35 + rnd() * 0.65) });
    }
  }
  return out;
};

const sunStripes: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const cx = r1(35 + rnd() * 30);
  const cy = r1(40 + rnd() * 12);
  const r = r1(22 + rnd() * 8);
  out.push({ kind: 'circle', cx, cy, r, fill: p.accent });
  // horizontal cut-outs on the lower half of the sun
  for (let i = 0; i < 5; i++) {
    const y = cy + 2 + i * 5;
    out.push({ kind: 'rect', x: cx - r - 1, y: r1(y), w: r * 2 + 2, h: r1(1 + i * 0.5), fill: p.bg[1] });
  }
  const horizon = cy + r + 4;
  out.push({ kind: 'line', x1: 0, y1: horizon, x2: 100, y2: horizon, stroke: p.accent2, strokeWidth: 1 });
  for (let i = 1; i <= 4; i++) {
    const y = horizon + i * i * 3;
    if (y > 100) break;
    out.push({ kind: 'line', x1: 0, y1: r1(y), x2: 100, y2: r1(y), stroke: p.accent2, strokeWidth: 0.6, opacity: 0.6 });
  }
  const vp = cx;
  for (let i = -4; i <= 4; i++) {
    out.push({ kind: 'line', x1: vp, y1: horizon, x2: r1(vp + i * 30), y2: 100, stroke: p.accent2, strokeWidth: 0.6, opacity: 0.5 });
  }
  return out;
};

const jaggedWave: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  for (let line = 0; line < 2; line++) {
    const pts: string[] = [];
    const base = 50 + line * 8 - 4;
    for (let x = 0; x <= 100; x += 5) {
      const amp = (rnd() * 2 - 1) * (10 + rnd() * 28);
      pts.push(`${x},${r1(base + amp)}`);
    }
    out.push({ kind: 'path', d: 'M' + pts.join(' L'), fill: 'none', stroke: line === 0 ? p.accent : p.accent2, strokeWidth: line === 0 ? 3 : 1.5, opacity: line === 0 ? 1 : 0.7 });
  }
  out.push({ kind: 'line', x1: 0, y1: 50, x2: 100, y2: 50, stroke: p.accent2, strokeWidth: 0.5, opacity: 0.4 });
  return out;
};

const concentricArcs: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const cx = r1(70 + rnd() * 30);
  const cy = r1(70 + rnd() * 30);
  const n = 7 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const r = 10 + i * (90 / n);
    const sw = r1(1 + rnd() * 3);
    const stroke = i % 3 === 0 ? p.accent2 : p.accent;
    // full circle path (clipped by the viewBox) — arcs fan out from a corner
    out.push({ kind: 'circle', cx, cy, r: r1(r), fill: 'none', stroke, strokeWidth: sw, opacity: r1(0.9 - i * (0.6 / n)) });
  }
  return out;
};

const softBlobs: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    out.push({
      kind: 'circle',
      cx: r1(rnd() * 100),
      cy: r1(rnd() * 100),
      r: r1(14 + rnd() * 26),
      fill: i % 2 ? p.accent2 : p.accent,
      opacity: r1(0.25 + rnd() * 0.35),
    });
  }
  return out;
};

const stripes = (diagonal: boolean): Motif => (rnd, p) => {
  const out: CoverShape[] = [];
  let x = -20;
  while (x < 120) {
    const w = r1(1 + rnd() * 5);
    const gap = r1(1.5 + rnd() * 4);
    const stroke = rnd() > 0.8 ? p.accent2 : p.accent;
    out.push(
      diagonal
        ? { kind: 'line', x1: r1(x), y1: 100, x2: r1(x + 40), y2: 0, stroke, strokeWidth: w, opacity: r1(0.5 + rnd() * 0.5) }
        : { kind: 'line', x1: r1(x), y1: 0, x2: r1(x), y2: 100, stroke, strokeWidth: w, opacity: r1(0.5 + rnd() * 0.5) },
    );
    x += w + gap;
  }
  return out;
};

const gradientHaze: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  for (let i = 0; i < 4; i++) {
    const cx = r1(rnd() * 100);
    const cy = r1(rnd() * 100);
    const r = r1(30 + rnd() * 40);
    // layered translucent discs approximate a radial haze without per-instance gradient defs
    for (let k = 4; k >= 1; k--) {
      out.push({ kind: 'circle', cx, cy, r: r1((r * k) / 4), fill: i % 2 ? p.accent2 : p.accent, opacity: 0.08 });
    }
  }
  return out;
};

const woodRings: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const cx = r1(30 + rnd() * 40);
  const cy = r1(30 + rnd() * 40);
  const n = 9 + Math.floor(rnd() * 5);
  for (let i = 1; i <= n; i++) {
    const r = i * (60 / n) + rnd() * 2;
    out.push({ kind: 'circle', cx, cy, r: r1(r), fill: 'none', stroke: i % 4 === 0 ? p.accent2 : p.accent, strokeWidth: r1(0.6 + rnd() * 1.4), opacity: r1(0.35 + rnd() * 0.5) });
  }
  out.push({ kind: 'circle', cx, cy, r: 3, fill: p.accent2, opacity: 0.9 });
  return out;
};

const swingDots: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const phase = rnd() * Math.PI * 2;
  const freq = 1 + rnd() * 1.5;
  const rows = 2 + Math.floor(rnd() * 2);
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < 12; i++) {
      const x = 6 + i * 8;
      const y = 50 + (row - (rows - 1) / 2) * 22 + Math.sin(phase + (i / 12) * Math.PI * 2 * freq) * 14;
      const rr = 1.5 + rnd() * 3.5;
      out.push({ kind: 'circle', cx: r1(x), cy: r1(y), r: r1(rr), fill: (i + row) % 3 === 0 ? p.accent2 : p.accent, opacity: r1(0.6 + rnd() * 0.4) });
    }
  }
  return out;
};

const woven: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const step = 8 + Math.floor(rnd() * 5);
  const off = r1(rnd() * step);
  for (let i = -100; i <= 200; i += step) {
    out.push({ kind: 'line', x1: r1(i + off), y1: 0, x2: r1(i + off - 100), y2: 100, stroke: p.accent, strokeWidth: r1(1 + rnd() * 2), opacity: r1(0.4 + rnd() * 0.4) });
    out.push({ kind: 'line', x1: r1(i - off), y1: 0, x2: r1(i - off + 100), y2: 100, stroke: p.accent2, strokeWidth: r1(1 + rnd() * 2), opacity: r1(0.4 + rnd() * 0.4) });
  }
  return out;
};

const circuit: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    let x = r1(rnd() * 100);
    let y = r1(rnd() * 100);
    const pts = [`${x},${y}`];
    const segs = 3 + Math.floor(rnd() * 3);
    for (let s = 0; s < segs; s++) {
      if (rnd() > 0.5) x = r1(Math.max(0, Math.min(100, x + (rnd() * 2 - 1) * 50)));
      else y = r1(Math.max(0, Math.min(100, y + (rnd() * 2 - 1) * 50)));
      pts.push(`${x},${y}`);
    }
    out.push({ kind: 'path', d: 'M' + pts.join(' L'), fill: 'none', stroke: i % 2 ? p.accent2 : p.accent, strokeWidth: r1(1 + rnd() * 1.5), opacity: 0.85 });
    out.push({ kind: 'circle', cx: x, cy: y, r: r1(2 + rnd() * 2), fill: i % 2 ? p.accent2 : p.accent });
  }
  return out;
};

// --- tracks2 ---

/** Trance: rays fanning out from a bright point near the top. */
const sunburst: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const cx = r1(30 + rnd() * 40);
  const cy = r1(15 + rnd() * 20);
  const n = 14 + Math.floor(rnd() * 8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.2;
    const len = 60 + rnd() * 60;
    out.push({
      kind: 'line',
      x1: cx,
      y1: cy,
      x2: r1(cx + Math.cos(a) * len),
      y2: r1(cy + Math.sin(a) * len),
      stroke: i % 4 === 0 ? p.accent2 : p.accent,
      strokeWidth: r1(0.5 + rnd() * 2.5),
      opacity: r1(0.3 + rnd() * 0.6),
    });
  }
  out.push({ kind: 'circle', cx, cy, r: r1(4 + rnd() * 4), fill: p.accent2, opacity: 0.95 });
  out.push({ kind: 'circle', cx, cy, r: r1(10 + rnd() * 6), fill: p.accent, opacity: 0.35 });
  return out;
};

/** House: equaliser bars rising from the bottom edge. */
const eqBars: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const n = 9 + Math.floor(rnd() * 5);
  const w = 100 / n;
  for (let i = 0; i < n; i++) {
    const h = 15 + rnd() * 70;
    out.push({ kind: 'rect', x: r1(i * w + 1), y: r1(100 - h), w: r1(w - 2), h: r1(h), fill: i % 3 === 1 ? p.accent2 : p.accent, opacity: r1(0.55 + rnd() * 0.45), rx: 1 });
    out.push({ kind: 'rect', x: r1(i * w + 1), y: r1(100 - h - 6 - rnd() * 8), w: r1(w - 2), h: 2, fill: p.accent2, opacity: 0.9 });
  }
  return out;
};

/** Hardstyle: a bold lightning bolt over a darker slab. */
const bolt: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const x0 = 35 + rnd() * 30;
  const pts: string[] = [`${r1(x0)},0`];
  let x = x0;
  let y = 0;
  const segs = 4 + Math.floor(rnd() * 3);
  for (let s = 0; s < segs; s++) {
    y += 100 / segs;
    x += (rnd() * 2 - 1) * 28;
    x = Math.max(5, Math.min(95, x));
    pts.push(`${r1(x)},${r1(y)}`);
  }
  out.push({ kind: 'rect', x: 0, y: r1(30 + rnd() * 20), w: 100, h: r1(15 + rnd() * 10), fill: p.accent, opacity: 0.2 });
  out.push({ kind: 'path', d: 'M' + pts.join(' L'), fill: 'none', stroke: p.accent2, strokeWidth: r1(6 + rnd() * 4), opacity: 0.35 });
  out.push({ kind: 'path', d: 'M' + pts.join(' L'), fill: 'none', stroke: p.accent, strokeWidth: r1(2.5 + rnd() * 2), opacity: 1 });
  return out;
};

/** Hardcore: scattered sharp shards. */
const shards: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const n = 7 + Math.floor(rnd() * 6);
  for (let i = 0; i < n; i++) {
    const cx = rnd() * 100;
    const cy = rnd() * 100;
    const len = 12 + rnd() * 30;
    const a = rnd() * Math.PI * 2;
    const wdt = 3 + rnd() * 8;
    const tipX = cx + Math.cos(a) * len;
    const tipY = cy + Math.sin(a) * len;
    const nx = -Math.sin(a) * wdt;
    const ny = Math.cos(a) * wdt;
    const d = `M${r1(cx + nx)},${r1(cy + ny)} L${r1(tipX)},${r1(tipY)} L${r1(cx - nx)},${r1(cy - ny)} Z`;
    out.push({ kind: 'path', d, fill: i % 3 === 0 ? p.accent2 : p.accent, opacity: r1(0.45 + rnd() * 0.5) });
  }
  return out;
};

/** Breakbeat: a horizontal grid with the rows chopped and shifted. */
const brokenGrid: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const rows = 8 + Math.floor(rnd() * 4);
  const step = 100 / rows;
  for (let r = 0; r < rows; r++) {
    const y = r1(r * step + step / 2);
    let x = -rnd() * 20;
    while (x < 100) {
      const w = 6 + rnd() * 26;
      const gap = 2 + rnd() * 10;
      if (rnd() > 0.25) {
        out.push({ kind: 'rect', x: r1(x), y: r1(y - 1.5), w: r1(w), h: 3, fill: rnd() > 0.75 ? p.accent2 : p.accent, opacity: r1(0.5 + rnd() * 0.5), rx: 1.5 });
      }
      x += w + gap;
    }
  }
  return out;
};

/** Eurobeat: a chequered flag sweeping across the corner. */
const chequer: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const cell = 8 + Math.floor(rnd() * 5);
  const skew = r1(rnd() * 0.5 + 0.2);
  const n = Math.ceil(100 / cell) + 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if ((x + y) % 2) continue;
      const px = x * cell - y * cell * skew;
      const py = y * cell;
      if (px > 100 || px + cell < 0) continue;
      const far = (x + y) / (2 * n);
      out.push({ kind: 'rect', x: r1(px), y: r1(py), w: cell, h: cell, fill: far > 0.55 ? p.accent2 : p.accent, opacity: r1(0.25 + (1 - far) * 0.7) });
    }
  }
  return out;
};

/** Synthpop: a dot lattice with one big ring. */
const dotRing: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  const step = 9 + Math.floor(rnd() * 4);
  for (let y = step / 2; y < 100; y += step) {
    for (let x = step / 2; x < 100; x += step) {
      out.push({ kind: 'circle', cx: r1(x), cy: r1(y), r: r1(1 + rnd() * 1.5), fill: p.accent2, opacity: r1(0.3 + rnd() * 0.5) });
    }
  }
  const cx = r1(30 + rnd() * 40);
  const cy = r1(30 + rnd() * 40);
  const r = r1(20 + rnd() * 15);
  out.push({ kind: 'circle', cx, cy, r, fill: 'none', stroke: p.accent, strokeWidth: r1(3 + rnd() * 4), opacity: 0.95 });
  out.push({ kind: 'circle', cx, cy, r: r1(r * 0.55), fill: p.accent, opacity: 0.35 });
  return out;
};

/** Metal: jagged spikes rising from the bottom edge. */
const spikes: Motif = (rnd, p) => {
  const out: CoverShape[] = [];
  for (let layer = 0; layer < 2; layer++) {
    const pts: string[] = ['0,100'];
    let x = 0;
    while (x < 100) {
      const w = 5 + rnd() * 12;
      const h = layer === 0 ? 30 + rnd() * 55 : 10 + rnd() * 35;
      pts.push(`${r1(x + w / 2)},${r1(100 - h)}`);
      x += w;
      pts.push(`${r1(Math.min(100, x))},100`);
    }
    out.push({ kind: 'path', d: 'M' + pts.join(' L') + ' Z', fill: layer === 0 ? p.accent : p.accent2, opacity: layer === 0 ? 0.45 : 0.8 });
  }
  out.push({ kind: 'line', x1: 0, y1: r1(20 + rnd() * 15), x2: 100, y2: r1(20 + rnd() * 15), stroke: p.accent2, strokeWidth: 1.2, opacity: 0.7 });
  return out;
};

const MOTIFS: Record<Genre, Motif> = {
  chiptune: pixelBlocks,
  synthwave: sunStripes,
  rock: jaggedWave,
  orchestral: concentricArcs,
  lofi: softBlobs,
  dnb: stripes(true),
  techno: stripes(false),
  ambient: gradientHaze,
  acoustic: woodRings,
  jazz: swingDots,
  world: woven,
  electronic: circuit,
  // --- tracks2 ---
  trance: sunburst,
  house: eqBars,
  hardstyle: bolt,
  hardcore: shards,
  breakbeat: brokenGrid,
  eurobeat: chequer,
  synthpop: dotRing,
  metal: spikes,
};
