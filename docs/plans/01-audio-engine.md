# Фаза 1 — Скелет и аудиодвижок

## Цель
Vite + React + TS проект в FSD-раскладке; `AudioEngine`, `Clock`, `Conductor` с тестами.

## Задачи
- [x] `package.json`: рантайм-зависимости только `react`, `react-dom`. Тесты — vitest.
- [x] FSD-раскладка `src/{app,pages,widgets,features,entities,shared}` + `eslint-plugin-boundaries` + `scripts/check-fsd.mjs`.
- [x] `shared/lib/audio/AudioEngine.ts` — граф `music → lowpass → musicGain → master`, sfx/voice-шины, `play/pause/resume/stop`, `missEffect()` (lowpass 800 Гц + −40 % громкости на 250 мс).
- [x] `shared/lib/audio/Clock.ts` — `songTime = audioNow − startTime − userOffset`; пауза сдвигает `startTime`.
- [x] `shared/lib/audio/Conductor.ts` — доля/такт/фаза для пульсации фона.
- [x] Тесты: Clock (дрейф 180 с = 0 при аудиочасах, offset, пауза), Conductor.

## Готово когда
Трек играет, `songTime` не дрейфует относительно аудиочасов (по построению — это одни и те же часы).
