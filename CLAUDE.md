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
npm run assets:icons     # PNG-иконки 192/512/maskable/apple-touch из public/icons/icon.svg-дизайна (чистый Node; --force для перезаписи)
```

## PWA

`public/sw.js` — рукописный service worker без библиотек; список оболочки и хеш сборки подставляет
`scripts/build-sw.ts` (шаг `npm run build` после `vite build`, плейсхолдеры `__NEON_BUILD__` /
`__NEON_PRECACHE__`). Медиа (`/music`, `/charts`, `/sfx`, `/voice`, `/icons`) — cache-first с лимитом 200 МБ.
Регистрация только в production (`app/main.tsx`), в dev воркера нет. Новая версия ждёт нажатия в тосте
«Доступно обновление» (`widgets/update-toast`, логика — `shared/lib/pwa/updateState.ts`). После деплоя
проверять `/sw.js` с `Cache-Control: no-cache` (`vercel.json`). Путь в Google Play (TWA / Bubblewrap,
`assetlinks.json`, политика конфиденциальности `public/privacy.html`) — `docs/android-app.md`.

## Деплой

`bash scripts/deploy-fresh.sh <имя-проекта>` — локальная сборка (`npm run build && vercel build`), загрузка prebuilt-сборки в **новый** проект Vercel, перенос домена `neon-tap-virid.vercel.app` на него и перелинковка репозитория. Обычный `vercel deploy` в существующий проект зависает в «Building…» после первого деплоя (баг на стороне Vercel), поэтому каждый релиз идёт в свежий проект (`neon-tap-7`, `neon-tap-8`, …). Не оборачивать `vercel deploy` в `timeout` — убитый CLI оставляет деплой в UNKNOWN. Старые проекты удаляются только в панели Vercel (CLI требует интерактивный TTY). Если алиас слетел: `vercel alias set <deployment-url> neon-tap-virid.vercel.app`.

## Dev-флаги

- `?nofail=1` в URL — сердца тратятся, но провала нет. Для проверки переходов полос, записи GIF и профилирования.
- `?unlock=1` — все треки открыты (единственное место чтения — `shared/config/devFlags.ts`); `UNLOCK_ALL` в `constants.ts` — то же для сборки.
- Онлайн-таблица рекордов: `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN` в переменных проекта Vercel; без них `api/scores.ts` отвечает `{ enabled: false }` и секция скрыта.
- Экономный режим: настройки → «Экономный режим» (авто / вкл / выкл); в debug overlay — `fx low·auto`, если его включил FPS-сторож.
- Настройки → «FPS / debug overlay» — fps, худший кадр, число нот/частиц, активное число полос, латентность.

## Порядок работы

- Перед фазой — план в `docs/plans/<N>-<name>.md`, после фазы — коммит. Не раньше.
- Проблемы с таймингом: не гадать. Включить debug overlay, смотреть `latency`, `worst ms`, `t`.
- Изменил анализ (`shared/lib/analysis`) → перегенерируй карты `npm run assets:charts` и проверь
  таблицу в выводе: плотность 1.2–2.3 нот/с, звёзды с разбросом (сейчас ★4–7), дроби есть в большинстве
  треков и не быстрее 6 нажатий/с, слайды только в соседнюю полосу.
- Одна карта на песню (`chart`), без уровней сложности — сложность задаёт песня (`rateStars`).
- `public/charts/tutorial.json` — рукописная карта обучения: не в `catalog.json`, не генерируется и не перезаписывается `assets:charts`; её инварианты проверяет `features/tutorial/model/chart.test.ts`.
- Новый трек — обязательно с `genre` в `assets-src/tracks.json` (список `GENRES` в `shared/types/chart.ts`): от него зависят обложка, тема и подпись на карточке.
- Тексты словаря `ru.ts` добавляются блоком в конец с комментарием `// --- <поток> ---`, чтобы ветки сливались без конфликтов.
- Ничего не удалять (файлы, кеши, проекты) без явной просьбы автора.
