# 10 — PWA: офлайн, установка, иконки, путь в Play Market

## Цель

NEON TAP ведёт себя как приложение на телефоне: ставится на главный экран, открывается без
белой вспышки, играет без интернета, сам сообщает об обновлении. Без библиотек (Workbox и т. п.).

## Что делаем

1. **Service worker** `public/sw.js` — рукописный. Оболочка приложения (`/`, хешированные
   `assets/*`, манифест) прекешируется; список подставляет `scripts/build-sw.ts` после
   `vite build` (плейсхолдеры `__NEON_BUILD__` / `__NEON_PRECACHE__`, версия — sha256 оболочки).
   Медиа (`/music`, `/charts`, `/sfx`, `/voice`, `/icons`) — cache-first с лимитом 200 МБ и
   вытеснением по порядку записи (индекс размеров в самом кеше); `/charts` дополнительно
   обновляются в фоне. `index.html` — network-first. Новая версия ждёт, приложение показывает
   тост «Доступно обновление — обновить» (`widgets/update-toast`); нажатие → `SKIP_WAITING` →
   `controllerchange` → перезагрузка. Регистрация только в production (`app/main.tsx`).
   `vercel.json`: `Cache-Control: no-cache` для `/sw.js` и манифеста.
2. **Установка** — `beforeinstallprompt` перехватывается в `shared/lib/pwa`, баннер
   «Установить приложение» (`widgets/install-banner`) с SVG-иконкой; на iOS Safari — подсказка
   «Поделиться → На экран „Домой“». Отказ запоминается в `localStorage` на 30 дней; в standalone
   баннер не показывается. Определение платформы — чистая функция с тестами.
3. **Иконки** — `scripts/make-icons.ts`: PNG 192 / 512 / maskable 512 / apple-touch 180 из
   RGBA-буфера, кодировщик PNG на `zlib` + свой CRC32 (`scripts/lib/png.ts`), знак
   (четыре неоновые полосы + линия удара, как в `icon.svg`) рисуется процедурно
   (`scripts/lib/icon-render.ts`). `npm run assets:icons` (существующие файлы — только с `--force`).
4. **Standalone** — сплэш в `index.html` (inline CSS: тёмный фон + логотип до первого рендера
   React), запрет зума/жестов в standalone (`installStandaloneGuards`), пауза при
   `visibilitychange` уже есть в `widgets/game-canvas` (AudioContext не приостанавливается).
5. **Android / Play Market** — `docs/android-app.md`: Trusted Web Activity через Bubblewrap,
   `public/.well-known/assetlinks.json` (плейсхолдер SHA-256), подпись, листинг, рейтинг,
   политика конфиденциальности `public/privacy.html`; альтернатива — Capacitor.

## Тесты

`scripts/lib/sw-manifest.test.ts` (сбор списка, хеш, подстановка), `scripts/lib/png.test.ts`
(сигнатура / IHDR / IEND / CRC / распаковка IDAT для 4×4), `scripts/lib/icon-render.test.ts`,
`shared/lib/pwa/platform.test.ts` (платформа, условия показа баннера).
