import { LANE_COUNT, MAX_LANES, MIN_LANES } from '@/shared/config/constants';
import type { SectionTuple } from '@/shared/types/chart';
import { isEnergetic, round3, type Bar } from './bars';

/** Lane-count sections: pools by [quiet, medium, intense]; decisions every 4 bars in energetic songs, else 8. */
const LANE_POOLS: readonly [readonly number[], readonly number[], readonly number[]] = [
  [2, 3],
  [3, 4],
  [4, 5, 6],
];
const SECTION_BARS_CALM = 8;
const SECTION_BARS_ENERGETIC = 4;
const KEEP_LANES_CHANCE = 0.4;

/**
 * Lane count per section: quiet parts shrink to 2–3 lanes, medium parts play on 3–4, choruses
 * open up to 4–6. Decisions every 4 bars in energetic songs (else 8); the intro always starts on
 * 4 lanes; the previous count is kept with probability 0.4 when the new pool allows it — and always
 * after a bar listed in `keepAfter` (a bar ending in a drum fill: the fill and the pre-change silence
 * cannot share the same two beats).
 */
export function planSections(
  bars: Bar[],
  variation: boolean,
  random: () => number,
  energetic = isEnergetic(bars),
  keepAfter: ReadonlySet<number> = new Set(),
): SectionTuple[] {
  for (const b of bars) b.lanes = LANE_COUNT;
  const block = energetic ? SECTION_BARS_ENERGETIC : SECTION_BARS_CALM;
  if (!variation || bars.length < block * 2) return [[0, LANE_COUNT]];
  const sections: SectionTuple[] = [];
  let prevLanes = LANE_COUNT;
  for (let p = 0; p * block < bars.length; p++) {
    const phrase = bars.slice(p * block, (p + 1) * block);
    const intensity = Math.round(phrase.reduce((a, b) => a + b.intensity, 0) / phrase.length) as 0 | 1 | 2;
    let lanes: number;
    const pool = LANE_POOLS[intensity];
    if (p === 0) lanes = LANE_COUNT;
    else if (pool.includes(prevLanes) && (keepAfter.has(p * block - 1) || random() < KEEP_LANES_CHANCE)) lanes = prevLanes;
    else {
      const fresh = pool.filter((n) => n !== prevLanes);
      const from = fresh.length ? fresh : pool;
      lanes = from[Math.floor(random() * from.length)];
    }
    lanes = Math.max(MIN_LANES, Math.min(MAX_LANES, lanes));
    for (const b of phrase) b.lanes = lanes;
    const time = round3(phrase[0].slots[0].time);
    if (!sections.length || sections[sections.length - 1][1] !== lanes) sections.push([sections.length ? time : 0, lanes]);
    prevLanes = lanes;
  }
  return sections;
}
