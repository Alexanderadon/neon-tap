/**
 * Per-track visual themes. A theme is a palette (lane colours, background gradient, HUD accent,
 * glow colour) plus an ambient "motif" drawn behind the field. Themes are keyed by genre; a track
 * without a known genre gets a deterministic theme from a hash of its id, so the same song always
 * looks the same. The first theme (synthwave) is the game's original look.
 */
export type Motif = 'grid' | 'rings' | 'bars' | 'haze';

/** Five lane colours (the track-card swatch shows exactly five); a theme may add a sixth for 6-lane sections. */
export type LanePalette = readonly [string, string, string, string, string, ...string[]];

/** Number of colours a theme must define / the swatch shows. */
export const PALETTE_SIZE = 5;

export interface Theme {
  id: string;
  name: string;
  /** Background gradient: [top, bottom]. */
  bg: readonly [string, string];
  /** One colour per lane (lane index wraps for wider fields). */
  laneColors: LanePalette;
  /** Primary HUD accent (progress bar, verse pulse, lane-change text). */
  accent: string;
  /** Secondary glow (chorus pulse, haze blobs, 5+ lane text). */
  glow: string;
  motif: Motif;
}

/** The original NEON TAP look: cyan / magenta / lime / orange / violet (+ yellow for lane 6) on near-black. */
export const SYNTHWAVE: Theme = {
  id: 'synthwave',
  name: 'Synthwave',
  bg: ['#05060a', '#05060a'],
  laneColors: ['#00f0ff', '#ff2bd6', '#b6ff00', '#ff8a00', '#b56bff', '#ffe600'],
  accent: '#00f0ff',
  glow: '#ff2bd6',
  motif: 'grid',
};

export const THEMES: readonly Theme[] = [
  SYNTHWAVE,
  {
    id: 'chiptune',
    name: 'Chiptune',
    bg: ['#060612', '#0b0a2a'],
    laneColors: ['#3cff5a', '#ffe600', '#ff4d6d', '#4dc9ff', '#ff9f1c'],
    accent: '#3cff5a',
    glow: '#ffe600',
    motif: 'bars',
  },
  {
    id: 'lofi',
    name: 'Lo-fi',
    bg: ['#120a14', '#1d0f22'],
    laneColors: ['#ffb86b', '#ff7eb6', '#c9a7ff', '#7fe0d0', '#f5e663'],
    accent: '#ffb86b',
    glow: '#ff7eb6',
    motif: 'haze',
  },
  {
    id: 'rock',
    name: 'Rock',
    bg: ['#0a0505', '#1a0808'],
    laneColors: ['#ff3b3b', '#ffb400', '#ffffff', '#ff6a00', '#ff2bd6'],
    accent: '#ff3b3b',
    glow: '#ffb400',
    motif: 'bars',
  },
  {
    id: 'orchestral',
    name: 'Orchestral',
    bg: ['#05060f', '#0e1330'],
    laneColors: ['#ffd700', '#c0c8ff', '#ff9ec4', '#7cc7ff', '#e6e6fa'],
    accent: '#ffd700',
    glow: '#7cc7ff',
    motif: 'rings',
  },
  {
    id: 'jazz',
    name: 'Jazz',
    bg: ['#0a0710', '#1b0e1f'],
    laneColors: ['#ffc46b', '#ff5c8a', '#8be9fd', '#bd93f9', '#50fa7b'],
    accent: '#ffc46b',
    glow: '#bd93f9',
    motif: 'haze',
  },
  {
    id: 'techno',
    name: 'Techno / DnB',
    bg: ['#020408', '#04101c'],
    laneColors: ['#00ffa3', '#00c2ff', '#ffffff', '#ff2bd6', '#7cff00'],
    accent: '#00ffa3',
    glow: '#00c2ff',
    motif: 'grid',
  },
  {
    id: 'ambient',
    name: 'Ambient / Acoustic',
    bg: ['#04100e', '#08201c'],
    laneColors: ['#7fffd4', '#a8e6cf', '#ffd3b6', '#dcedc1', '#ffaaa5'],
    accent: '#7fffd4',
    glow: '#ffd3b6',
    motif: 'rings',
  },
];

export const DEFAULT_THEME: Theme = SYNTHWAVE;

/** Genre spellings / neighbours → theme id. Keys are normalised (lower-case, letters and digits only). */
const GENRE_ALIASES: Record<string, string> = {
  synthwave: 'synthwave',
  retrowave: 'synthwave',
  outrun: 'synthwave',
  synth: 'synthwave',
  synthpop: 'synthwave',
  electronic: 'synthwave',
  electro: 'synthwave',
  edm: 'synthwave',
  house: 'synthwave',
  dance: 'synthwave',
  pop: 'synthwave',
  chiptune: 'chiptune',
  chip: 'chiptune',
  '8bit': 'chiptune',
  bitpop: 'chiptune',
  retro: 'chiptune',
  lofi: 'lofi',
  hiphop: 'lofi',
  trap: 'lofi',
  chillhop: 'lofi',
  rock: 'rock',
  metal: 'rock',
  punk: 'rock',
  hardrock: 'rock',
  orchestral: 'orchestral',
  orchestra: 'orchestral',
  classical: 'orchestral',
  cinematic: 'orchestral',
  epic: 'orchestral',
  jazz: 'jazz',
  funk: 'jazz',
  soul: 'jazz',
  blues: 'jazz',
  swing: 'jazz',
  techno: 'techno',
  dnb: 'techno',
  drumandbass: 'techno',
  drumnbass: 'techno',
  drumbass: 'techno',
  jungle: 'techno',
  hardstyle: 'techno',
  trance: 'techno',
  industrial: 'techno',
  breakbeat: 'techno',
  hardcore: 'techno',
  eurobeat: 'synthwave',
  eurodance: 'synthwave',
  ambient: 'ambient',
  acoustic: 'ambient',
  folk: 'ambient',
  chill: 'ambient',
  chillout: 'ambient',
  piano: 'ambient',
};

function normaliseGenre(genre: string): string {
  return genre.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** FNV-1a 32-bit hash — small, deterministic, dependency-free. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** True for white / near-white hex colours (every channel ≥ 0xd0) — those would hide against the PERFECT popup. */
export function isNearWhite(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const v = parseInt(m[1], 16);
  return v >> 16 >= 0xd0 && ((v >> 8) & 0xff) >= 0xd0 && (v & 0xff) >= 0xd0;
}

/** Index of the lane colour to prefer for the GOOD judgement (lime in the original synthwave look). */
const GOOD_LANE = 2;

/**
 * Colour for the GOOD judgement popup: lane colour `GOOD_LANE` unless it is (near) white — PERFECT
 * is drawn white, and the two must stay distinguishable — then the next non-white lane colour,
 * and the theme accent as a last resort.
 */
export function goodJudgementColor(theme: Theme): string {
  const n = theme.laneColors.length;
  for (let k = 0; k < n; k++) {
    const c = theme.laneColors[(GOOD_LANE + k) % n];
    if (!isNearWhite(c)) return c;
  }
  return theme.accent;
}

export function themeById(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

/** Theme for a genre string (any of the aliases above), or `undefined` when the genre is unknown / missing. */
export function themeForGenre(genre: string | undefined | null): Theme | undefined {
  if (!genre) return undefined;
  const key = normaliseGenre(genre);
  const direct = GENRE_ALIASES[key];
  if (direct) return themeById(direct);
  // "drum & bass / techno" style compound tags: the first alias found wins.
  for (const alias of Object.keys(GENRE_ALIASES)) if (alias.length >= 3 && key.includes(alias)) return themeById(GENRE_ALIASES[alias]);
  return undefined;
}

/**
 * Theme for a track: by genre when known, otherwise a deterministic pick from the id hash.
 * Always returns a theme (never throws), so callers can spread it straight into a Renderer.
 */
export function themeFor(genre: string | undefined | null, id: string): Theme {
  return themeForGenre(genre) ?? THEMES[hashId(id) % THEMES.length];
}

/** Genres whose songs are calm: a warm poster glows as lo-fi rather than burning as rock, a blue one ices over. */
const CALM_GENRES = new Set(['lofi', 'ambient', 'jazz', 'acoustic', 'orchestral']);
/** A poster whose accent is paler than this has no colour identity to speak of: the genre theme decides. */
const MOOD_MIN_SATURATION = 0.5;

/**
 * The theme for a track with a picture: chosen by the poster's MOOD — the hue family of its accent
 * (`tint`) — from the hand-designed themes above, so the level keeps a designed neon look that
 * matches the poster instead of colours sampled off it. Warm posters (red, orange) burn as rock —
 * or glow as lo-fi / jazz when the genre is calm; gold → orchestral; green → chiptune; teal →
 * ambient; blue → techno, or orchestral's ice when calm; pink, magenta and violet → synthwave.
 * Chiptune keeps its pixel bars whatever the poster; a pale accent leaves the genre theme in charge.
 */
export function themeForMood(tint: string, genre: string | undefined | null, id: string): Theme {
  const n = parseInt(tint.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const key = normaliseGenre(genre ?? '');
  if (sat < MOOD_MIN_SATURATION || key.includes('chip') || key.includes('8bit')) return themeFor(genre, id);
  let hue = 0;
  if (max === r) hue = ((g - b) / d + 6) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue *= 60;
  const calm = CALM_GENRES.has(key);
  const pick = (themeId: string): Theme => themeById(themeId) ?? SYNTHWAVE;
  if (hue < 45 || hue >= 345) return pick(key === 'jazz' ? 'jazz' : calm ? 'lofi' : 'rock');
  if (hue < 55) return pick('orchestral');
  if (hue < 165) return pick('chiptune');
  if (hue < 195) return pick('ambient');
  if (hue < 262) return pick(calm ? 'orchestral' : 'techno');
  return pick('synthwave');
}
