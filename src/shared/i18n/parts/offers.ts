/**
 * In-app offers (GDD «Донат»): the crystal packs, the 48-hour deal and the music pack popups.
 * Every key is prefixed `offer`; the shop keys («Купить», «Отмена», «цена») are reused as they are.
 */
export const offers = {
  // --- headline tags ---
  offerCrystalsTag: 'Кристаллы',
  offerLimitedTag: 'Только 48 часов',
  /** «8 ТРЕКОВ». */
  offerMusicTag: '{n} {noun}',
  // --- the one line of benefit ---
  offerCrystalsBase: 'стартовый набор',
  offerCrystalsBonus: '+{n} % кристаллов',
  offerLimitedBenefit: 'в 2 раза больше',
  offerMusicBenefit: 'все премиум-треки сразу',
  // --- coin captions ---
  offerPackS: 'малый',
  offerPackM: 'средний',
  offerPackL: 'большой',
  offerNow: 'сейчас',
  offerUsually: 'обычно',
  offerTimes2: '×2',
  offerInCrystals: 'в кристаллах',
  /** «осталось 47:59:59» under the deal's coins. */
  offerLeft: 'осталось {t}',
  // --- buttons ---
  /** «КУПИТЬ · 249 ₽». */
  offerBuy: 'Купить · {price}',
  offerProcessing: 'Оплата…',
  offerProcessingSub: 'секунду',
  offerNotNow: 'Не сейчас',
  // --- toasts ---
  offerCrystalsGot: 'Кристаллы получены',
  offerTracksGot: 'Треки открыты',
  offerFailed: 'Оплата не прошла',
  // --- ways in ---
  /** The not-enough sheet's row and the wallet chip's «+». */
  offerTopUp: 'Пополнить',
  offerTopUpSub: 'купить кристаллы',
  offerTopUpAria: 'Пополнить кристаллы',
  /** The shop header's tag while the deal is on: «48 Ч» / «1 Ч» / «12 МИН». */
  offerHoursShort: '{n} ч',
  offerMinutesShort: '{n} мин',
  offerLimitedAria: 'Акция «Только 48 часов»',
  offerTracksNoun: ['трек', 'трека', 'треков'],
} as const;
