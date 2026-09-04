import { audioEngine } from '@/shared/lib/audio';

export type VoiceLine =
  | 'otlichno'
  | 'molodec'
  | 'tak-derzhat'
  | 'idealno'
  | 'ne-sdavaysya'
  | 'ogon'
  | 'combo-50'
  | 'combo-100'
  | 'combo-250'
  | 'combo-500'
  | 'full-combo'
  | 'poehali'
  | 'new-record'
  | 'rank-s'
  | 'mimo'
  | 'eshche-razok';

/** Shipped neural voices (see scripts/generate-voice.ts); `off` disables the announcer. */
export type VoiceId = 'dmitry' | 'svetlana' | 'off';

/** Text fallback for the Web Speech API when a clip fails to load. */
const TEXT: Record<VoiceLine, string> = {
  otlichno: 'Отлично!',
  molodec: 'Молодец!',
  'tak-derzhat': 'Так держать!',
  idealno: 'Идеально!',
  'ne-sdavaysya': 'Не сдавайся!',
  ogon: 'Огонь!',
  'combo-50': 'Комбо пятьдесят!',
  'combo-100': 'Комбо сто!',
  'combo-250': 'Комбо двести пятьдесят!',
  'combo-500': 'Комбо пятьсот!',
  'full-combo': 'Полное комбо!',
  poehali: 'Поехали!',
  'new-record': 'Новый рекорд!',
  'rank-s': 'Ранг эс!',
  mimo: 'Мимо!',
  'eshche-razok': 'Ещё разок?',
};

const MIN_GAP_MS = 2500;

/**
 * Russian announcer. Pre-decoded MP3 clips play through the voice bus with zero latency;
 * `speechSynthesis` is the fallback. Lines are rate-limited so they never talk over each other.
 */
class Voice {
  private buffers = new Map<VoiceLine, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private loadedVoice: VoiceId | null = null;
  private current: VoiceId = 'dmitry';
  private lastAt = 0;
  private failed = false;

  /** Select which voice to use; triggers a (re)load when it changes. */
  setVoice(id: VoiceId): void {
    this.current = id;
    if (id !== 'off' && this.loadedVoice !== id) void this.preload();
  }

  get voice(): VoiceId {
    return this.current;
  }

  preload(): Promise<void> {
    if (this.current === 'off') return Promise.resolve();
    if (this.loading && this.loadedVoice === this.current) return this.loading;
    const id = this.current;
    this.loadedVoice = id;
    this.failed = false;
    const next = new Map<VoiceLine, AudioBuffer>();
    this.loading = (async () => {
      const base = `${import.meta.env.BASE_URL}voice/${id}/`;
      await Promise.all(
        (Object.keys(TEXT) as VoiceLine[]).map(async (line) => {
          try {
            next.set(line, await audioEngine.loadUrl(`${base}${line}.mp3`));
          } catch {
            this.failed = true;
          }
        }),
      );
      if (this.loadedVoice === id) this.buffers = next;
    })();
    return this.loading;
  }

  /** `priority` lines (milestones, results) bypass the rate limit. */
  say(line: VoiceLine, priority = false): void {
    if (this.current === 'off') return;
    const now = performance.now();
    if (!priority && now - this.lastAt < MIN_GAP_MS) return;
    this.lastAt = now;
    const buf = this.buffers.get(line);
    if (buf) {
      audioEngine.playOneShot(buf);
      return;
    }
    if (this.failed || !this.loading) this.speak(TEXT[line]);
  }

  private speak(text: string): void {
    if (typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      u.rate = 1.1;
      speechSynthesis.speak(u);
    } catch {
      /* unsupported */
    }
  }
}

export const voice = new Voice();

const RANDOM_PRAISE: VoiceLine[] = ['otlichno', 'molodec', 'tak-derzhat', 'ogon'];

export function praise(): VoiceLine {
  return RANDOM_PRAISE[Math.floor(Math.random() * RANDOM_PRAISE.length)];
}
