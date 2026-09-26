/** Tutorial: the steps' cards and the finale (package T). Keys must not repeat those of other parts (see ru.test.ts). */
export const tutorial = {
  /** The nine steps (features/tutorial TUTORIAL_PLAN): title ≤ 16, desktop hint ≤ 40, touch hint ≤ 34; `{keys}` — the section's key caps, `{key}` — the heart lane's. */
  tutorialSteps: {
    intro: { title: 'Поехали', desktop: 'Клавиши {keys}', touch: 'Тапай в нижней половине' },
    tap: { title: 'Тапни', desktop: 'Когда нота на линии — {keys}', touch: 'Когда нота на линии' },
    hold: { title: 'Держи', desktop: 'Держи {keys} до конца хвоста', touch: 'Держи до конца хвоста' },
    lanes2: { title: 'Две полосы', desktop: 'Клавиши {keys}', touch: 'Левая и правая зоны' },
    alt: { title: 'По очереди', desktop: '{keys} — по очереди', touch: 'Левый, правый, левый…' },
    lanes3: { title: 'Три полосы', desktop: 'Клавиши {keys}', touch: 'Три зоны внизу' },
    lanes4: { title: 'Четыре полосы', desktop: 'Клавиши {keys}', touch: 'Четыре зоны внизу' },
    spell: { title: 'Поймай сердце', desktop: '{key} — это ещё одна жизнь', touch: 'Тапни — это ещё одна жизнь' },
    finale: { title: 'Готово!', desktop: 'Дальше — настоящий трек', touch: 'Дальше — настоящий трек' },
  },
  /** The «Готово!» frame: what a real track adds. */
  tutorialFinaleLine: 'В треке три уровня, каждый быстрее, за каждый — звезда',
} as const;
