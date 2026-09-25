/** Weekly drops: «Новинка недели», countdowns, unlock options (package B). Keys must not repeat those of other parts (see ru.test.ts). */
export const drops = {
  /** The chapter of the weekly tracks after the rock pack, and the shop's first shelf. */
  dropsChapter: 'Новинки',
  /** Tag on this week's drop (the deck card, the shop card, the purchase sheet). */
  dropThisWeek: 'Новинка недели',
  /** Tag on an older weekly track in the shop. */
  dropTag: 'Новинка',
  /** The next drop's lock line: calendar days on the player's clock to the day Monday 00:00 Moscow falls on. */
  dropSoonDays: 'Выйдет через {n} дн.',
  dropSoonTomorrow: 'Выйдет завтра',
  /** East of Moscow the drop opens on Monday morning, west of it on Sunday evening: the same day. */
  dropSoonToday: 'Выйдет сегодня',
  /** The primary button on a drop that is not out yet (disabled). */
  dropSoon: 'Скоро',
  /** Tag on a drop NEON PASS opened before its release. */
  dropPassEarly: 'С PASS — раньше всех',
  /** The card for a week without a track: a promise, no date and no countdown. */
  dropSlotTitle: 'Новые треки',
  dropSlotLine: 'по понедельникам',
  /** The one-time toast when the deck opens on a new week's drop. */
  dropNewToast: 'Новый трек недели!',
} as const;
