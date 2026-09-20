/**
 * The level star and the endless-mode crown — one geometry for the SVG glyphs (shared/ui/Stars)
 * and the canvas sprites (the HUD), so they are pixel-siblings everywhere. Both are cut like gems:
 * flat facets lit from the top-left, a dark rim, a white edge light on the lit edges and one
 * specular spot — no blur, no filters, so iOS draws them as drawn. Everything lives in a 24 × 24
 * box, tip up. Detail follows size: the facets are for the big glyphs (the result screen, the star
 * show); at chip and card sizes ten facets turn to noise, so the small glyph is one smooth face lit
 * from the top-left with a single highlight.
 */

/** 'full' = the gem cut (≥ SIMPLE_BELOW_PX); 'simple' = one smooth face for the small sizes. */
export type GemDetail = 'full' | 'simple';
/** Glyphs smaller than this are drawn simple. */
export const SIMPLE_BELOW_PX = 48;
export const detailFor = (sizePx: number): GemDetail => (sizePx >= SIMPLE_BELOW_PX ? 'full' : 'simple');

export type Point = readonly [number, number];
/** A facet is a flat polygon with a brightness 0 (deepest shade) … 1 (full light). */
export interface Facet {
  points: readonly Point[];
  brightness: number;
}

export const STAR_CENTER: Point = [12, 12.8];
/** Ten vertices around the star, a tip then an inner corner, clockwise from the top tip. */
export const STAR_OUTLINE: readonly Point[] = [
  [12, 1.5],
  [15.12, 8.51],
  [22.75, 9.31],
  [17.04, 14.44],
  [18.64, 21.94],
  [12, 18.1],
  [5.36, 21.94],
  [6.96, 14.44],
  [1.25, 9.31],
  [8.88, 8.51],
];
/** Each tip splits into two facets that meet the centre; brightness = how much the facet faces the light (−0.55, −0.83). */
export const STAR_FACETS: readonly Facet[] = [
  { points: [STAR_CENTER, [8.88, 8.51], [12, 1.5]], brightness: 0.96 },
  { points: [STAR_CENTER, [12, 1.5], [15.12, 8.51]], brightness: 0.85 },
  { points: [STAR_CENTER, [15.12, 8.51], [22.75, 9.31]], brightness: 0.46 },
  { points: [STAR_CENTER, [22.75, 9.31], [17.04, 14.44]], brightness: 0.28 },
  { points: [STAR_CENTER, [17.04, 14.44], [18.64, 21.94]], brightness: 0.02 },
  { points: [STAR_CENTER, [18.64, 21.94], [12, 18.1]], brightness: 0.01 },
  { points: [STAR_CENTER, [12, 18.1], [5.36, 21.94]], brightness: 0.24 },
  { points: [STAR_CENTER, [5.36, 21.94], [6.96, 14.44]], brightness: 0.42 },
  { points: [STAR_CENTER, [6.96, 14.44], [1.25, 9.31]], brightness: 0.82 },
  { points: [STAR_CENTER, [1.25, 9.31], [8.88, 8.51]], brightness: 0.94 },
];
/** The edges that catch the light: the top-left of the top tip and the top of the left tip. */
export const STAR_LIT_EDGES: readonly (readonly [Point, Point])[] = [
  [
    [8.88, 8.51],
    [12, 1.5],
  ],
  [
    [1.25, 9.31],
    [8.88, 8.51],
  ],
];
/** The specular spot: an ellipse on the top tip's lit facet (centre, radii, rotation in degrees). */
export const STAR_SPECULAR = { cx: 10.9, cy: 5.6, rx: 0.9, ry: 2.1, rotate: -28 } as const;
export const STAR_SPARKLE: Point = [4.6, 10.4];

/** The crown: three peaks with pearls, a band with one gem. */
export const CROWN_OUTLINE: readonly Point[] = [
  [3, 20.5],
  [3, 9],
  [6.2, 5],
  [9.1, 12],
  [12, 3.5],
  [14.9, 12],
  [17.8, 5],
  [21, 9],
  [21, 20.5],
];
/** The seam between the peaks and the band. */
export const CROWN_BAND_TOP = 14;
export const CROWN_FACETS: readonly Facet[] = [
  {
    points: [
      [3, 9],
      [6.2, 5],
      [6.2, 14],
      [3, 14],
    ],
    brightness: 0.92,
  },
  {
    points: [
      [6.2, 5],
      [9.1, 12],
      [9.1, 14],
      [6.2, 14],
    ],
    brightness: 0.55,
  },
  {
    points: [
      [9.1, 12],
      [12, 3.5],
      [12, 14],
      [9.1, 14],
    ],
    brightness: 0.9,
  },
  {
    points: [
      [12, 3.5],
      [14.9, 12],
      [14.9, 14],
      [12, 14],
    ],
    brightness: 0.45,
  },
  {
    points: [
      [14.9, 12],
      [17.8, 5],
      [17.8, 14],
      [14.9, 14],
    ],
    brightness: 0.7,
  },
  {
    points: [
      [17.8, 5],
      [21, 9],
      [21, 14],
      [17.8, 14],
    ],
    brightness: 0.3,
  },
];
export const CROWN_LIT_EDGES: readonly (readonly [Point, Point])[] = [
  [
    [3, 9],
    [6.2, 5],
  ],
  [
    [9.1, 12],
    [12, 3.5],
  ],
];
/** Pearls on the three peaks (centre, radius). */
export const CROWN_PEARLS: readonly { cx: number; cy: number; r: number }[] = [
  { cx: 6.2, cy: 4.7, r: 1.55 },
  { cx: 12, cy: 3.2, r: 1.7 },
  { cx: 17.8, cy: 4.7, r: 1.55 },
];
/** The band's gem: the game's cyan, the only accent on the gold. */
export const CROWN_GEM = { cx: 12, cy: 17.3, r: 1.9 } as const;

/** Gold ramp by brightness: deep amber in the shade, pale gold in the light. */
const GOLD_STOPS: readonly (readonly [number, string])[] = [
  [0, '#d95f00'],
  [0.3, '#ff9a1a'],
  [0.6, '#ffd23f'],
  [1, '#fff5b0'],
];
/** The unearned glyph: the same cut in dark grey. */
const GREY_STOPS: readonly (readonly [number, string])[] = [
  [0, '#131419'],
  [0.5, '#262832'],
  [1, '#4a4d5c'],
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function ramp(stops: readonly (readonly [number, string])[], t: number): string {
  const k = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < stops.length - 2 && stops[i + 1][0] < k) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const u = t1 === t0 ? 0 : (k - t0) / (t1 - t0);
  const a = hexToRgb(c0);
  const b = hexToRgb(c1);
  const mix = a.map((v, j) => Math.round(v + (b[j] - v) * u));
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Facet colour for a brightness: gold when earned, grey while still to be won. */
export function facetTone(brightness: number, on: boolean): string {
  return on ? ramp(GOLD_STOPS, brightness) : ramp(GREY_STOPS, brightness);
}

/** Rim (outline) colour. */
export const RIM_GOLD = '#8a4500';
export const RIM_OFF = 'rgba(0,0,0,0.6)';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function polygon(ctx: Ctx, points: readonly Point[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

function edges(ctx: Ctx, lines: readonly (readonly [Point, Point])[], on: boolean): void {
  ctx.strokeStyle = on ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 0.75;
  ctx.lineCap = 'round';
  for (const [a, b] of lines) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
}

/** The smooth face of a small glyph: lit from the top-left, deep at the bottom-right. */
function smoothFace(ctx: Ctx, on: boolean): CanvasGradient {
  const g = ctx.createLinearGradient(4, 2, 20, 22);
  g.addColorStop(0, facetTone(1, on));
  g.addColorStop(0.45, facetTone(0.62, on));
  g.addColorStop(1, facetTone(0.08, on));
  return g;
}

/** A soft highlight on a small glyph's lit side. */
function highlight(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rotate: number, on: boolean): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = on ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.07)';
  ctx.fill();
  ctx.restore();
}

/** The star in the 24 × 24 box of `ctx`: facets, rim, lit edges, the specular spot and a sparkle — or, small, one smooth face and a highlight. */
export function drawStar(ctx: Ctx, on: boolean, detail: GemDetail = 'full'): void {
  ctx.lineJoin = 'round';
  if (detail === 'simple') {
    polygon(ctx, STAR_OUTLINE);
    ctx.fillStyle = smoothFace(ctx, on);
    ctx.fill();
    ctx.strokeStyle = on ? RIM_GOLD : RIM_OFF;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    highlight(ctx, 9.6, 7.6, 2.4, 3.6, -40, on);
    return;
  }
  for (const f of STAR_FACETS) {
    polygon(ctx, f.points);
    ctx.fillStyle = facetTone(f.brightness, on);
    ctx.fill();
  }
  polygon(ctx, STAR_OUTLINE);
  ctx.strokeStyle = on ? RIM_GOLD : RIM_OFF;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  edges(ctx, STAR_LIT_EDGES, on);
  if (!on) return;
  const s = STAR_SPECULAR;
  ctx.save();
  ctx.translate(s.cx, s.cy);
  ctx.rotate((s.rotate * Math.PI) / 180);
  ctx.beginPath();
  ctx.ellipse(0, 0, s.rx, s.ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(STAR_SPARKLE[0], STAR_SPARKLE[1], 0.7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
}

/** The crown in the 24 × 24 box of `ctx`: peaks cut like the star, a banded base, three pearls, the cyan gem — or, small, one smooth face with the seam, pearls and gem. */
export function drawCrown(ctx: Ctx, on: boolean, detail: GemDetail = 'full'): void {
  ctx.lineJoin = 'round';
  if (detail === 'simple') {
    polygon(ctx, CROWN_OUTLINE);
    ctx.fillStyle = smoothFace(ctx, on);
    ctx.fill();
  } else {
    for (const f of CROWN_FACETS) {
      polygon(ctx, f.points);
      ctx.fillStyle = facetTone(f.brightness, on);
      ctx.fill();
    }
    // The band: lit at its top edge, deep at the bottom.
    const band = ctx.createLinearGradient(0, CROWN_BAND_TOP, 0, 20.5);
    band.addColorStop(0, facetTone(0.8, on));
    band.addColorStop(0.5, facetTone(0.55, on));
    band.addColorStop(1, facetTone(0.1, on));
    ctx.fillStyle = band;
    ctx.fillRect(3, CROWN_BAND_TOP, 18, 20.5 - CROWN_BAND_TOP);
  }
  // The seam.
  ctx.strokeStyle = on ? 'rgba(122,58,0,0.55)' : 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(3, CROWN_BAND_TOP + 0.4);
  ctx.lineTo(21, CROWN_BAND_TOP + 0.4);
  ctx.stroke();
  polygon(ctx, CROWN_OUTLINE);
  ctx.strokeStyle = on ? RIM_GOLD : RIM_OFF;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  if (detail === 'full') {
    edges(ctx, CROWN_LIT_EDGES, on);
    ctx.strokeStyle = on ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(3.6, CROWN_BAND_TOP + 1.2);
    ctx.lineTo(20.4, CROWN_BAND_TOP + 1.2);
    ctx.stroke();
  }
  for (const p of CROWN_PEARLS) {
    const g = ctx.createRadialGradient(p.cx - p.r * 0.35, p.cy - p.r * 0.4, p.r * 0.1, p.cx, p.cy, p.r);
    g.addColorStop(0, on ? '#ffffff' : '#5a5e70');
    g.addColorStop(0.7, on ? '#d9dcea' : '#30333f');
    g.addColorStop(1, on ? '#8a8fa3' : '#1c1e26');
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = on ? RIM_GOLD : RIM_OFF;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  const gem = CROWN_GEM;
  const gg = ctx.createRadialGradient(gem.cx - 0.6, gem.cy - 0.7, 0.2, gem.cx, gem.cy, gem.r);
  gg.addColorStop(0, on ? '#d8fbff' : '#3a3d4c');
  gg.addColorStop(0.55, on ? '#00f0ff' : '#23252f');
  gg.addColorStop(1, on ? '#0090a8' : '#15161d');
  ctx.beginPath();
  ctx.arc(gem.cx, gem.cy, gem.r, 0, Math.PI * 2);
  ctx.fillStyle = gg;
  ctx.fill();
  ctx.strokeStyle = on ? RIM_GOLD : RIM_OFF;
  ctx.lineWidth = 0.7;
  ctx.stroke();
}
