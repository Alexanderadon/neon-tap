/** HUD, countdown, pause, fail / stop, tutorial overlays (package D). Keys must not repeat those of other parts (see ru.test.ts). */
export const game = {
  comboWord: 'Комбо',
  comboMilestone: '{n} комбо',
  lanesWider: '{n} полос · шире',
  lanesNarrower: '{n} полос · уже',
  levelOf: 'Уровень {n} / {m}',
  levelWord: 'Уровень',
  plusStar: '+1 звезда',
  /** Endless mode: the loop number in the star show and the pause panel, the crown just earned, the mode's name. */
  loopOf: 'Круг {n}',
  loopWord: 'Круг',
  plusCrown: '+1 корона',
  /** The frame when an endless run ends past the third star: a finale, not a fail. */
  finale: 'Финиш',
  /** The pause panel once a level is won: end the run now, what was won stays. */
  finishRun: 'Завершить',
  /** The third star's show: from here the song loops on, faster every loop. */
  endlessMode: 'Бесконечный режим',
  /** The pause panel while the review autoplayer (`?auto=1`) is playing. */
  autoTag: 'Автопрогон',
  /** The game's loading tag when the page has not had a single tap yet (sound needs one): a request, not a loading state. */
  tapToStart: 'Коснись экрана, чтобы начать',
  heartsOut: 'Сердца кончились',
  loadFailed: 'Не удалось загрузить',
  checkConnection: 'проверь связь и попробуй ещё раз',
  /** An own song that failed to start: the file is local, so nothing about the connection. */
  readFileFailed: 'Не удалось прочитать файл',
  readFileHint: 'попробуй ещё раз или выбери другой файл',
  /** The pause panel's music toggle says what it is now. */
  soundOn: 'Звук вкл',
  soundOff: 'Звук выкл',
  tutorialStep: '{n} / {total}',
  /** A run's first meeting of a mechanic: the tag on the caption card, and the card per kind (`{from}` / `{to}` / `{key}` — the note's keys). */
  meetTag: 'Новое',
  meetCards: {
    slide: { title: 'Веди', desktop: 'Держи {from} и зажми {to}', touch: 'Веди палец в соседнюю зону' },
    roll: { title: 'Барабань', desktop: '{key} — столько раз, сколько на ноте', touch: 'Столько раз, сколько на ноте' },
    circle: { title: 'Тапни по кругу', desktop: 'Пробел, когда круг заполнится', touch: 'Когда круг заполнится' },
    spin: { title: 'Крути', desktop: 'Мышью по кругу или жми клавиши', touch: 'Пальцем по кругу — сколько успеешь' },
  },
  // --- duel page ---
  duelInvite: '{name} вызывает тебя',
  duelFromLink: 'ссылка из сообщения друга',
  duelGone: 'не найдена или уже закончилась',
  yourBest: 'Твой лучший {score}',
  notPlayedYet: 'Ты ещё не играл',
  beatScore: 'побей {score}',
  pickTrack: 'выбрать трек',
  // --- custom song page ---
  chooseFile: 'Выбрать файл',
  fileFormats: 'MP3 · OGG · WAV',
  fileStays: 'остаётся у тебя',
  yourTrack: 'Твой трек',
  notesLine: '{n} {noun} · {bpm} BPM',
  wrongFormat: 'не тот формат',
  readFailed: 'Не удалось прочитать',
  cancelAnalysis: 'Отмена',
  replaceFile: 'Заменить',
  analysisWord: 'Анализ',
  // --- second chance: for a rewarded ad, free with NEON PASS (no ad); never for crystals ---
  reviveOnce: '1 раз за забег',
  /** The panel line under the five empty hearts: what the second chance gives (the refill then shows the same words in bold). */
  reviveHint: '+5 сердец · с этого же места',
  /**
   * Without NEON PASS the primary button says it is an ad and what it gives (Yandex Games 4.5.1): «СМОТРЕТЬ /
   * рекламу · +5 сердец». Its 20 px caps label fits about ten letters at 360 px, so «рекламу» goes to the sub
   * line; the sub line has about 208 px there — «с этого же места» stays in the panel line above.
   */
  reviveWatchAd: 'Смотреть',
  reviveWatchAdSub: 'рекламу · +5 сердец',
  /**
   * With NEON PASS: «ПРОДОЛЖИТЬ / бесплатно с PASS» (the label is `continue`), no ad. Not «с NEON PASS»: the
   * wide Latin caps would bring the line to the edge of its 208 px (see reviveButton.test.ts).
   */
  reviveFreePass: 'бесплатно с PASS',
  /** While the rewarded ad plays: the waiting button «РЕКЛАМА / сердца после ролика» with the seconds in the ring. */
  reviveAdPlaying: 'Реклама',
  reviveAdPlayingSub: 'сердца после ролика',
  toResult: 'К результату',
  revived: '+5 сердец',
  samePlace: 'с этого же места',
  goTag: 'Поехали',
} as const;
