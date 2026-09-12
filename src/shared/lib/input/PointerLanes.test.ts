import { describe, expect, it } from 'vitest';
import { PointerLanes } from './PointerLanes';

function harness() {
  const log: string[] = [];
  const pl = new PointerLanes({
    press: (lane, viaMove) => log.push(`P${lane}${viaMove ? 'm' : ''}`),
    release: (lane, viaMove) => log.push(`R${lane}${viaMove ? 'm' : ''}`),
  });
  return { pl, log };
}

describe('PointerLanes', () => {
  it('tap: down presses, up releases', () => {
    const { pl, log } = harness();
    expect(pl.down(1, 2)).toBe(true);
    expect(pl.active).toBe(1);
    expect(pl.laneOf(1)).toBe(2);
    expect(pl.up(1)).toBe(true);
    expect(pl.active).toBe(0);
    expect(log).toEqual(['P2', 'R2']);
  });

  it('two simultaneous fingers on different lanes are independent', () => {
    const { pl, log } = harness();
    pl.down(1, 0);
    pl.down(2, 3);
    pl.up(1);
    expect(log).toEqual(['P0', 'P3', 'R0']);
    pl.up(2);
    expect(log).toEqual(['P0', 'P3', 'R0', 'R3']);
  });

  it('two thumbs on one lane: both downs reach the handler (each is a tap for the judge), released only when the last one lifts', () => {
    const { pl, log } = harness();
    pl.down(1, 1);
    pl.down(2, 1);
    pl.up(1);
    expect(log).toEqual(['P1', 'P1']); // HeldLanes turns the second one into a fresh tap; no release yet
    pl.up(2);
    expect(log).toEqual(['P1', 'P1', 'R1']);
  });

  it('slide: moving into another lane releases the old one and presses the new one via move', () => {
    const { pl, log } = harness();
    pl.down(7, 1);
    expect(pl.move(7, 1)).toBe(false); // same lane: nothing
    expect(pl.move(7, 2)).toBe(true);
    expect(pl.laneOf(7)).toBe(2);
    expect(pl.move(7, -1)).toBe(false); // wandered off the field: keeps lane 2
    expect(pl.laneOf(7)).toBe(2);
    pl.up(7);
    expect(log).toEqual(['P1', 'R1m', 'P2m', 'R2']);
  });

  it('sliding onto a lane another finger holds only releases the old lane', () => {
    const { pl, log } = harness();
    pl.down(1, 0);
    pl.down(2, 1);
    pl.move(2, 0);
    expect(log).toEqual(['P0', 'P1', 'R1m', 'P0m']);
    pl.up(2); // finger 1 still on lane 0 → no release
    expect(log).toEqual(['P0', 'P1', 'R1m', 'P0m']);
    pl.up(1);
    expect(log).toEqual(['P0', 'P1', 'R1m', 'P0m', 'R0']);
  });

  it('sliding away from a lane another finger holds keeps it pressed', () => {
    const { pl, log } = harness();
    pl.down(1, 2);
    pl.down(2, 2);
    pl.move(2, 3);
    expect(log).toEqual(['P2', 'P2', 'P3m']);
  });

  it('pointercancel (= up) of a tracked pointer releases; of an unknown pointer does nothing', () => {
    const { pl, log } = harness();
    pl.down(5, 3);
    expect(pl.up(5)).toBe(true);
    expect(pl.up(5)).toBe(false);
    expect(pl.up(99)).toBe(false);
    expect(pl.move(99, 1)).toBe(false);
    expect(log).toEqual(['P3', 'R3']);
  });

  it('a pointer that landed outside every lane is ignored entirely', () => {
    const { pl, log } = harness();
    expect(pl.down(1, -1)).toBe(false);
    expect(pl.active).toBe(0);
    expect(pl.move(1, 2)).toBe(false);
    expect(pl.up(1)).toBe(false);
    expect(log).toEqual([]);
  });

  it('a second down with a stale id lifts the old contact first', () => {
    const { pl, log } = harness();
    pl.down(1, 0);
    pl.down(1, 3);
    expect(pl.active).toBe(1);
    expect(log).toEqual(['P0', 'R0', 'P3']);
  });

  it('clear forgets pointers without emitting', () => {
    const { pl, log } = harness();
    pl.down(1, 0);
    pl.down(2, 1);
    pl.clear();
    expect(pl.active).toBe(0);
    expect(pl.up(1)).toBe(false);
    expect(log).toEqual(['P0', 'P1']);
  });
});
