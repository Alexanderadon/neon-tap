import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  appSchedule,
  formatAppSchedule,
  formatDropsFile,
  planDrops,
  planLines,
  releaseDates,
  validateDrops,
  weeksAhead,
  type DropsFile,
  type RegistryTrack,
} from './drops';

const START = '2026-10-05';
const monday = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) - 3 * 3_600_000;
const empty = (weeks = 13): DropsFile => ({ start: START, slots: Array.from({ length: weeks }, (_, i) => ({ week: i + 1, id: null })) });
const tracks: RegistryTrack[] = [
  { id: 'road', genre: 'rock' },
  { id: 'a', genre: 'rock', drop: true },
  { id: 'b', genre: 'jazz', drop: true },
  { id: 'c', genre: 'lofi', drop: true },
];

describe('validateDrops', () => {
  it('accepts the shipped schedule: Monday 5 October 2026, 13 empty weeks', () => {
    const file = JSON.parse(readFileSync(new URL('../../assets-src/drops.json', import.meta.url), 'utf8')) as DropsFile;
    const registry = JSON.parse(readFileSync(new URL('../../assets-src/tracks.json', import.meta.url), 'utf8')) as RegistryTrack[];
    expect(validateDrops(file, registry)).toEqual([]);
    expect(file.start).toBe(START);
    expect(file.slots).toHaveLength(13);
    expect(file.slots.every((s) => s.id === null)).toBe(true);
  });

  it('wants a Monday start and weeks numbered 1…N', () => {
    expect(validateDrops({ ...empty(2), start: '2026-10-06' }, [])).toEqual(['start "2026-10-06" is not a Monday (YYYY-MM-DD)']);
    expect(validateDrops({ start: START, slots: [{ week: 2, id: null }] }, [])).toEqual(['slot 1: week 2, expected 1']);
  });

  it('checks the ids: known, marked drop, used once; every drop has a week', () => {
    const file = empty(4);
    file.slots[0].id = 'a';
    file.slots[1].id = 'a';
    file.slots[2].id = 'road';
    file.slots[3].id = 'ghost';
    expect(validateDrops(file, tracks)).toEqual([
      'week 2: "a" is already scheduled',
      'week 3: "road" is not marked "drop": true',
      'week 4: "ghost" is not in tracks.json',
      '"b" is a drop without a week — run npm run assets:drops',
      '"c" is a drop without a week — run npm run assets:drops',
    ]);
  });

  it('refuses a premium or pack drop', () => {
    const file = empty(1);
    file.slots[0].id = 'x';
    expect(validateDrops(file, [{ id: 'x', drop: true, premium: true, pack: 'rock' }])).toEqual([
      '"x": a drop is never premium',
      '"x": a drop is never in a pack',
    ]);
  });

  it('dates the scheduled tracks for the catalog', () => {
    const file = empty(3);
    file.slots[2].id = 'c';
    expect([...releaseDates(file)]).toEqual([['c', '2026-10-19']]);
  });
});

describe('planDrops', () => {
  it('fills the empty future weeks in tracks.json order', () => {
    const plan = planDrops(empty(), tracks, monday(START) - 1);
    expect(plan.placed).toEqual([
      { week: 1, id: 'a' },
      { week: 2, id: 'b' },
      { week: 3, id: 'c' },
    ]);
    expect(plan.unplaced).toEqual([]);
    expect(validateDrops(plan.file, tracks)).toEqual([]);
  });

  it('never touches a week already out, filled or not, and keeps scheduled tracks where they are', () => {
    const file = empty(5);
    file.slots[3].id = 'b';
    // Week 2 is running: weeks 1 and 2 are out.
    const plan = planDrops(file, tracks, monday('2026-10-12') + 1);
    expect(plan.file.slots.map((s) => s.id)).toEqual([null, null, 'a', 'b', 'c']);
    expect(plan.placed.map((s) => s.week)).toEqual([3, 5]);
    // The release instant itself counts as out.
    expect(planDrops(empty(2), tracks, monday('2026-10-12')).file.slots.map((s) => s.id)).toEqual([null, null]);
  });

  it('reports the tracks with no week left', () => {
    const plan = planDrops(empty(2), tracks, 0);
    expect(plan.file.slots.map((s) => s.id)).toEqual(['a', 'b']);
    expect(plan.unplaced).toEqual(['c']);
  });

  it('counts the music ahead: filled weeks in a row from the next one', () => {
    const file = empty(6);
    file.slots[0].id = 'x';
    file.slots[2].id = 'a';
    file.slots[3].id = 'b';
    file.slots[5].id = 'c';
    expect(weeksAhead(file, monday('2026-10-05') + 1)).toBe(0); // week 2 is next and empty
    expect(weeksAhead(file, monday('2026-10-12') + 1)).toBe(2); // weeks 3 and 4
    expect(weeksAhead(file, monday('2026-11-09') + 1)).toBe(0); // past the schedule
  });
});

describe('the dry run and the file format', () => {
  it('prints week · date · id · ★ · genre', () => {
    const file = empty(3);
    file.slots[0].id = 'a';
    file.slots[1].id = 'b';
    const info = (id: string) => (id === 'a' ? { stars: 4, genre: 'rock' } : { genre: 'jazz' });
    expect(planLines(file, monday('2026-10-05') + 1, info)).toEqual([
      ' 1 · 2026-10-05 · a · ★4 · rock (out)',
      ' 2 · 2026-10-12 · b · ★? · jazz',
      ' 3 · 2026-10-19 · —',
    ]);
  });

  it('writes the file exactly as it is kept in the repo', () => {
    const raw = readFileSync(new URL('../../assets-src/drops.json', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(formatDropsFile(JSON.parse(raw) as DropsFile)).toBe(raw);
  });

  it('keeps the app copy of the schedule in step with drops.json (run assets:charts after editing it)', () => {
    const file = JSON.parse(readFileSync(new URL('../../assets-src/drops.json', import.meta.url), 'utf8')) as DropsFile;
    const raw = readFileSync(new URL('../../src/entities/track/model/schedule.json', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(appSchedule(file)).toEqual({ start: START, weeks: 13 });
    expect(raw).toBe(formatAppSchedule(appSchedule(file)));
  });
});
