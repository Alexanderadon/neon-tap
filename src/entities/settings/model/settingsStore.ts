import { OFFSET_RANGE_MS } from '@/shared/config/constants';
import { clamp } from '@/shared/lib/math';
import { createStore, useStore } from '@/shared/lib/store/createStore';

export type VoiceSetting = 'dmitry' | 'svetlana' | 'off';

export interface Settings {
  version: 1;
  /** Calibrated audio offset in milliseconds (positive = audio arrives late). */
  audioOffsetMs: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  voice: VoiceSetting;
  /** Touch devices: early presses (≤ 0.4 s) count as Great. */
  touchAssist: boolean;
  /** Learn latency from the player's hits during play and persist it after a run. */
  autoOffset: boolean;
  calibrated: boolean;
  /** Bumped when calibration must be redone (e.g. after the mobile-audio fix). */
  calibrationVersion: number;
  debugOverlay: boolean;
  /** The interactive tutorial was finished or skipped once (it opens itself after first calibration). */
  tutorialDone: boolean;
}

const KEY = 'neon-tap:settings';

const DEFAULTS: Settings = {
  version: 1,
  audioOffsetMs: 0,
  musicVolume: 0.9,
  sfxVolume: 0.7,
  voiceVolume: 0.9,
  voice: 'dmitry',
  touchAssist: true,
  autoOffset: true,
  calibrated: false,
  calibrationVersion: 0,
  debugOverlay: false,
  tutorialDone: false,
};

const VOICES: VoiceSetting[] = ['dmitry', 'svetlana', 'off'];

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...DEFAULTS, ...parsed, version: 1 as const };
    return sanitize(merged);
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
