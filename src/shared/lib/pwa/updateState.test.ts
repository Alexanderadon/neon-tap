import { describe, expect, it } from 'vitest';
import { isUpdateAvailable, reduceSwUpdate, SW_INITIAL, type SwUpdateEvent, type SwUpdateState } from './updateState';

function run(events: SwUpdateEvent[], from: SwUpdateState = SW_INITIAL) {
  const effects: string[] = [];
  let state = from;
  for (const e of events) {
    const r = reduceSwUpdate(state, e);
    state = r.state;
    if (r.effect) effects.push(r.effect);
  }
  return { state, effects };
}

describe('reduceSwUpdate', () => {
  it('first install: nothing to announce, claim does not reload', () => {
    const r = run([
      { type: 'registered', waiting: false, controlled: false },
      { type: 'updatefound' },
      { type: 'installed', controlled: false },
      { type: 'controllerchange', hadController: false },
    ]);
    expect(r.effects).toEqual([]);
    expect(isUpdateAvailable(r.state)).toBe(false);
  });

  it('a new version installs while the page is controlled → toast → apply → reload on controllerchange', () => {
    const r1 = run([{ type: 'registered', waiting: false, controlled: true }, { type: 'updatefound' }]);
    expect(r1.state.phase).toBe('installing');
    expect(isUpdateAvailable(r1.state)).toBe(false);
    const r2 = run([{ type: 'installed', controlled: true }], r1.state);
    expect(isUpdateAvailable(r2.state)).toBe(true);
    expect(r2.state.action).toBe('apply');
    const r3 = run([{ type: 'apply' }], r2.state);
    expect(r3.effects).toEqual(['skip-waiting']);
    expect(r3.state.applied).toBe(true);
    // A second click never sends SKIP_WAITING twice.
    expect(run([{ type: 'apply' }], r3.state).effects).toEqual([]);
    const r4 = run([{ type: 'controllerchange', hadController: true }], r3.state);
    expect(r4.effects).toEqual(['reload']);
  });

  it('a worker already waiting at registration shows the toast immediately', () => {
    const r = run([{ type: 'registered', waiting: true, controlled: true }]);
    expect(isUpdateAvailable(r.state)).toBe(true);
    expect(r.state.action).toBe('apply');
  });

  it('controllerchange without our apply (another tab updated) offers a plain reload', () => {
    const r = run([{ type: 'registered', waiting: false, controlled: true }, { type: 'controllerchange', hadController: true }]);
    expect(isUpdateAvailable(r.state)).toBe(true);
    expect(r.state.action).toBe('reload');
    expect(run([{ type: 'apply' }], r.state).effects).toEqual(['reload']);
  });

  it('apply outside the ready phase is a no-op; updatefound keeps an existing toast', () => {
    expect(run([{ type: 'apply' }]).effects).toEqual([]);
    const ready = run([{ type: 'registered', waiting: true, controlled: true }]).state;
    const after = run([{ type: 'updatefound' }], ready).state;
    expect(after.phase).toBe('ready');
    expect(isUpdateAvailable(after)).toBe(true);
  });
});
