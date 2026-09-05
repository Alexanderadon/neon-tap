# Мобильный чек-лист

Что сделано в потоке «mobile», что проверено в эмуляции (Chrome, Browser pane) и что можно
проверить **только на реальном телефоне**. Дата проверки: 2026-09-05, сборка `feat/mobile`.

## 1. Что реализовано

| Тема | Где | Суть |
|---|---|---|
| Вьюпорт и safe-area | `index.html`, `src/app/styles/global.css`, `src/shared/ui/ui.css` | `viewport-fit=cover`, `user-scalable=no`; `html/body/#root` = `100dvh` (фолбэк `100vh`), `overflow: hidden`, `overscroll-behavior: none`; `env(safe-area-inset-*)` вынесены в `--safe-top/bottom/left/right` и используются экранами, паузой, оверлеями и HUD канваса (`Renderer.readSafeInset`) |
| Скролл только в меню | `.screen` (`ui.css`) | `overflow-y: auto`, `touch-action: pan-y`, `overscroll-behavior: contain` — меню листается, страница нет (нет pull-to-refresh и «резинки») |
| Игра без жестов браузера | `.game-root` (`game-canvas.css`), `GameCanvas.tsx` | `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`; на iOS `user-scalable=no` игнорируется, поэтому `gesturestart` и мультитач-`touchmove` отменяются на время игры |
| Тач-зоны | `features/play-chart/lib/layout.ts` (`touchZoneRect`, `touchZoneWidth`, `touchZonesComfortable`, `MIN_TOUCH_ZONE_PX`), `Renderer.drawTouchZones` | Нижняя половина экрана делится на `lanes` зон **во всю ширину** (не только по области полос — важно в ландшафте). В статическом слое на тач-устройствах: градиентная заливка цветом полосы, разделители зон, полоска «тапай сюда» над home-индикатором. Зона под пальцем подсвечивается (`zoneFill`) вдобавок к лучу полосы |
| Мультитач | `shared/lib/input/PointerLanes.ts` (+ тесты), `Input.ts` | Чистый модуль «указатель → полоса»: два пальца на разных полосах независимы; два пальца на одной полосе — одно нажатие, отпускание по последнему; слайд (`pointermove` в соседнюю зону) = release старой + press новой с `viaMove`; `pointercancel` == `pointerup`; палец, опустившийся мимо поля, игнорируется |
| Ориентация | `shared/lib/viewport/orientation.ts` (`needsRotateHint`), `widgets/orientation-hint` | Оверлей «Поверни телефон» на тач-устройстве в ландшафте при высоте `< 500 px`; игра при этом ставится на паузу (`GameCanvas.onResize`); кнопка «Всё равно продолжить». Десктоп и планшеты (высота ≥ 500) не затрагиваются |
| Экономный режим | `Renderer.fxLevel` / `setFxLevel()`, `ParticlePool.emitScale`, `shared/lib/render/LowFpsDetector.ts`, `settingsStore.fxMode`, `SettingsPanel` | `low`: частиц вдвое меньше, без искр холдов, без басового зума и ударных волн порогов комбо. Настройка `Экономный режим` = авто / вкл / выкл (`fxMode`, дефолт `auto`, санитизируется). `auto`: если средний FPS `< 45` в течение 3 с после отсчёта — переключение в `low` один раз, строка `fx low·auto` в дебаг-оверлее и `console.info` |
| Аудио iOS/Android | `shared/lib/audio/unlock.ts`, `AudioEngine.ensureContext`, `widgets/audio-gate`, `GameCanvas.onVisibility` | см. §3 |
| PWA | `public/manifest.webmanifest`, `public/icons/*`, `index.html` | `display: standalone`, `orientation: portrait`, `theme_color/background_color #05060a`, SVG-иконка + PNG 192/512/maskable-512 + apple-touch-icon 180 (PNG сгенерированы из того же дизайна скриптом на чистом Node, без зависимостей); `<link rel="manifest">`, `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`. Service worker не добавлялся (намеренно) |

Тесты: `PointerLanes.test.ts` (10), `LowFpsDetector.test.ts` (6), `orientation.test.ts` (5),
`layout.test.ts` — блок «touch zones» (портрет/ландшафт, 3/4/5/6 полос, границы зон, клампы),
`Particles.test.ts` — `emitScale`. Всего 105 тестов, `tsc -b`, `npm run lint`, `npm run build` — зелёные.

## 2. Проверено в эмуляции (Chrome, Browser pane, UA Android/Pixel, `pointer: coarse`)

| Вьюпорт | Что проверено | Результат |
|---|---|---|
| 375 × 812 (mobile preset) | Аудио-гейт рендерится по центру, снимается тапом/клавишей; меню: `documentElement.scrollHeight == innerHeight` (страница не скроллится), `.screen` скроллится (2934 px контента), `touch-action: pan-y`, `overscroll-behavior: contain`; кнопки `.btn` ≥ 44 px | OK |
| 375 × 812, игра | `.game-root`: `touch-action: none`, `user-select: none`, `overscroll-behavior: none`, tap-highlight прозрачный; канвас 750 × 1626 (DPR 2); тач-зоны видны (разделители + заливка + полоска внизу); зона под пальцем подсвечивается | OK (скриншоты) |
| 375 × 812, синтетические `PointerEvent` (`pointerType: touch`) через реальные слушатели `Input` | 3 полосы в момент теста: палец 1 в зоне 1 → `0100`; палец 2 в зоне 2 → `0110`; палец 1 уезжает в зону 0 → `1010` (старая полоса отпущена, новая нажата); движение того же пальца вверх (`y < touchZoneTop`) полосу не меняет; палец 3 в зону 0 → `1010`; `pointercancel` пальца 1 → `1010` (полосу держит палец 3); up пальца 3 → `0010`; up пальца 2 → `0000`; down за пределами экрана (`-10, 900`) клампится в зону 0 | OK |
| 768 × 1024 (tablet preset, без touch-эмуляции) | Меню центрировано, страница не скроллится, оверлей поворота отсутствует | OK |
| 740 × 360 (телефон в ландшафте, touch) | Оверлей «Поверни телефон» показан, сессия автоматически на паузе | OK (скриншот) |
| 375 × 812 после поворота назад | Оверлей скрыт, сессия остаётся на паузе до нажатия «Продолжить» | OK |
| FPS-сторож | `FpsMeter.fps` зафиксирован на 30: через 3.0 с `renderer.fx == 'low'`, `particles.emitScale == 0.5`, `lowFps.triggered`, в консоли `[neon-tap] fps < 45 for 3 s → fx level "low" (economy mode: auto)`, оверлей показывает `30 fps` пурпурным | OK |
| Настройки → Экономный режим | Сегменты Авто / Вкл / Выкл переключаются, `localStorage['neon-tap:settings'].fxMode` = `on` → `off` → `auto`; `fxMode: "bogus"` в хранилище после перезагрузки санитизируется в `auto` | OK |
| PWA | `/manifest.webmanifest` 200 `application/manifest+json`, `display standalone`, `orientation portrait`; все 4 иконки и apple-touch-icon — 200; meta `theme-color`, `apple-mobile-web-app-*`, `mobile-web-app-capable`, viewport с `viewport-fit=cover` | OK |

Ограничения эмуляции:

- Планшет в ландшафте с тачем (1024 × 768) эмулятор не даёт (ширина ≥ 768 отключает touch-эмуляцию) — поведение `needsRotateHint(true, 1024, 768) == false` покрыто юнит-тестом.
- `env(safe-area-inset-*)` в эмуляторе = 0 — вёрстка с реальной чёлкой и home-индикатором проверяется на устройстве (§3).
- Клик мышью в mobile-режиме Browser pane зависал (особенность инструмента), поэтому нажатия делались клавиатурой и `element.click()` / синтетическими `PointerEvent` — сами слушатели игры при этом настоящие.

## 3. Аудио на iOS / Android — код-ревью

Цепочка разблокировки (`unlockAudio`, вызывается синхронно из клика по гейту или `keydown`):

1. `audioEngine.ensureContext()` — создаёт `AudioContext({latencyHint: 'interactive'})` и вызывает `resume()` **внутри жеста**. `resume()` обёрнут в `try/catch`: на iOS в состоянии `interrupted` и при автоплей-политике Chrome он может отклониться — это не фатально, гейт просто остаётся.
2. Одно-сэмпловый `BufferSource` (классический анлок iOS Safari).
3. Зацикленный тихий `<audio>` (WAV data-URI, `playsinline`) — переводит аудио-сессию iOS в режим `playback`, чтобы Web Audio было слышно при включённом боковом переключателе «без звука».
4. Подписка на `statechange`, `visibilitychange`, `pageshow`, `focus` → `syncAudioUnlockState()`: стор `audioUnlockStore.unlocked = ctx.state === 'running'`. iOS не всегда шлёт `statechange` для нестандартного состояния `interrupted` (звонок, Siri, переключение приложений), поэтому состояние перечитывается при каждом возврате на страницу.
5. `AudioGate` рендерится, пока `unlocked == false` → после прерывания гейт **появляется снова**, следующий тап снова проходит шаги 1–3.
6. `GameCanvas.onVisibility`: при уходе — `session.pause()`; при возврате — `ensureContext()` (попытка тихо возобновить; если браузер требует жест — гейт уже виден).

Метроном калибровки и SFX после анлока: `CalibrationMeter.start()` вызывает `ensureContext()` и `preloadSfx()` до планирования кликов; `sfxClick(when)` планирует сэмпл `metronome` / `metronome-accent` на аудиочасах через `SampleBank` в `sfxGain → master → destination`; если сэмпл не загрузился — синтезированный фолбэк `fallbackTone` на тех же часах. Гейт стоит в `App` поверх всех экранов, так что на экран калибровки нельзя попасть с неразблокированным контекстом; громкости (`setVolumes`) применяются в гейте сразу после анлока.

Что **нельзя** проверить без устройства — см. §4.

## 4. Проверить на реальном устройстве

- [ ] **Android (средний, напр. Snapdragon 6xx / Helio G, Chrome)**: FPS в дебаг-оверлее на треках ★6–7 с 5 полосами и кругами — цель 60, `worst` < 25 мс; сработал ли авто-`low` (строка `fx low·auto`) и стало ли лучше после него; частицы/искры/зум субъективно не «дёргают».
- [ ] **Android**: `env(safe-area-inset-*)` при жестовой навигации — полоска «тапай сюда» и дебаг-строка выше home-индикатора; HUD (счёт, сердца, прогресс) ниже вырезa камеры.
- [ ] **iOS Safari (iPhone с чёлкой)**: HUD и пауза не под чёлкой; нижняя зона над home-индикатором; в standalone-режиме (иконка на домашнем экране) статус-бар `black-translucent` не перекрывает счёт.
- [ ] **iOS Safari, звук**: гейт → звук слышен при боковом переключателе «без звука» (шаг 3 анлока); входящий звонок / Siri / сворачивание → возврат → гейт появился, тап возвращает звук; метроном калибровки слышен и ровный; SFX попаданий не «съедаются» при 8 нотах/с.
- [ ] **iOS Safari**: пинч-зум и двойной тап в игре не масштабируют страницу (`gesturestart` + мультитач-`touchmove` отменены); в меню скролл списка треков не тянет страницу (нет «резинки»).
- [ ] **Оба**: pull-to-refresh не срабатывает при свайпе вниз от верха меню; долгое нажатие не вызывает контекстное меню/выделение на канвасе.
- [ ] **Мультитач на устройстве**: два больших пальца на соседних зонах (аккорды), слайд большим пальцем в соседнюю зону при 5 полосах (ширина зоны 72–78 px на 360–390 px), два пальца на одной зоне.
- [ ] **Поворот**: ландшафт → оверлей и пауза; обратно → «Продолжить»; «Всё равно продолжить» в ландшафте даёт играбельное поле (зоны во всю ширину).
- [ ] **Bluetooth-наушники**: калибровка даёт 150–300 мс; `latency` в оверлее; автоподстройка не уводит оффсет во время трека; при смене вывода (снять наушники) — перекалибровать.
- [ ] **PWA**: «Добавить на экран „Домой“» на Android (Chrome предлагает установку по манифесту) и iOS (apple-touch-icon 180, заголовок NEON TAP); запуск в standalone — портрет, тёмный splash `#05060a`.
- [ ] **Экономный режим = Вкл** вручную на слабом телефоне — сравнить FPS с «Выкл».

## 5. Математика тач-зон (документация к деливераблу 2)

`touchZoneWidth = viewportWidth / lanes`. Минимальная комфортная ширина цели — 48 px (Material) / 44 pt (HIG):

| Ширина экрана | 3 полосы | 4 полосы | 5 полос | 6 (MAX_LANES) |
|---|---|---|---|---|
| 320 px (iPhone SE 1-го поколения) | 107 | 80 | 64 | 53 |
| 360 px (типичный Android) | 120 | 90 | 72 | 60 |
| 375 px (iPhone SE/8/13 mini) | 125 | 94 | 75 | 63 |
| 390 px (iPhone 12–15) | 130 | 98 | 78 | 65 |

Число полос уменьшать не нужно: даже 6 полос на 320 px дают 53 px ≥ 48. В ландшафте зоны
берутся от полной ширины экрана (не от области полос шириной `max(360, 0.62·h)`), поэтому они
шире полос над ними — `laneAtPoint` и `Renderer.drawTouchZones` используют одну и ту же функцию
`touchZoneRect`. Тест `layout.test.ts › touch zones` фиксирует это для всех перечисленных размеров.
