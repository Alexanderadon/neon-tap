import { describe, expect, it } from 'vitest';
import { ParticlePool } from './Particles';
import { ScreenShake } from './Effects';

describe('ParticlePool', () => {
  it('never exceeds capacity and recycles slots', () => {
    const pool = new ParticlePool(50);
    pool.emit(0, 0, 80, 0, 100, 4, 1);
    pool.update(0.016);
    expect(pool.alive).toBeLessThanOrEqual(50);
    pool.update(5);
    expect(pool.alive).toBe(0);
  });

  it('emitScale halves emission in the economy FX level (but never below one particle)', () => {
    const pool = new ParticlePool(100);
    pool.emitScale = 0.5;
    pool.emit(0, 0, 20, 0, 100, 4, 1);
    expect(pool.alive).toBe(10);
    pool.emit(0, 0, 1, 0, 100, 4, 1);
    expect(pool.alive).toBe(11);
    pool.emitScale = 1;
    pool.emit(0, 0, 20, 0, 100, 4, 1);
    expect(pool.alive).toBe(31);
  });
});

describe('ScreenShake', () => {
  it('clamps amplitude to 4px and decays to zero', () => {
    const shake = new ScreenShake();
    shake.trigger(40);
    shake.update(0.001);
    expect(Math.abs(shake.offsetX)).toBeLessThanOrEqual(4);
    expect(Math.abs(shake.offsetY)).toBeLessThanOrEqual(4);
    for (let i = 0; i < 60; i++) shake.update(0.016);
    expect(shake.offsetX).toBe(0);
    expect(shake.offsetY).toBe(0);
  });
});
