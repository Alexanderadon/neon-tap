# Фаза 9 — Рекорды: история попыток и онлайн-таблица

## Задачи
- [x] `entities/history` — каждая завершённая попытка (в т.ч. провал) по треку: `{at, score, accuracy, rank, maxCombo, failed}`,
  новые сверху, не больше 50 на трек, `localStorage` `neon-tap:history` v1. Селекторы: попытки, лучший результат,
  тренд точности (дельта за последние 5), число попыток. Пишется из `features/save-result` (своя музыка не пишется).
- [x] `widgets/history-panel` — личный рекорд, список попыток, sparkline точности (inline SVG без библиотек), стрелка тренда.
  Открывается по ссылке «Рекорды» на карточке трека (`TrackList` → `MenuPage` → `HistoryModal`).
  На экране результата — строка «Попытка №N · лучший результат … · тренд ↑/↓» под таблицей (`ResultBreakdown.belowGrid`).
- [x] `shared/ui/Modal` — минимальный доступный модал: `role=dialog`, Esc, клик по подложке, ловушка Tab, возврат фокуса.
- [x] `api/scores.ts` — Vercel serverless (Node, без зависимостей): `GET ?track=` → топ-20, `POST` → валидация + Upstash Redis
  (sorted set на трек, топ-100, лучший результат на ник, REST API через `fetch`). Без env → `{enabled:false}`.
  Rate limit по IP в памяти. Чистые хелперы в `api/_lib/scores.ts` с тестами (`tsconfig.api.json`, vitest include).
- [x] `shared/api/leaderboard` — обёртка над fetch: один probe на сессию, никогда не бросает.
- [x] `features/submit-score` — ник спрашивается один раз (диалог), хранится в настройках `nickname`, отправка на экране
  результата для встроенных треков без провала.
- [x] `widgets/online-leaderboard` — секция «Онлайн-рекорды»: топ-10 и своё место; без бэкенда секция скрыта
  (подсказка про env-переменные только при включённом debug overlay).

## Настройка бэкенда
В проекте Vercel задать `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN` (Upstash → Redis → REST API).
Без них сайт работает как раньше, таблица не показывается.
