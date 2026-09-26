import { CALIBRATION_VERSION, OFFSET_RANGE_MS } from '@/shared/config/constants';
import { sanitizeAvatar } from '@/shared/config/avatars';
import { clamp } from '@/shared/lib/math';
import { createStore, useStore } from '@/shared/lib/store/createStore';

/** The announcer: the one shipped voice or none. */
export type VoiceSetting = 'svetlana' | 'off';
/** "Economy mode": auto = switch to the low FX level when FPS drops below 45 for 3 s; on = always low; off = always full. */
export type FxMode = 'auto' | 'on' | 'off';
/** Where "auto" starts: full, or low once the FPS watchdog has dropped it on this device (remembered, see `fxAuto`). */
export type FxAuto = 'full' | 'low';
/** Mechanics a normal run introduces with a card the first time the player meets them (the tutorial keeps to taps and holds). */
export const MEET_KINDS = ['slide', 'roll', 'circle', 'spin'] as const;
export type MeetKind = (typeof MEET_KINDS)[number];

export interface Settings {
  version: 1;
  /** Calibrated audio offset in milliseconds (positive = audio arrives late). */
  audioOffsetMs: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  voice: VoiceSetting;
  calibrated: boolean;
  /** The calibration version the saved offset was made with; an older one is dropped on load (see CALIBRATION_VERSION). */
  calibrationVersion: number;
  debugOverlay: boolean;
  /** The interactive tutorial was finished or skipped once (it opens itself on first launch). */
  tutorialDone: boolean;
  /** Name shown on the online leaderboard; '' = not asked yet. */
  nickname: string;
  /** The chosen avatar — an id from `shared/config/avatars`; '' = the first letter of the nickname. */
  avatar: string;
  fxMode: FxMode;
  /** "auto" economy mode starts low: the FPS watchdog dropped the FX level in an earlier run. Choosing a mode again resets it. */
  fxAuto: FxAuto;
  /** Mechanics already introduced by their first-meeting card (once per kind, ever). */
  seenKinds: MeetKind[];
  /** The wide latency probe settled once (tutorial or run): the offset is learned, runs only fine-tune it. */
  offsetLearned: boolean;
}

const KEY = 'neon-tap:settings';

export const NICKNAME_MAX = 16;

/** A name the online table accepts: anything non-empty once trimmed (the one rule, shared by the dialog and the settings). */
export function isValidNickname(name: string): boolean {
  return name.trim().length >= 1;
}

/** Trim, collapse whitespace, drop control characters and angle brackets, cap the length. */
export function sanitizeNickname(raw: string): string {
  return raw
    .replace(/[\p{Cc}<>]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NICKNAME_MAX);
}

const DEFAULTS: Settings = {
  version: 1,
  audioOffsetMs: 0,
  musicVolume: 0.9,
  sfxVolume: 0.7,
  voiceVolume: 0.6,
  voice: 'svetlana',
  calibrated: false,
  calibrationVersion: CALIBRATION_VERSION, // a fresh install has no stale offset to drop
  debugOverlay: false,
  tutorialDone: false,
  nickname: '',
  avatar: '',
  fxMode: 'auto',
  fxAuto: 'full',
  seenKinds: [],
  offsetLearned: false,
};

/** Anything else — the retired 'dmitry' included — is sanitised to the default voice. */
const VOICES: VoiceSetting[] = ['svetlana', 'off'];
export const FX_MODES: FxMode[] = ['auto', 'on', 'off'];

/** Known kinds only, each once, in MEET_KINDS order. */
function sanitizeKinds(raw: unknown): MeetKind[] {
  const list: readonly unknown[] = Array.isArray(raw) ? raw : [];
  return MEET_KINDS.filter((k) => list.includes(k));
}

/** Saved settings from their JSON: missing fields (older builds) take the defaults, bad values are sanitised, garbage is the defaults. */
export function settingsFromJson(raw: string | null): Settings {
  try {
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...DEFAULTS, ...parsed, version: 1 as const };
    // A save from before the first-meeting cards: the old tutorial showed slides, rolls, circles and the spinner.
    if (!('seenKinds' in parsed) && parsed.tutorialDone === true) merged.seenKinds = [...MEET_KINDS];
    return sanitize(merged);
  } catch {
    return DEFAULTS;
  }
}

function load(): Settings {
  try {
    return settingsFromJson(localStorage.getItem(KEY));
  } catch {
    return DEFAULTS;
  }
}

function sanitize(s: Settings): Settings {
  // An offset from an older calibration double-counts the device latency: drop it, the auto-offset re-learns it in a run.
  const stale = s.calibrationVersion < CALIBRATION_VERSION;
  return {
    ...s,
    audioOffsetMs: stale ? 0 : clamp(Math.round(s.audioOffsetMs), OFFSET_RANGE_MS.min, OFFSET_RANGE_MS.max),
    calibrationVersion: stale ? CALIBRATION_VERSION : s.calibrationVersion,
    musicVolume: clamp(s.musicVolume, 0, 1),
    sfxVolume: clamp(s.sfxVolume, 0, 1),
    voiceVolume: clamp(s.voiceVolume, 0, 1),
    voice: VOICES.includes(s.voice) ? s.voice : DEFAULTS.voice,
    tutorialDone: s.tutorialDone === true,
    nickname: typeof s.nickname === 'string' ? sanitizeNickname(s.nickname) : '',
    avatar: sanitizeAvatar(s.avatar),
    fxMode: FX_MODES.includes(s.fxMode) ? s.fxMode : DEFAULTS.fxMode,
    fxAuto: s.fxAuto === 'low' ? 'low' : 'full',
    seenKinds: sanitizeKinds(s.seenKinds),
    offsetLearned: s.offsetLearned === true,
  };
}

export const settingsStore = createStore<Settings>(typeof localStorage === 'undefined' ? DEFAULTS : load());

settingsStore.subscribe(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(settingsStore.get()));
  } catch {
    /* private mode */
  }
});

export function updateSettings(patch: Partial<Omit<Settings, 'version'>>): void {
  // Choosing an economy mode again is the way back from a remembered drop: "auto" measures afresh.
  const fx = patch.fxMode !== undefined && patch.fxAuto === undefined ? { fxAuto: 'full' as const } : null;
  settingsStore.set((prev) => sanitize({ ...prev, ...patch, ...fx }));
}

export function useSettings<R>(selector: (s: Settings) => R): R {
  return useStore(settingsStore, selector);
}

export function getSettings(): Settings {
  return settingsStore.get();
}
