import { OFFSET_RANGE_MS } from '@/shared/config/constants';
import { sanitizeAvatar } from '@/shared/config/avatars';
import { clamp } from '@/shared/lib/math';
import { createStore, useStore } from '@/shared/lib/store/createStore';

export type VoiceSetting = 'dmitry' | 'svetlana' | 'off';
/** "Economy mode": auto = switch to the low FX level when FPS drops below 45 for 3 s; on = always low; off = always full. */
export type FxMode = 'auto' | 'on' | 'off';

export interface Settings {
  version: 1;
  /** Calibrated audio offset in milliseconds (positive = audio arrives late). */
  audioOffsetMs: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  voice: VoiceSetting;
  calibrated: boolean;
  /** Bumped when calibration must be redone (e.g. after the mobile-audio fix). */
  calibrationVersion: number;
  debugOverlay: boolean;
  /** The interactive tutorial was finished or skipped once (it opens itself on first launch). */
  tutorialDone: boolean;
  /** Name shown on the online leaderboard; '' = not asked yet. */
  nickname: string;
  /** The chosen avatar — an id from `shared/config/avatars`; '' = the first letter of the nickname. */
  avatar: string;
  fxMode: FxMode;
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
  voiceVolume: 0.9,
  voice: 'dmitry',
  calibrated: false,
  calibrationVersion: 0,
  debugOverlay: false,
  tutorialDone: false,
  nickname: '',
  avatar: '',
  fxMode: 'auto',
};

const VOICES: VoiceSetting[] = ['dmitry', 'svetlana', 'off'];
export const FX_MODES: FxMode[] = ['auto', 'on', 'off'];

/** Saved settings from their JSON: missing fields (older builds) take the defaults, bad values are sanitised, garbage is the defaults. */
export function settingsFromJson(raw: string | null): Settings {
  try {
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...DEFAULTS, ...parsed, version: 1 as const };
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
  return {
    ...s,
    audioOffsetMs: clamp(Math.round(s.audioOffsetMs), OFFSET_RANGE_MS.min, OFFSET_RANGE_MS.max),
    musicVolume: clamp(s.musicVolume, 0, 1),
    sfxVolume: clamp(s.sfxVolume, 0, 1),
    voiceVolume: clamp(s.voiceVolume, 0, 1),
    voice: VOICES.includes(s.voice) ? s.voice : DEFAULTS.voice,
    tutorialDone: s.tutorialDone === true,
    nickname: typeof s.nickname === 'string' ? sanitizeNickname(s.nickname) : '',
    avatar: sanitizeAvatar(s.avatar),
    fxMode: FX_MODES.includes(s.fxMode) ? s.fxMode : DEFAULTS.fxMode,
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
  settingsStore.set((prev) => sanitize({ ...prev, ...patch }));
}

export function useSettings<R>(selector: (s: Settings) => R): R {
  return useStore(settingsStore, selector);
}

export function getSettings(): Settings {
  return settingsStore.get();
}
