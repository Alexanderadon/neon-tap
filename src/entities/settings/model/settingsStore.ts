import { OFFSET_RANGE_MS, SCROLL_SPEED_RANGE } from '@/shared/config/constants';
import { clamp } from '@/shared/lib/math';
import { createStore, useStore } from '@/shared/lib/store/createStore';

export interface Settings {
  version: 1;
  /** Calibrated audio offset in milliseconds (positive = audio arrives late). */
  audioOffsetMs: number;
  scrollSpeed: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  calibrated: boolean;
  debugOverlay: boolean;
}

const KEY = 'neon-tap:settings';

const DEFAULTS: Settings = {
  version: 1,
  audioOffsetMs: 0,
  scrollSpeed: 1.5,
  musicVolume: 0.9,
  sfxVolume: 0.7,
  voiceVolume: 1,
  calibrated: false,
  debugOverlay: false,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return sanitize({ ...DEFAULTS, ...parsed, version: 1 });
  } catch {
    return DEFAULTS;
  }
}

function sanitize(s: Settings): Settings {
  return {
    ...s,
    audioOffsetMs: clamp(Math.round(s.audioOffsetMs), OFFSET_RANGE_MS.min, OFFSET_RANGE_MS.max),
    scrollSpeed: clamp(s.scrollSpeed, SCROLL_SPEED_RANGE.min, SCROLL_SPEED_RANGE.max),
    musicVolume: clamp(s.musicVolume, 0, 1),
    sfxVolume: clamp(s.sfxVolume, 0, 1),
    voiceVolume: clamp(s.voiceVolume, 0, 1),
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
