/**
 * The weekly-drop schedule (`assets-src/drops.json`, docs/plans/economy-drops-mymusic.md §2): its
 * checks for `generate-charts` and the planner behind `npm run assets:drops`. A weekly track is an
 * ordinary `tracks.json` entry with `"drop": true` (no `premium`, no `pack`); the schedule gives it
 * a Monday. The release clock is the app's own (`src/entities/track/model/drops.ts`).
 */
import { isMonday, releaseMs, slotDate } from '../../src/entities/track/model/drops';

export interface DropSlot {
  /** 1-based; week 1 is the `start` Monday. */
  week: number;
  /** The weekly track of that Monday, or null: the app shows «Новые треки — по понедельникам». */
  id: string | null;
}

export interface DropsFile {
  /** The first release Monday, `YYYY-MM-DD`. */
  start: string;
  slots: DropSlot[];
}

/** What the checks read from a `tracks.json` entry. */
export interface RegistryTrack {
  id: string;
  genre?: string;
  drop?: boolean;
  premium?: boolean;
  pack?: string;
}

/**
 * Everything wrong with a schedule against the registry (empty = fine): `start` is a Monday, the
 * weeks run 1…N, every id exists and is marked `drop`, no id is used twice, every drop track has a
 * week, and a drop track is neither premium nor in a pack.
 */
export function validateDrops(file: DropsFile, tracks: readonly RegistryTrack[]): string[] {
  const problems: string[] = [];
  if (!isMonday(file.start)) problems.push(`start "${file.start}" is not a Monday (YYYY-MM-DD)`);
  if (!Array.isArray(file.slots)) return [...problems, 'slots is not a list'];
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const used = new Set<string>();
  file.slots.forEach((slot, i) => {
    if (slot.week !== i + 1) problems.push(`slot ${i + 1}: week ${slot.week}, expected ${i + 1}`);
    if (slot.id === null) return;
    const t = byId.get(slot.id);
    if (!t) problems.push(`week ${slot.week}: "${slot.id}" is not in tracks.json`);
    else if (t.drop !== true) problems.push(`week ${slot.week}: "${slot.id}" is not marked "drop": true`);
    if (used.has(slot.id)) problems.push(`week ${slot.week}: "${slot.id}" is already scheduled`);
    used.add(slot.id);
  });
  for (const t of tracks) {
    if (t.drop !== true) continue;
    if (!used.has(t.id)) problems.push(`"${t.id}" is a drop without a week — run npm run assets:drops`);
    if (t.premium) problems.push(`"${t.id}": a drop is never premium`);
    if (t.pack) problems.push(`"${t.id}": a drop is never in a pack`);
  }
  return problems;
}

/** Each scheduled track's release date (the catalog's `release`). */
export function releaseDates(file: DropsFile): Map<string, string> {
  const out = new Map<string, string>();
  for (const slot of file.slots) if (slot.id) out.set(slot.id, slotDate(file.start, slot.week));
  return out;
}

/** The week has not opened yet at `nowMs` (its Monday 00:00 Moscow is still ahead). */
export function isFutureWeek(file: DropsFile, week: number, nowMs: number): boolean {
  return releaseMs(slotDate(file.start, week)) > nowMs;
}

export interface DropPlan {
  file: DropsFile;
  /** Tracks given a week by this plan. */
  placed: DropSlot[];
  /** Drop tracks still without a week (no empty future week left). */
  unplaced: string[];
}

/**
 * Put every drop track without a week into the empty future weeks, in `tracks.json` order. Weeks
 * already open (and every filled week) stay as they are: a released track keeps its Monday.
 */
export function planDrops(file: DropsFile, tracks: readonly RegistryTrack[], nowMs: number): DropPlan {
  const scheduled = new Set(file.slots.map((s) => s.id).filter((id): id is string => id !== null));
  const waiting = tracks.filter((t) => t.drop === true && !scheduled.has(t.id)).map((t) => t.id);
  const placed: DropSlot[] = [];
  const slots = file.slots.map((slot) => {
    if (slot.id !== null || !isFutureWeek(file, slot.week, nowMs) || waiting.length === 0) return { ...slot };
    const filled = { week: slot.week, id: waiting.shift()! };
    placed.push(filled);
    return filled;
  });
  return { file: { start: file.start, slots }, placed, unplaced: waiting };
}

/** Weeks of music ahead: filled weeks in a row from the next one to open. */
export function weeksAhead(file: DropsFile, nowMs: number): number {
  let n = 0;
  for (const slot of file.slots) {
    if (!isFutureWeek(file, slot.week, nowMs)) continue;
    if (slot.id === null) break;
    n++;
  }
  return n;
}

/** The dry run's table: «week · date · id · ★ · genre», past weeks marked. */
export function planLines(file: DropsFile, nowMs: number, info: (id: string) => { stars?: number; genre?: string } | undefined): string[] {
  return file.slots.map((slot) => {
    const date = slotDate(file.start, slot.week);
    const past = isFutureWeek(file, slot.week, nowMs) ? '' : ' (out)';
    if (slot.id === null) return `${String(slot.week).padStart(2)} · ${date} · —${past}`;
    const t = info(slot.id);
    const stars = t?.stars !== undefined ? `★${t.stars}` : '★?';
    return `${String(slot.week).padStart(2)} · ${date} · ${slot.id} · ${stars} · ${t?.genre ?? '?'}${past}`;
  });
}

/** The file as it is kept in the repo: one slot per line. */
export function formatDropsFile(file: DropsFile): string {
  const slots = file.slots.map((s) => `    { "week": ${s.week}, "id": ${JSON.stringify(s.id)} }`).join(',\n');
  return `{\n  "start": ${JSON.stringify(file.start)},\n  "slots": [\n${slots}\n  ]\n}\n`;
}
