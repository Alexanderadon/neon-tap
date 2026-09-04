# Фаза 3 — Визуал и juice

## Задачи
- [x] `shared/lib/render/neon.ts` — предрендер glow-спрайтов нот/лучей/точек в offscreen-canvas при `resize()`. В кадре `shadowBlur` = 0.
- [x] `shared/lib/render/Particles.ts` — пул 300 частиц в `Float32Array` (SoA), без аллокаций.
- [x] `shared/lib/render/Effects.ts` — shake ≤ 4 px, вспышка полосы 80 мс, FPS-метр.
- [x] `features/play-chart/lib/Renderer.ts` — статический слой (полосы, хит-лайн, виньетка) рисуется один раз; комбо с масштабом `32 + min(combo,500)·0.06` и цветами 50/100/250/500; пульсация фона по фазе доли.
- [x] Глитч-переход между экранами — CSS `clip-path` keyframes, 200 мс.
- [x] Дебаг-оверлей: fps, worst frame, видимые ноты, частицы, latency, songTime.
- [x] Звук: `shared/lib/audio/SampleBank` — банк декодированных сэмплов с round-robin группами; `sfx.ts` играет CC0-сэмплы с синтезированным фолбэком.

## Готово когда
60 FPS при 40 нотах на экране на throttled CPU 4×. Проверка — вручную в DevTools (см. фаза 8).
