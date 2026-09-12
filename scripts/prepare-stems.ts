/**
 * D:\neon-tap-tools\stems\<id>\{lead,backing}.mp3 (made by tools/demucs/separate.py, Demucs on CPU)
 * → public/stems/<id>/{lead,backing}.mp3 for every registry track that has them.
 *
 * A track with stems plays as two synchronised layers: the backing always, the lead (vocal or the
 * melodic layer) only while the player hits — the Magic Tiles feel. generate-charts marks such
 * tracks (`audio` = backing, `lead` = lead). Tracks without stems keep the single mix.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = process.env.STEMS_DIR ?? 'D:\\neon-tap-tools\\stems';
const OUT = join(ROOT, 'public', 'stems');

const tracks = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'tracks.json'), 'utf8')) as { id: string }[];
let n = 0;
for (const t of tracks) {
  const lead = join(SRC, t.id, 'lead.mp3');
  const backing = join(SRC, t.id, 'backing.mp3');
  if (!existsSync(lead) || !existsSync(backing)) continue;
  mkdirSync(join(OUT, t.id), { recursive: true });
  copyFileSync(lead, join(OUT, t.id, 'lead.mp3'));
  copyFileSync(backing, join(OUT, t.id, 'backing.mp3'));
  const kind = existsSync(join(SRC, t.id, 'lead.txt')) ? readFileSync(join(SRC, t.id, 'lead.txt'), 'utf8').trim() : '?';
  console.log(`${t.id.padEnd(28)} lead = ${kind}`);
  n++;
}
console.log(`stems: ${n} of ${tracks.length} tracks`);
