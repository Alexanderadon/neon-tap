import { createStore, useStore } from '@/shared/lib/store/createStore';
import { audioEngine } from './AudioEngine';

interface AudioUnlockState {
  /** True while the AudioContext is actually running (not suspended / interrupted). */
  unlocked: boolean;
}

export const audioUnlockStore = createStore<AudioUnlockState>({ unlocked: false });

let silentElement: HTMLAudioElement | null = null;
let stateHooked = false;

/** A 0.1 s silent 8-bit mono WAV as a data URI (built in code — no asset needed). */
function silentWavUri(): string {
  const sampleRate = 8000;
  const samples = Math.round(sampleRate * 0.1);
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[off + i] = s.charCodeAt(i);
  };
  str(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  str(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit silence = 128
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

/**
 * Unlock audio on mobile. MUST be called synchronously from a user gesture (click / touchend / keydown):
 *  1. creates + resumes the AudioContext inside the gesture (Chrome/Android autoplay policy),
 *  2. plays a one-sample buffer (the classic iOS Safari unlock),
 *  3. plays a looping silent <audio> element, which flips the iOS audio session to "playback"
 *     so Web Audio is heard even with the ring/silent switch on (the "unmute" trick).
 */
export async function unlockAudio(): Promise<boolean> {
  const ctx = await audioEngine.ensureContext();
  try {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
  try {
    if (!silentElement) {
      silentElement = document.createElement('audio');
      silentElement.setAttribute('playsinline', '');
      silentElement.setAttribute('x-webkit-airplay', 'deny');
      silentElement.preload = 'auto';
      silentElement.loop = true;
      silentElement.volume = 0.01;
      silentElement.src = silentWavUri();
    }
    void silentElement.play().catch(() => undefined);
  } catch {
    /* ignore */
  }
  if (ctx.state !== 'running') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  if (!stateHooked) {
    stateHooked = true;
    ctx.addEventListener('statechange', syncAudioUnlockState);
    // iOS Safari does not always fire statechange for the non-standard "interrupted" state (phone
    // call, Siri, switching apps): re-check whenever the page comes back so the gate can reappear.
    document.addEventListener('visibilitychange', syncAudioUnlockState);
    window.addEventListener('pageshow', syncAudioUnlockState);
    window.addEventListener('focus', syncAudioUnlockState);
  }
  const ok = ctx.state === 'running';
  audioUnlockStore.set({ unlocked: ok });
  return ok;
}

/** Mirror the real AudioContext state into the store (gate shows whenever it is not running). */
export function syncAudioUnlockState(): void {
  const ctx = audioEngine.context;
  audioUnlockStore.set({ unlocked: ctx !== null && ctx.state === 'running' });
}

export function useAudioUnlocked(): boolean {
  return useStore(audioUnlockStore, (s) => s.unlocked);
}
