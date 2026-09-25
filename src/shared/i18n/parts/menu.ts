/** Main screen, profile, records, achievements, duels (package A). Keys must not repeat those of other parts (see ru.test.ts). */
export const menu = {
  // --- main screen ---
  /** The primary button when the focused track is still closed: «ОТКРЫТЬ / ★ 22 из 25» or «ОТКРЫТЬ / за 120 ◆». */
  openTrack: 'Открыть',
  starsOfNeed: '★ {have} из {need}',
  forCrystals: 'за {n}',
  shopAffordable: 'можно купить: {n}',
  deckSegmentAria: '{title}: к треку',
  /** The deck's last card «Моя музыка»: the one line under its title. */
  deckCustomLine: 'твой MP3 — игра сама сделает уровень',
  /** The same line once songs are saved: «3 песни · осталось 0 из 3» / «37 песен · PASS». */
  deckSongsLeft: '{songs} · осталось {left} из {limit}',
  deckSongsPass: '{songs} · PASS',
  /** «3 песни» (the noun is `libSongsNoun`); the card's primary once songs are saved is «МОЯ МУЗЫКА» (`libTitle`). */
  deckSongs: '{n} {noun}',
  // --- profile ---
  nicknameFor: 'ник для онлайн-рекордов',
  nicknameShort: 'для онлайн-рекордов · 1–16 символов',
  passedShort: 'Пройдено',
  notPassedShort: 'Не пройдено',
  rankSShort: 'Ранг S',
  comboShort: 'Комбо',
  profileCardAria: 'Сменить ник',
  // --- avatar ---
  avatarRow: 'Аватар',
  avatarPickTitle: 'Выбери аватар',
  avatarPickAria: 'Выбрать аватар',
  /** The way back to the letter avatar («Буква» = the first letter of the nickname). */
  avatarLetter: 'Буква',
  /** Names under the picker's 56 px cells (4 columns, 11 px caps ≈ 7 letters a line): the soft hyphens (­) mark where a long word may break. */
  avatarNames: {
    cat: 'Кошка',
    fox: 'Лис',
    robot: 'Робот',
    astronaut: 'Космо',
    panda: 'Панда',
    alien: 'Ино',
    dragon: 'Дракон',
    owl: 'Сова',
    shark: 'Акула',
    bunny: 'Зайка',
    ghost: 'Призрак',
    dino: 'Дино',
  },

  // --- achievements ---
  goalsGot: 'получено {done} из {total}',
  goalLevelsAria: 'уровень {n} из {total}',
  // --- duels ---
  duelAhead: 'Впереди',
  duelWaiting: 'Ждём',
  duelClosed: 'Закрыта',
  duelClosedHint: 'уже закончилась',
  duelBeat: 'Побил',
  duelBehind: 'Позади',
  duelMine: 'ты',
  duelsNone: 'пока ни одной',
  duelCallNoun: ['вызов', 'вызова', 'вызовов'],
  duelAnswerNoun: ['ответ', 'ответа', 'ответов'],
  duelRowAria: 'Ответить: {title}',
  // --- records ---
  offline: 'Нет связи',
  offlineHint: 'таблица появится позже',
  attemptsCount: '{n} {noun}',
  onlineRetry: 'Повторить',
} as const;
