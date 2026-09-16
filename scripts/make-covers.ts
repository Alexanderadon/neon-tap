/**
 * Picture covers: assets-src/covers-raw/<track id>.(png|jpg|jpeg|webp) → public/covers/<id>.webp
 * (the deck card's 730 × 1050 with the picture's blurred margins, tools/covers/make-cover.py) and the
 * `cover` field in catalog.json, so the app shows the picture instead of the procedural art.
 * Only missing or older outputs are rendered; `--force` redoes all. `generate-charts` keeps the
 * field on its own (it looks in public/covers), so either script leaves the catalog right.
 *
 *   npm run assets:covers
 *   npm run assets:covers -- --force
 * Needs Pillow: COVERS_PY (default D:/neon-tap-tools/demucs-venv/Scripts/python.exe).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RAW_DIR = join(ROOT, 'assets-src', 'covers-raw');
const OUT_DIR = join(ROOT, 'public', 'covers');
const CATALOG = join(ROOT, 'src', 'entities', 'track', 'model', 'catalog.json');
const PY = process.env.COVERS_PY ?? 'D:/neon-tap-tools/demucs-venv/Scripts/python.exe';
const force = process.argv.includes('--force');

mkdirSync(OUT_DIR, { recursive: true });
const raws = existsSync(RAW_DIR) ? readdirSync(RAW_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)) : [];
for (const raw of raws) {
  const id = raw.replace(/\.[^.]+$/, '');
  const src = join(RAW_DIR, raw);
  const out = join(OUT_DIR, `${id}.webp`);
  if (!force && existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) continue;
  const r = spawnSync(PY, [join(ROOT, 'tools', 'covers', 'make-cover.py'), src, id, '--out', OUT_DIR], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`make-cover.py failed for ${id}`);
}

// The catalog says which tracks have a picture — exactly the files in public/covers.
const catalog = JSON.parse(readFileSync(CATALOG, 'utf8')) as Record<string, unknown>[];
let changed = 0;
for (const t of catalog) {
  const id = t.id as string;
  const cover = existsSync(join(OUT_DIR, `${id}.webp`)) ? `covers/${id}.webp` : undefined;
  if (cover === t.cover) continue;
  changed++;
  // Keep the field's place next to `pack`/`premium`, before the numbers.
  const entries = Object.entries(t).filter(([k]) => k !== 'cover');
  const at = entries.findIndex(([k]) => k === 'bpm');
  if (cover) entries.splice(at < 0 ? entries.length : at, 0, ['cover', cover]);
  for (const k of Object.keys(t)) delete t[k];
  Object.assign(t, Object.fromEntries(entries));
}
if (changed) writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
console.log(`covers: ${raws.length} pictures, catalog entries changed: ${changed}`);
