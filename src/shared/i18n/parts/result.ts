/**
 * Result screen (package A / final.html). Keys must not repeat those of other parts (see ru.test.ts).
 * Budget (spec §1.2): verdict ≤ 14 characters at 28/900, tags ≤ 24 at 11/700 caps, coin captions ≤ 90 px at 13 px.
 * The 11 px labels and the verdict are set in caps by CSS — the strings stay in sentence case.
 */
export const result = {
  /** Verdict (28/900): what the run meant, one short line. */
  verdictStars: '+{n} {noun}',
  verdictCrowns: '+{n} {noun}',
  crownNoun: ['корона', 'короны', 'корон'] as const,
  verdictAllStars: 'Все три звезды',
  verdictTwoStars: 'Две звезды',
  verdictOneStar: 'Звезда есть',
  verdictNoMiss: 'Без промахов',
  verdictRecord: 'Новый рекорд',
  verdictNoStars: 'Трек окончен',
  /** Tag pair on the score panel. */
  tagNewRecord: 'Новый рекорд',
  tagWas: 'было {score}',
  tagRecord: 'рекорд {score}',
  /** An endless run: the loop it ended on and the score of the whole run (the panel shows the score at the third star). */
  tagLoop: 'круг {n}',
  tagTotal: 'всего {score}',
  tagFailedHearts: 'сердца кончились',
  /** The grey stats line under the score: «Точность 98,6 %  Комбо 136  Ранг S». */
  statCombo: 'Комбо',
  /** Coin captions (13/400). */
  coinCrystals: 'кристаллы',
  coinStars: 'звёзды',
  coinDaily: 'трек дня',
  coinBonus: 'бонус',
  coinGoal: 'достижение',
  coinGoals: '{n} {noun}',
  goalsNoun: ['достижение', 'достижения', 'достижений'],
  /** Unlock bar: «до открытия Bouncer ★ 22 / 25». */
  unlockTo: 'до открытия',
  unlockCount: '{have} / {need}',
  /** «Дуэль» object button states (11/700 caps, ≤ 10 characters in 105 px). */
  duelDoneShort: 'Готово',
  duelErrorShort: 'Ошибка',
  /** Accessibility. */
  resultRewardsAria: 'Награды за забег',
} as const;
