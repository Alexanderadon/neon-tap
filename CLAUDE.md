# NEON TAP — правила проекта

Читай `GDD.md` перед началом каждой фазы. Планы фаз — в `docs/plans/`.

## Стек

React 18 + TypeScript (strict) + Vite. Архитектура — **Feature-Sliced Design**:
`app → pages → widgets → features → entities → shared`. Слой импортирует только слои ниже.
Проверка: `eslint-plugin-boundaries` + `scripts/check-fsd.mjs` (оба в `npm run lint`).

## Жёсткие правила

1. **Игровой движок без библиотек.** `shared/lib/audio`, `shared/lib/analysis`, `shared/lib/render`,
   `features/play-chart` — только Web Audio API и Canvas 2D. React используется только для экранов
   (меню, настройки, результаты). Единственные рантайм-зависимости — `react` и `react-dom`.
2. **Время нот — только `audioContext.currentTime`** (через `shared/lib/audio/Clock`).
   `performance.now()` — только для рендера, FPS-метра и конвертации таймстампов событий ввода.
3. **Никаких аллокаций в игровом цикле.** Ноты — пул (`NoteManager`), частицы — типизированные
   массивы (`ParticlePool`), спрайты свечения предрендерены (`shared/lib/render/neon.ts`).
   `shadowBlur` в кадре запрещён.
4. Целевой FPS — 60 на среднем Android. Проверять дебаг-оверлеем (настройки → FPS / debug overlay).
5. Мобильный ввод — pointer events, `touch-action: none`, `passive: false`.
6. Каждый модуль в `shared/lib/*`, `entities/*/model` и `features/*/model` покрыт юнит-тестами
   (vitest, `src/**/*.test.ts`) до интеграции в UI.
7. Русский текст в UI — только через словарь `shared/i18n/ru.ts`, не хардкодом.
8. Каждый трек в `public/music/` имеет строку в `public/music/LICENSES.md` с URL источника.
   Источник правды — `assets-src/tracks.json`; `LICENSES.md` генерируется скриптом.
9. Публичный API слайса — только через его `index.ts`. Глубокие импорты `@/features/x/model/...`
   из другого слоя запрещены.

## Команды

```
npm run dev            # dev-сервер
npm test               # vitest
npm run lint           # eslint + FSD-проверка
npm run typecheck      # tsc -b
npm run build          # production-сборка в dist/
npm run assets:music   # assets-src/music-raw → public/music (ffmpeg-static)
npm run assets:voice   # assets-src/voice-raw → public/voice
npm run assets:charts  # public/music → public/charts + catalog.json (тот же пайплайн, что в браузере)
```

## Порядок работы

- Перед фазой — план в `docs/plans/<N>-<name>.md`, после фазы — коммит. Не раньше.
- Проблемы с таймингом: не гадать. Включить debug overlay, смотреть `latency`, `worst ms`, `t`.
- Изменил анализ (`shared/lib/analysis`) → перегенерируй карты `npm run assets:charts` и проверь
  таблицу звёзд в выводе: кривая сложности должна оставаться монотонной по мирам.
