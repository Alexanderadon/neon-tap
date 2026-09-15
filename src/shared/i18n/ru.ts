import { common } from './parts/common';
import { menu } from './parts/menu';
import { result } from './parts/result';
import { shop } from './parts/shop';
import { onboard } from './parts/onboard';
import { game } from './parts/game';
import { offers } from './parts/offers';

/**
 * The Russian dictionary, assembled from per-screen parts so parallel packages never edit one
 * file. Parts must not share keys — `ru.test.ts` checks that; the later spread would win silently.
 */
export const ru = { ...common, ...menu, ...result, ...shop, ...onboard, ...game, ...offers } as const;

export type Dictionary = typeof ru;
