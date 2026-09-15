import type { Sku } from '@/shared/lib/iap';

/** The kinds of popup: the regular crystal packs, the 48-hour ×2 deal, the eight-track music pack. */
export type OfferKind = 'crystals' | 'limited' | 'music';

export type CrystalPackSku = 'crystals-s' | 'crystals-m' | 'crystals-l';

export interface CrystalPack {
  sku: CrystalPackSku;
  /** Crystals granted. */
  crystals: number;
  /** The bonus over the small pack's rate, in per cent («+25 %»); 0 for the small one. */
  bonusPercent: number;
}

/** Three sizes; the bonus grows with the pack (GDD «Донат»). */
export const CRYSTAL_PACKS: readonly CrystalPack[] = [
  { sku: 'crystals-s', crystals: 500, bonusPercent: 0 },
  { sku: 'crystals-m', crystals: 1500, bonusPercent: 10 },
  { sku: 'crystals-l', crystals: 4000, bonusPercent: 25 },
];

/** The 48-hour deal: twice the middle pack's crystals for the middle pack's price. */
export const LIMITED_DEAL = {
  sku: 'limited-48h' as const,
  crystals: 3000,
  /** The pack whose price the deal is sold at — its crystals are the «обычно» coin. */
  pricedAs: 'crystals-m' as const,
  multiplier: 2,
};

/** Tracks in the music pack. */
export const MUSIC_PACK_SIZE = 8;
export const MUSIC_PACK_SKU: Sku = 'music-8';

export function crystalPack(sku: Sku): CrystalPack | undefined {
  return CRYSTAL_PACKS.find((p) => p.sku === sku);
}

/** Crystals a sku grants (0 for the music pack, whose goods are tracks). */
export function crystalsFor(sku: Sku): number {
  if (sku === LIMITED_DEAL.sku) return LIMITED_DEAL.crystals;
  return crystalPack(sku)?.crystals ?? 0;
}

/** Which popup sells a sku. */
export function offerKindOf(sku: Sku): OfferKind {
  if (sku === MUSIC_PACK_SKU) return 'music';
  if (sku === LIMITED_DEAL.sku) return 'limited';
  return 'crystals';
}
