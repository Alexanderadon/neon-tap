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
  calibShiftNone: 'задержки нет · ноты на месте',
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
  /** «Калибровка» is 114 px in 11 px caps — wider than the 105 cell; the latency is what it calibrates. */
  calibShort: 'Задержка',
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
