# NEON TAP — технологическая ветка

Ядро одно, обёртки сверху: та же сборка идёт в браузер, в PWA, в Google Play (TWA) и в App Store (Capacitor).

## Ядро игры (без зависимостей)

- **Рендер** — Canvas 2D, свой движок в `src/features/play-chart` (пулы нот, спрайты, заранее отрисованные слои, частицы, тряска, FPS-сторож с понижением эффектов), темы по жанрам (`shared/lib/render/themes.ts`).
- **Звук и время** — Web Audio API: `shared/lib/audio/AudioEngine.ts` (музыка → фильтр → мастер, анализатор спектра, `playbackRate` для уровней ×1.12 / ×1.2 и замедления, fade in/out), `Clock.ts` — единственный источник времени (интегрирует рампы скорости, учитывает задержку вывода устройства), калибровка + автоподстройка по тапам.
- **Ввод** — Pointer Events с аудио-таймстампами (`shared/lib/input`), тач-помощь, спиннер (`SpinTracker`), клавиатура на десктопе.
- **Судейство** — `NoteManager` / `entities/score/Scoring`: окна Perfect/Great/Good, холды, дроби, круги, спиннер, бонусы; точность = доля попаданий; три уровня скорости = три звезды (`play-chart/model/levels.ts`).

## Контент и генерация карт (офлайн-пайплайн)

- `shared/lib/analysis`: `SongAnalyzer` + `ChartGenerator` — бит-сетка, онсеты, фигуры фраз, смена полос, звёзды сложности 1–10; запуск `npm run assets:charts`.
- Стемы — Demucs (Python, venv на `D:/neon-tap-tools`), только для анализа; Whisper — расшифровка видео с отзывами.
- Музыка — 21 CC0-трек с OpenGameArt (`assets-src/tracks.json`), SFX — Kenney CC0, диктор — нейроголоса (msedge-tts). Лицензии — `public/music/LICENSES.md`.

## Интерфейс

- React 18 + TypeScript strict, Feature-Sliced Design (app → pages → widgets → features → entities → shared; проверка eslint-plugin-boundaries + `scripts/check-fsd.mjs`).
- Русский словарь `src/shared/i18n` (разложен на части), дизайн-система v3 в `src/shared/ui` (Tag, Chip, ObjButton, PrimaryAction, Panel, Coin, ProgressBar, Stars, Difficulty, RingCountdown), шрифт Unbounded. Макеты всех экранов — `.tmp/ux` (не в git).
- Сохранения — localStorage с версионированными миграциями (`entities/progress`, `entities/history`, `entities/settings`), кошелёк кристаллов, магазин, достижения, трек дня.

## Онлайн

- Vercel Serverless Functions: `api/scores.ts` (рекорды), `api/duels.ts` (дуэли по ссылке) + Upstash Redis REST. Включаются переменными `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` в проекте Vercel.
- PWA: манифест, свой Service Worker (`public/sw.js`: прекеш оболочки, кэш музыки/карт с лимитом, карты network-first), баннер установки, тост обновления.

## Реклама (шов)

- `src/shared/lib/ads` — интерфейс `RewardedAd` и заглушка (30 с; `?ads=fast` → 3 с). Провайдер (AdMob через Capacitor или веб-сеть) подставляется одним адаптером; игра о нём не знает.

## Инженерия

- Vite (сборка + SW), Vitest (~370 тестов), ESLint, Prettier (`--single-quote --print-width 160 --trailing-comma all`).
- Git → приватный GitHub `Alexanderadon/neon-tap`; деплой `bash scripts/deploy.sh` в проект Vercel `neon-tap-43` → `https://neon-tap-virid.vercel.app`.
- Проверки перед коммитом: `npx tsc -b && npx vitest run && npx eslint . && node scripts/check-fsd.mjs && npm run build`.

## Дорога в магазины

- **Google Play — TWA** (Bubblewrap / Android Studio): `docs/android-app.md`, `public/.well-known/assetlinks.json`, `public/privacy.html`, иконки уже есть. Нужны аккаунт разработчика и подпись сборки.
- **App Store — Capacitor**: `dist/` в WKWebView, плагины вибрации, AdMob-адаптер под шов рекламы, оценка в сторе. Нужны аккаунт Apple Developer и Xcode на Mac для подписи.
- Что не переписывается: ничего. Ядро, интерфейс, сохранения, онлайн — те же.
