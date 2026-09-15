/**
 * Shop and economy (package B, `.tmp/ux/screens-shop.html`). Keys must not repeat those of other
 * parts (see ru.test.ts) — every key here is prefixed `shop`. The pre-v3 shop keys («Магазин»,
 * «Купить», «Куплено», «Премиум», «Купить трек?», «Отмена», «Трек открыт: {title}», «Покупать
 * нечего…») stay in common.ts and are reused as they are.
 */
export const shop = {
  /** Primary button of the list: play the daily track — the answer to «where do crystals come from». */
  shopEarn: 'Заработать',
  /** Sub-header line next to the «МАГАЗИН» tag (21 characters). */
  shopEarnHint: 'кристаллы — за забеги',
  /** The not-enough sheet's hint line. */
  shopEarnHintLong: 'кристаллы дают за забеги и достижения',
  /** Condition tag of a star-locked card: «★ ЕЩЁ 3». */
  shopStarsMore: 'ещё {n}',
  /** Coin captions of the purchase sheet. */
  shopPriceLabel: 'цена',
  shopYouHave: 'у тебя',
  shopWillRemain: 'останется',
  shopNotEnoughShort: 'не хватает',
  shopNotEnoughTitle: 'Не хватает кристаллов',
  /** Second line of «КУПИТЬ»: «за 173 кристалла». */
  shopBuyFor: 'за {n} {noun}',
  /** Second line of «ЗАРАБОТАТЬ» / «ИГРАТЬ»: the daily track. */
  shopDailyLabel: 'Трек дня · {title}',
  /** The not-enough sheet with an ad on the primary button: the shortfall in words. */
  shopNotEnoughLine: 'не хватает {n} · их дают за забеги',
  /** Aria: tap an owned card → the deck. */
  shopOpenOwned: 'Открыт — к колоде',
  // --- rewarded ad (package B+) ---
  shopWatchAd: 'Смотреть рекламу',
  /** «бесплатно · 30 секунд» — the ad row's second line. */
  shopAdFree: 'бесплатно · {n} {noun}',
  /** «БЕСПЛАТНО» — the primary button when the crystals are short. */
  shopAdFreeShort: 'Бесплатно',
  /** «реклама · 30 секунд» — its second line. */
  shopAdCaption: 'реклама · {n} {noun}',
  shopAdTag: 'Реклама',
  shopAdOpensAfter: 'трек откроется после ролика',
  shopAdPlaceholder: 'здесь ролик провайдера',
  shopAdClose: 'Закрыть',
  /** «ещё 24 секунды» under «ЗАКРЫТЬ» while the ad plays. */
  shopAdLeft: 'ещё {n} {noun}',
  /** Verdict after the ad (≤ 14 characters, spec §2.7). */
  shopTrackOpenedBang: 'Трек открыт!',
  /** The tag pair under the verdict: «БЕСПЛАТНО | ЗА РЕКЛАМУ». */
  shopForAd: 'за рекламу',
  secondsNoun: ['секунда', 'секунды', 'секунд'],
} as const;
