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
8. Каждый трек в `public/music/` и каждый сэмпл в `public/sfx/` имеет строку в `public/music/LICENSES.md`
   с URL источника. Источники правды — `assets-src/tracks.json` и `assets-src/sfx.json`;
   `LICENSES.md` генерируется `npm run assets:licenses`. Звуки не синтезировать «на слух» — брать CC0-сэмплы.
9. Публичный API слайса — только через его `index.ts`. Глубокие импорты `@/features/x/model/...`
   из другого слоя запрещены.

## Команды

```
npm run dev            # dev-сервер
npm test               # vitest
npm run lint           # eslint + FSD-проверка
npm run typecheck      # tsc -b
npm run build          # production-сборка в dist/
npm run assets:music     # assets-src/music-raw → public/music (ffmpeg-static)
npm run assets:sfx       # assets-src/sfx-raw (паки Kenney) → public/sfx по реестру assets-src/sfx.json
npm run assets:voice     # нейро-TTS (msedge-tts) → public/voice/<dmitry|svetlana>; --force для перегенерации
npm run assets:charts    # public/music → public/charts + catalog.json (тот же пайплайн, что в браузере)
npm run assets:licenses  # tracks.json + sfx.json → public/music/LICENSES.md
```

## Деплой

Проект на Vercel: `neon-tap-2` (прежний `neon-tap` завис на стороне Vercel — все его новые деплои остаются в состоянии UNKNOWN; домен `neon-tap-virid.vercel.app` перевешен алиасом на `neon-tap-2`). Надёжный способ:

```
npm run build && vercel build --prod --yes && vercel deploy --prebuilt --prod --yes
```

Сборка делается локально, Vercel только загружает файлы. Не оборачивать `vercel deploy` в `timeout` — убитый CLI отменяет деплой. Если алиас слетит: `vercel alias set <deployment-url> neon-tap-virid.vercel.app`.

## Деплой

`bash scripts/deploy-fresh.sh` — локальная сборка, загрузка в НОВЫЙ проект Vercel и перенос домена `neon-tap-virid.vercel.app` на него. Обычный `vercel deploy` в существующий проект зависает в «Building…» после первого деплоя (баг на стороне Vercel), поэтому каждый релиз идёт в свежий проект. Старые проекты можно удалять в панели Vercel.

## Dev-флаги

- `?nofail=1` в URL — сердца тратятся, но провала нет. Для проверки переходов полос, записи GIF и профилирования.
- Настройки → «FPS / debug overlay» — fps, худший кадр, число нот/частиц, активное число полос, латентность.

## Порядок работы

- Перед фазой — план в `docs/plans/<N>-<name>.md`, после фазы — коммит. Не раньше.
- Проблемы с таймингом: не гадать. Включить debug overlay, смотреть `latency`, `worst ms`, `t`.
- Изменил анализ (`shared/lib/analysis`) → перегенерируй карты `npm run assets:charts` и проверь
  таблицу звёзд в выводе: кривая сложности должна оставаться монотонной по мирам.
