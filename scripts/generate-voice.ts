/**
 * Russian voice lines with neural TTS (Microsoft Edge "Read Aloud" voices via `msedge-tts`).
 *   assets-src/voice-raw/<voice>/<id>.mp3  (raw TTS output, gitignored, cached — pass --force to regenerate)
 *   public/voice/<voice>/<id>.mp3          (silence-trimmed, loudness-normalised)
 * Two voices are shipped so the player can pick one in settings.
 */
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { ffmpeg } from './ffmpeg';

export const VOICES = {
  dmitry: 'ru-RU-DmitryNeural',
  svetlana: 'ru-RU-SvetlanaNeural',
} as const;

/** Must match `VoiceLine` in src/features/voice-feedback/model/Voice.ts. */
export const LINES: Record<string, string> = {
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

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RAW = join(ROOT, 'assets-src', 'voice-raw');
const OUT = join(ROOT, 'public', 'voice');
const force = process.argv.includes('--force');

async function synth(voiceId: string, dir: string, id: string, text: string): Promise<string> {
  const target = join(dir, `${id}.mp3`);
  if (existsSync(target) && !force) return target;
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const tmp = join(dir, `_${id}`);
  mkdirSync(tmp, { recursive: true });
  const { audioFilePath } = await tts.toFile(tmp, text, { rate: 1.12, pitch: '+4Hz' });
  renameSync(audioFilePath, target);
  rmSync(tmp, { recursive: true, force: true });
  return target;
}

for (const [key, voiceId] of Object.entries(VOICES)) {
  const rawDir = join(RAW, key);
  const outDir = join(OUT, key);
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  for (const [id, text] of Object.entries(LINES)) {
    const raw = await synth(voiceId, rawDir, id, text);
    ffmpeg([
      '-i',
      raw,
      '-af',
      'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.05,loudnorm=I=-15:TP=-1.5',
      '-ac',
      '1',
      '-ar',
      '24000',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '64k',
      join(outDir, `${id}.mp3`),
    ]);
    console.log(`${key}/${id}: ${text}`);
  }
}
