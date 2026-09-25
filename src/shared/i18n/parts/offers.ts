/**
 * In-app offers (GDD «Донат»): the crystal packs sheet — opened only by the wallet's «+» and the
 * shop's not-enough sheet, never by itself. Every key is prefixed `offer`; the shop keys («Купить»,
 * «Отмена», «цена») are reused as they are.
 */
export const offers = {
  // --- headline tag ---
  offerCrystalsTag: 'Кристаллы',
  // --- the one line of benefit ---
  offerCrystalsBase: 'стартовый набор',
  offerCrystalsBonus: '+{n} % кристаллов',
  /** A pack coin for screen readers: «700 кристаллов · 99 ₽». */
  offerPackAria: '{n} {noun} · {price}',
  // --- buttons ---
  /** «КУПИТЬ · 99 ₽». */
  offerBuy: 'Купить · {price}',
  offerProcessing: 'Оплата…',
  offerProcessingSub: 'секунду',
  offerNotNow: 'Не сейчас',
  // --- toasts ---
  offerCrystalsGot: 'Кристаллы получены',
  offerFailed: 'Оплата не прошла',
  // --- ways in ---
  /** The not-enough sheet's row and the wallet chip's «+». */
  offerTopUp: 'Пополнить',
  offerTopUpSub: 'купить кристаллы',
  offerTopUpAria: 'Пополнить кристаллы',
} as const;
