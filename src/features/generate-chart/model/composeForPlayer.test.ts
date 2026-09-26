import { describe, expect, it } from 'vitest';
import { composeChart, type ComposeTrace } from '@/shared/lib/analysis';
import { fakeAnalysis } from '@/shared/lib/analysis/playability';
import { composeForPlayer } from './composeForPlayer';

/** A busy drum loop at 150 BPM: kicks, a streaming hi-hat — energy enough for a high ★. */
const analysis = fakeAnalysis(
  48,
  (_bar, step) => ({ strength: step % 4 === 0 ? 1 : step % 2 === 0 ? 0.9 : 0.6, low: step % 4 === 0 ? 0.7 : 0.1, mid: 0.3, high: 0.6 }),
  150,
);

function energyStars(): number {
  let target = 0;
  composeChart(analysis, { onTrace: (t: ComposeTrace) => (target = t.target) });
  return target;
}

describe('an own song fitted to the player', () => {
  it('takes the song energy as it is when the player can handle it', () => {
    const energy = energyStars();
    expect(energy).toBeGreaterThan(2);
    const plain = composeChart(analysis);
    expect(composeForPlayer(analysis).chart).toEqual(plain);
    expect(composeForPlayer(analysis, { maxStars: energy }).chart).toEqual(plain);
    expect(composeForPlayer(analysis, { maxStars: 6 }).chart).toEqual(plain);
  });

  it('is composed again under the ceiling when the energy asks for more', () => {
    const fitted = composeForPlayer(analysis, { maxStars: 2 });
    expect(fitted.chart).toEqual(composeChart(analysis, { targetStars: 2 }));
    expect(fitted.chart.stars).toBeLessThanOrEqual(2);
    expect(fitted.chart.notes.length).toBeLessThan(composeChart(analysis).notes.length);
    expect(fitted.phrases.length).toBeGreaterThan(0);
  });

  it('composes straight at an exact ★ («Сложнее»), over the ceiling', () => {
    expect(composeForPlayer(analysis, { targetStars: 4, maxStars: 2 }).chart).toEqual(composeChart(analysis, { targetStars: 4 }));
  });
});
