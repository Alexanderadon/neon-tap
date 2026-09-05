# 10 — PWA: офлайн, установка, иконки, путь в Play Market

## Цель

NEON TAP ведёт себя как приложение на телефоне: ставится на главный экран, открывается без
белой вспышки, играет без интернета, сам сообщает об обновлении. Без библиотек (Workbox и т. п.).

## Что сделано

1. **Service worker** `public/sw.js` — рукописный. Оболочка приложения (`/`, хешированные
   `assets/*`, манифест, `privacy.html`, `icon.svg`) прекешируется; список подставляет
   `scripts/build-sw.ts` после `vite build` (шаг `npm run build`; плейсхолдеры `__NEON_BUILD__` /
   `__NEON_PRECACHE__`, версия — sha256 оболочки, логика — `scripts/lib/sw-manifest.ts`).
   Медиа (`/music`, `/sfx`, `/voice`, `/icons`) — cache-first с лимитом 200 МБ и вытеснением по
   порядку записи (индекс размеров лежит в самом кеше, мутации сериализованы); `/charts` —
   cache-first с обновлением в фоне (карты перегенерируются). `index.html` — network-first с
   офлайн-фолбэком на оболочку. Первая установка активируется сразу; следующие версии ждут
   `SKIP_WAITING`. `/api/*` не трогается. `vercel.json`: `Cache-Control: no-cache` для `/sw.js` и
   манифеста, `application/json` для `assetlinks.json`.
2. **Обновление** — `shared/lib/pwa/updateState.ts` (чистый редьюсер, тесты) + `serviceWorker.ts`
   (регистрация только в production из `app/main.tsx`, проверка новой версии при возврате в
   фон/раз в час). Тост «Доступно обновление — обновить» (`widgets/update-toast`): нажатие →
   `SKIP_WAITING` → `controllerchange` → перезагрузка; если воркер сменил другой таб —
   тост предлагает перезагрузку; во время игры тост скрыт; «Позже» — до следующего запуска.
3. **Установка** — `beforeinstallprompt` перехватывается в `initInstallPrompt()` до рендера React;
   баннер «Установить приложение» (`widgets/install-banner`) с SVG-знаком на экране меню через
   2.5 с; Chromium — системный диалог, iOS Safari — подсказка «Поделиться → На экран „Домой“» с
   глифами; отказ помнится 30 дней (`localStorage`, формат — `dismissal.ts`); в standalone,
   встроенных браузерах и Firefox баннер не показывается (`platform.ts`, тесты).
4. **Иконки** — `scripts/make-icons.ts`: PNG 192 / 512 / maskable 512 / apple-touch 180 из
   RGBA-буфера, кодировщик PNG на `zlib` + свой CRC32 (`scripts/lib/png.ts`), знак (четыре
   неоновые полосы + линия удара, как в `icon.svg`) рисуется SDF-растеризатором с размытием
   свечения (`scripts/lib/icon-render.ts`). `npm run assets:icons` (существующие файлы — только с
   `--force`, `--out <dir>` для проверки). Манифест ссылается на PNG и SVG.
5. **Standalone** — сплэш в `index.html` (inline critical CSS: тёмный фон, знак, логотип,
   пульсирующая линия; `main.tsx` гасит его после первого кадра React), запрет зума
   (ctrl+колесо, ctrl+±, пинч, `gesturestart`) и контекстного меню в установленном приложении
   (`installStandaloneGuards`, класс `html.standalone`), пауза при `visibilitychange` /
   `freeze` / `pagehide` в `widgets/game-canvas` — останавливается только источник песни,
   AudioContext живёт.
6. **Google Play** — `docs/android-app.md`: Trusted Web Activity через Bubblewrap (init по URL
   манифеста, Application ID, подпись и Play App Signing, `assetlinks.json` с плейсхолдером
   SHA-256 в `public/.well-known/`, проверка валидатором, листинг: политика, рейтинг IARC,
   «Безопасность данных», графика), обновления без новой сборки; альтернатива — Capacitor.
   Политика конфиденциальности — `public/privacy.html` (без сбора данных, только `localStorage`,
   необязательная онлайн-таблица).

## Тесты

`scripts/lib/sw-manifest.test.ts` (сбор списка, хеш, подстановка), `scripts/lib/png.test.ts`
(сигнатура / IHDR / IEND / CRC / распаковка IDAT для 4×4), `scripts/lib/icon-render.test.ts`,
`shared/lib/pwa/platform.test.ts` (платформа, условия показа баннера),
`shared/lib/pwa/updateState.test.ts` (сценарии обновления), `shared/lib/pwa/dismissal.test.ts`,
`shared/lib/pwa/standalone.test.ts`.

## Проверить на устройстве

- Chrome Android: баннер → установка → запуск без адресной строки, тёмный сплэш, звук после тапа.
- Авиарежим после первого захода: меню и сыгранный трек работают; несыгранный — ошибка загрузки.
- Деплой новой версии → при возврате в приложение тост «Доступно обновление» → перезагрузка.
- iOS Safari: баннер с подсказкой; после «На экран „Домой“» — standalone без баннера.
