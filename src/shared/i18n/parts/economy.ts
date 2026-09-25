/** Crystal economy: the daily allowance, the login calendar, first clears, the second chance (package A). Keys must not repeat those of other parts (see ru.test.ts). */
export const economy = {
  // --- result screen: calm notes under the loot, never a buy button ---
  /** The day's allowance is full: from now on a run pays every fifth crystal. */
  capDay: 'Запас дня собран — дальше каждый пятый кристалл',
  /** Today's own-song crystals are all collected. */
  capCustom: 'Свои песни на сегодня принесли все кристаллы',
  /** An own song under a minute pays nothing. */
  capShort: 'Песни короче минуты — без кристаллов',
  /** «Календарь: отметка 3 из 7 · +10 кристаллов». */
  calendarMarked: 'Календарь: отметка {day} из {total} · +{n} {noun}',
  // --- achievements screen: the login calendar strip ---
  calendarTitle: 'Календарь',
  /** Under the strip: how a mark is made (a missed day resets nothing, so nothing to warn about). */
  calendarHint: 'отметка — за первый пройденный забег дня',
  calendarToday: 'сегодня отмечено',
  /** The next mark's crystals: «следующая +10». */
  calendarNext: 'следующая +{n}',
  calendarAria: 'Календарь: {done} из {total}, награды {rewards}',
} as const;
