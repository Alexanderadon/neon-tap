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
  /** The game's loading tag when the page has not had a single tap yet (sound needs one). */
  tapToStart: 'Коснись экрана',
  heartsOut: 'Сердца кончились',
  loadFailed: 'Не удалось загрузить',
  checkConnection: 'проверь связь и попробуй ещё раз',
  /** An own song that failed to start: the file is local, so nothing about the connection. */
  readFileFailed: 'Не удалось прочитать файл',
  readFileHint: 'попробуй ещё раз или выбери другой файл',
  soundToggle: 'Звук',
  tutorialStep: '{n} / {total}',
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
  // --- second chance (30 crystals, free with NEON PASS; never an ad) ---
  reviveOnce: '1 раз за забег',
  reviveHint: 'забег продолжится с этого места',
  /** «+5 сердец · 30 кристаллов» / «+5 сердец · бесплатно с PASS» under «Продолжить». */
  reviveSubPrice: '+5 сердец · {price}',
  revivePrice: '{n} {noun}',
  reviveFree: 'бесплатно с PASS',
  toResult: 'К результату',
  revived: '+5 сердец',
  samePlace: 'с этого же места',
  goTag: 'Поехали',
} as const;
