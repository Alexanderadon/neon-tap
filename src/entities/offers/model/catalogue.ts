import type { Sku } from '@/shared/lib/iap';

/**
 * The kinds of offer sheet. Only the crystal packs are left: the 48-hour deal and the eight-track
 * music pack are gone, and nothing pops up by itself (docs/plans/economy-drops-mymusic.md §1.2).
 */
export type OfferKind = 'crystals';

export type CrystalPackSku = 'crystals-s' | 'crystals-m' | 'crystals-l' | 'crystals-xl';

export interface CrystalPack {
  sku: CrystalPackSku;
  /** Crystals granted. */
  crystals: number;
  /** The bonus over the small pack's rate shown on the sheet, in per cent («+15 %»); 0 for the small one. Never above the real one. */
  bonusPercent: number;
}

/** Four sizes (49 / 99 / 249 / 499 ₽); the bonus grows with the pack and each label is rounded down from the real rate. */
export const CRYSTAL_PACKS: readonly CrystalPack[] = [
  { sku: 'crystals-s', crystals: 300, bonusPercent: 0 },
  { sku: 'crystals-m', crystals: 700, bonusPercent: 15 },
  { sku: 'crystals-l', crystals: 2000, bonusPercent: 30 },
  { sku: 'crystals-xl', crystals: 4500, bonusPercent: 45 },
];

export function crystalPack(sku: Sku): CrystalPack | undefined {
  return CRYSTAL_PACKS.find((p) => p.sku === sku);
}

/** Crystals a sku grants. */
export function crystalsFor(sku: Sku): number {
  return crystalPack(sku)?.crystals ?? 0;
}

/**
 * The real bonus of a pack over the small one's crystals per ruble, in per cent (fractional):
 * what a label may claim at most. `rubles` gives each sku's price.
 */
export function realBonusPercent(pack: CrystalPack, rubles: (sku: CrystalPackSku) => number): number {
  const base = CRYSTAL_PACKS[0];
  const baseRate = base.crystals / rubles(base.sku);
  const rate = pack.crystals / rubles(pack.sku);
  return (rate / baseRate - 1) * 100;
}
