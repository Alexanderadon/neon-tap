/** Calibration, settings, install prompts (package C). Keys must not repeat those of other parts (see ru.test.ts). */
export const onboard = {
  // --- calibration ---
  calibLine1: 'Звук в наушниках запаздывает',
  calibLine2: 'Тапни {n} раз под метроном',
  calibLine3: 'Мы подстроим ноты',
  calibTapsNoun: ['тап', 'тапа', 'тапов'],
  calibLastTap: 'последний тап',
  calibEarly: 'раньше',
  calibLate: 'позже',
  /** «ноты засчитаем на <b>38 мс</b> позже» — the number sits between the two halves. */
  calibShiftLate: ['ноты засчитаем на', 'позже'],
  calibShiftEarly: ['ноты засчитаем на', 'раньше'],
  calibShiftNone: 'подстройка не нужна · ноты на месте',
  calibTapScreen: 'тапай в любом месте экрана',
  // --- settings ---
  appliesNow: 'применяется сразу',
  fxModeHintShort: 'меньше вспышек · авто при лагах',
  showFps: 'Показывать FPS',
  forDev: 'для разработчика',
  done: 'Готово',
  toMenuShort: 'в меню',
  /** Object-button captions in the settings action row (11 px caps: at most 12 characters). */
  resetShort: 'Сброс',
  /**
   * The latency screen's name: its tag and the wide settings row. Not «Задержка» — a child reads it
   * literally, as «the game lags». In 11 px caps «ПОДСТРОЙКА» is 116 px, wider than a trio cell
   * (105 at 390, 103 at 360), so it lives in a 335 row, not in the trio.
   */
  calibShort: 'Подстройка',
  passed: 'Пройдено',
  notPassed: 'Не пройдено',
  resetTitle: 'Сбросить прогресс?',
  resetSub: 'звёзды, кристаллы и рекорды пропадут',
  resetVerb: 'Сбросить',
  resetLoss: 'всё пропадёт',
  tracksNoun: ['трек', 'трека', 'треков'],
  /** Coin caption in the reset dialog (the wallet title in `common` is capitalised). */
  resetCrystals: 'кристаллы',
  // --- install / update / rotate ---
  /** «Доступно обновление» does not fit next to the «Обновить» chip in 335 (13/700 ≈ 190 px). */
  updateShort: 'Есть обновление',
  installShort: 'на весь экран · работает офлайн',
  installHome: 'на экран «Домой»',
  installIosShort: 'в Safari — два шага',
  rotateShort: 'игра идёт в портрете',
} as const;
