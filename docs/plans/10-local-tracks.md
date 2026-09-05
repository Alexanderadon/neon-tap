# 10 — Локальные треки (dev-only)

Автор хочет тестировать игру на своих файлах (в том числе коммерческих), не кладя их ни в git, ни на Vercel.

## Поток данных

```
assets-src/music-local/*.{mp3,ogg,wav,m4a,flac,…}   (gitignored, кроме README.md)
  → npm run assets:local  (scripts/prepare-local.ts)
      id     = slug имени файла (кириллица → латиница): «Noize MC - Лебединое озеро.mp3» → noize-mc-lebedinoe-ozero
      artist / title из «Исполнитель - Название», иначе title = имя файла
      ffmpeg (те же настройки, что assets:music: ≤ 150 с, loudnorm, fade, 128k) → public/local/music/<id>.mp3
      composeChart (тот же пайплайн, что assets:charts)                         → public/local/charts/<id>.json
                                                                                 → public/local/catalog.json
  → рантайм: main.tsx вызывает loadLocalCatalog() → entities/track localCatalogStore
      список треков = mergeCatalogs(CATALOG, local): встроенные, затем локальные с бейджем «ЛОКАЛЬНО»
      loadChart(id) для локального → /local/charts/<id>.json, аудио из chart.audio = local/music/<id>.mp3
```

## Правила для локальных треков

- всегда открыты, не бывают треком дня, не премиум;
- результат пишется в прогресс и историю как у встроенных (`trackId = id`), источник сессии `'local'`;
- в суммы звёзд встроенного каталога и в цели не входят: `shared/lib/local-tracks` хранит реестр локальных id,
  `entities/progress` пропускает их в `totalStars(save)` и в целях (`passed`, `rankS`, `fullCombos`, `stars-20`);
- в онлайн-таблицу не отправляются (`isEligible` только для `'catalog'`);
- `counters.maxTrackStars` («самый сложный встроенный трек») не обновляется.

## Почему `public/local` остаётся внутри `public/`

`npm run dev` отдаёт `public/` как есть — ничего настраивать не нужно. В production-сборке Vite копирует весь
`public/` в `dist/`, поэтому плагин `scripts/vite-local-tracks.ts`:

- после сборки удаляет `dist/local` (`closeBundle`) — в `dist/`, `.vercel/output` и на Vercel локальных файлов нет;
- в `vite preview` отдаёт `public/local` с диска (`configurePreviewServer`), потому что в `dist/` его уже нет.

Дополнительно `public/local` и `assets-src/music-local` — в `.gitignore` и `.vercelignore`.
`scripts/deploy-fresh.sh` грузит только `.vercel/output` (prebuilt), который собирается из `dist/`.

## Тесты

- `shared/lib/local-tracks`: транслитерация/slug, разбор «Artist - Title», реестр id;
- `entities/track`: `mergeCatalogs`, `parseLocalCatalog`, `findTrack` с локальным каталогом, путь `loadChart`;
- `entities/progress`: исключение локальных id из `totalStars` и целей;
- `features/save-result`: локальный трек пишется в прогресс/историю, без дневного бонуса и `maxTrackStars`.
