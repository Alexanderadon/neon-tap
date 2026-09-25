/**
 * npm run assets:drops [-- --dry]
 *
 * Gives every `"drop": true` track of assets-src/tracks.json that has no week yet the next empty
 * future week of assets-src/drops.json, in the registry's order; weeks already out are never
 * touched. Prints the schedule as «week · date · id · ★ · genre» and warns when fewer than three
 * weeks of music are queued. `--dry` prints the plan without writing the file.
 *
 * Then the usual pipeline: assets:fetch-music → assets:music → assets:charts → assets:licenses.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { now } from '../src/shared/lib/time';
import { formatDropsFile, planDrops, planLines, validateDrops, weeksAhead, type DropsFile, type RegistryTrack } from './lib/drops';

/** Fewer queued weeks than this and the run warns. */
const MIN_WEEKS_AHEAD = 3;

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DROPS = join(ROOT, 'assets-src', 'drops.json');
const CATALOG = join(ROOT, 'src', 'entities', 'track', 'model', 'catalog.json');
const DRY = process.argv.includes('--dry');

const tracks = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'tracks.json'), 'utf8')) as RegistryTrack[];
const file = JSON.parse(readFileSync(DROPS, 'utf8')) as DropsFile;
/** ★ comes from the built catalog: a track not charted yet shows «★?». */
const stars = new Map<string, number>(
  existsSync(CATALOG) ? (JSON.parse(readFileSync(CATALOG, 'utf8')) as { id: string; stars: number }[]).map((t) => [t.id, t.stars]) : [],
);

const nowMs = now();
const plan = planDrops(file, tracks, nowMs);
const info = (id: string) => ({ stars: stars.get(id), genre: tracks.find((t) => t.id === id)?.genre });
for (const line of planLines(plan.file, nowMs, info)) console.log(line);
for (const slot of plan.placed) console.log(`+ week ${slot.week}: ${slot.id}`);
if (plan.unplaced.length) console.warn(`no empty future week for: ${plan.unplaced.join(', ')} — add slots to drops.json`);

const ahead = weeksAhead(plan.file, nowMs);
if (ahead < MIN_WEEKS_AHEAD) console.warn(`music queued for ${ahead} week(s) ahead — fewer than ${MIN_WEEKS_AHEAD}: add "drop": true tracks to tracks.json`);

const problems = validateDrops(plan.file, tracks).filter((p) => !plan.unplaced.some((id) => p.startsWith(`"${id}" is a drop without a week`)));
if (problems.length) {
  console.error(`drops.json has problems:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

if (DRY) console.log(`--dry: ${plan.placed.length} track(s) would be scheduled, nothing written`);
else if (plan.placed.length === 0) console.log('drops.json: nothing to schedule');
else {
  writeFileSync(DROPS, formatDropsFile(plan.file));
  console.log(`drops.json: ${plan.placed.length} track(s) scheduled`);
}
