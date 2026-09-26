🇬🇧 English · [🇷🇺 Русский](README.ru.md)

# NEON TAP

[![CI](https://github.com/Alexanderadon/neon-tap/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Alexanderadon/neon-tap/actions/workflows/ci.yml)

**Play: https://neon-tap-virid.vercel.app** — runs in the browser, no install, works on phones.

A browser rhythm game with 3–5 lanes that **generates a note chart from any MP3 by itself**. The player drops a file into the window — in about 1–2 seconds the engine runs it through its own FFT, a spectral-flux onset detector, autocorrelation tempo estimation and a beat tracker, places notes on the actual hits in the music and adds mechanics based on its structure: holds and slides on sustained sounds, rolls on fills, circles at the start of a chorus, lane-count changes per phrase. One chart per song — the difficulty (★ 1–10) is decided by the song itself. The file never leaves the browser.

The game loop, audio, judging and signal analysis are written from scratch in TypeScript on top of the Web Audio API and Canvas 2D. React is used only for the menus. Runtime dependencies: `react`, `react-dom`.

<!-- Gameplay GIF: docs/gameplay.gif -->

## Technical decisions

### 1. Timing — audio clock only

The single source of time for notes is `audioContext.currentTime`. `requestAnimationFrame` draws, but never decides whether the player hit or missed.

```ts
// src/shared/lib/audio/Clock.ts
songTime() { return audioNow() - startTime - userOffset; }
```

Why not `performance.now()`: the sound card has its own crystal. The drift against the system clock accumulates and after 30–60 seconds becomes an audible desync. The audio clock does not drift relative to itself by definition. Keyboard/touch event timestamps are translated from the `performance.now()` domain into audio time, corrected for the event's age, so that JS handler latency is not counted against the player.

### 2. Automatic chart generation

```
AudioBuffer → mono 22 050 Hz → STFT (Hann 1024, hop 512)
  → spectral flux per band 20–250 / 250–2000 / >2000 Hz → onsets
  → envelope autocorrelation 60–220 BPM → tempo (+ octave check)
  → beat tracker (DP, Ellis 2007): beats on real hits, even spacing, no drift
  → 16th-note grid between beats: hit strength, frequency band, sustain per slot
  → the figure of each 4-bar phrase: a per-step rhythm profile, its peaks are the pattern the ear hears
    ("ta ta TA") — every bar of the phrase repeats it where it actually sounds; accents become chords,
    very strong off-pattern hits (fills, stabs) are added; note budget by bar intensity, up to 5.5 notes/s
    in energetic choruses, two thumbs
  → holds on sustained sounds (some become slides into the neighbouring lane), rolls on fills and phrase-end
    streams, circle windows at chorus starts with a circle on every pattern hit (dozens in a row), spells
  → sections with 2–6 lanes by phrase energy (every 4 bars in energetic songs) → one chart, ★ 3–9
```

The whole pipeline lives in `src/shared/lib/analysis` with no DOM access, so the same code runs in a Web Worker for user files and in Node for the built-in tracks (`npm run assets:charts`). On a synthetic signal the detector finds ≥ 90 % of hits within a ±30 ms window, the beat tracker lands on every click within 30 ms, and a 128 BPM tempo is detected within ±2 (tests in `analysis.test.ts`). A 150-second track is analysed in about 1.5 s.

Gameplay on top of that: taps, holds, **slides** (the finger moves into the neighbouring lane), **rolls** (several presses for one note, no faster than 6/s), osu!-style **circles** (tap a circle on screen, in windows without regular notes), 5 hearts (miss −1, a streak of 25 hits +1, zero = fail), a "slow-down" spell that slows both the music and the notes (playbackRate + tape effect), a "heart" spell for +1 life, touch assist on phones (a press up to 0.4 s early still counts), automatic latency adjustment from the player's hits, per-song note speed (3.5 beats of approach). The lane count changes per phrase: dividers and receptors physically spread apart or merge.

### 3. Rendering: 60 FPS with no per-frame allocations

- Glow for notes, beams and particles is pre-rendered into offscreen canvases at init; in the game loop `shadowBlur` = 0. On mobile, `shadowBlur` in the frame cuts FPS by 3–4×.
- Static content (lanes, hit line, vignette) is a separate layer drawn with a single `drawImage`.
- Notes — a pool of 2000 objects with per-lane cursors; particles — a `Float32Array` (SoA) of 300 elements.
- The debug overlay (settings → FPS) shows fps, worst frame, visible note count and output latency.

### 4. Latency: subtracted, then learned from the taps

Audio output latency: desktop 20–60 ms, Android 80–200 ms, Bluetooth up to 300 ms. The device latency the browser reports (`outputLatency + baseLatency`) is subtracted from the clock every frame. What is left — Safari reports nothing, Bluetooth adds 150–250 ms, plus reaction and touch — the game learns on its own: a wide probe (`features/play-chart/model/offsetProbe.ts`) takes every press within ±300 ms of a note of its lane (in the tutorial on the single-lane steps, in runs only on notes with nothing else pressed in their lane nearby), and once 8 presses agree (median absolute deviation ≤ 60 ms) their median becomes `audioOffsetMs` — before the first track; later it moves only on a disagreement of 40 ms or more. The in-run learner then fine-tunes from the hits (±80 ms per run, ±250 ms in total). The calibration screen (settings → «Подстройка»: a 120 BPM metronome on a look-ahead scheduler, 16 taps, median deviation) is optional; saving it turns the probe off.

### 5. What v2 added

- **Tutorial** — an interactive first run (opens itself on first launch, once; "Tutorial" in the menu or "Replay the tutorial" in settings): a hand-written chart `public/charts/tutorial.json` (beat plan in `scripts/gen-tutorial.mjs`, `npm run chart:tutorial`) on the beat grid of Apparatus Overlord, nine steps in ~40 s and only what chapter 1 has — taps and holds on a single lane "like Magic Tiles", then 2 → 3 → 4 lanes and a heart; a tap, hold or two-lane step with no hit at all rewinds once (`GameSession.rewind`); the «Готово!» frame gives +20 crystals the first time and goes straight into the first track; the latency is learned on the way. Slides, rolls, circles and the spinner are introduced by a card the first time a run meets them. Animated SVG step icons, keyboard and finger hints, no hearts and no fail (`features/tutorial`, `widgets/tutorial-overlay`, `pages/tutorial`).
- **Progression** — the first 5 tracks are unlocked, the rest gated by star thresholds; a **track of the day** (deterministic by date) gives +1 ★ and 10 crystals once a day and builds a streak; **97 badges** in 15 families paying crystals (never stars), a daily crystal allowance and a login calendar with no penalty for a missed day. Save format v6 with migrations (`entities/progress`).
- **Records** — an attempt history with an accuracy sparkline on every card ("Records"), an optional online leaderboard (see below).
- **Result screen** — the judgement timeline is written into typed arrays directly in the game loop; from it: a "where the misses are" strip across the whole song, an accuracy/combo graph, best streak and weakest spot, a **replay of the best moment** (a mini playfield on canvas) and a 1080×1350 card for "Share" / copy (`entities/score/lib/resultStats`, `widgets/result-breakdown`).
- **Mobile** — safe-area (notch and home indicator), touch zones with finger highlight, multitouch via `PointerLanes`, a "rotate your phone" hint with pause, **economy mode** (automatic: FPS < 45 for three seconds → fewer particles and background effects), PWA manifest and icons. Checklist — `docs/mobile-checklist.md`.
- **App** — a hand-written service worker with no libraries (`public/sw.js`): the shell is precached from a list that `scripts/build-sw.ts` injects after the build, music/charts/sounds/covers are cached on first use with a 260 MB cap, so played tracks work offline; an "Update available" toast on a new version; an "Install the app" banner (Android/desktop: the system dialog, iOS: a "Share → Add to Home Screen" hint); a dark splash before the first frame, no zoom or gestures when installed. PNG icons come from a pure-Node PNG encoder (`npm run assets:icons`). Google Play via Trusted Web Activity — `docs/android-app.md`; privacy policy — `/privacy.html`.
- **Content** — 44 tracks (5 of them premium, sold in the shop for crystals; from 5 October 2026 a new track every Monday — «Новинка недели»), genre in the registry and in the chart, **procedural covers** (SVG from the id hash + genre palette/motif, `entities/track/ui/TrackCover`).
- **Feel** — a visual theme per track (by genre or deterministically by id: lane palette, accent, background motif), background synced to the music (pulse on beats from the chart + spectrum from an AnalyserNode, one read per frame), animated menu and cards.

## Architecture

Feature-Sliced Design: `app → pages → widgets → features → entities → shared`. Import direction and slice public APIs are enforced by `eslint-plugin-boundaries` and `scripts/check-fsd.mjs` in CI.

```
src/
├── app/         screen router
├── pages/       menu · game · result · calibration · settings · custom · tutorial
├── widgets/     track-list · goals-panel · game-canvas · tutorial-overlay · result-breakdown · history-panel · online-leaderboard · song-drop-zone · audio-gate · calibration-meter · settings-panel · install-banner · update-toast
├── features/    play-chart · generate-chart · calibrate-offset · save-result · submit-score · track-progress · voice-feedback · tutorial
├── entities/    track · chart · score · progress · history · settings · play-session
└── shared/lib/  audio · analysis · render · input · store · router · pwa
public/sw.js     service worker (app shell + media cache); the asset list is injected by scripts/build-sw.ts
api/             scores.ts — Vercel serverless function for the online leaderboard (Node, no dependencies); api/_lib — pure helpers with tests
```

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run lint       # eslint + FSD check
npm run build
```

Asset pipeline (only needed to rebuild content): `npm run assets:music`, `assets:sfx`, `assets:voice`, `assets:drops` (the weekly schedule in `assets-src/drops.json`), `assets:charts` (also writes the app copy of the schedule), `assets:licenses`. Deploy: `bash scripts/deploy-fresh.sh <project-name>` (local build → new Vercel project → domain transfer).

### Records and online leaderboard

Duels (`api/duels.ts`): "Challenge a friend" on the result screen hosts a duel — the run behind a short id — and shares the link `/?duel=<id>`; the friend lands on the challenge screen, plays the same track and the result screen says who is ahead; replies are kept per duel (best per name) for 30 days and listed under "My duels" in the profile. Same Upstash Redis variables as the records; without them the button reports a failure.

The attempt history (score, accuracy, rank, trend) is stored locally in `localStorage` and opens via the "Records" link on a track card. The online leaderboard is optional: `api/scores.ts` keeps a top-100 per track in Upstash Redis via its REST API. To enable it, set the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` variables in the Vercel project (Upstash → database → REST API). Without them the function responds with `{ enabled: false }` and the "Online records" section is simply not shown. The nickname is asked once on the result screen and can be changed in settings.

## Music licenses

Of the 44 built-in tracks (synthwave, techno, trance, house, hardstyle, hardcore, breakbeat, eurobeat, synthpop, chiptune, lo-fi, rock, metal, orchestral, jazz-funk, drum & bass, ambient, acoustic, ethnic) 41 are **CC0 1.0** from OpenGameArt.org and the three of the rock pack are **CC BY 4.0** from the Free Music Archive; authors and links are in [`public/music/LICENSES.md`](public/music/LICENSES.md). Sound effects are CC0 samples from Kenney packs (note hits are round-robin from 5 variations to avoid a "machine gun" effect). Voice-over uses the neural ru-RU Svetlana voice and can be turned off in settings. Source registries are `assets-src/tracks.json` and `assets-src/sfx.json`; both the files and the license report are generated from them by scripts.

Songs in "My music" are processed in the browser and kept only on the device (IndexedDB); nothing is uploaded anywhere.

## Documents

- [GDD.md](GDD.md) — game design document: retention mechanics, references, progression, chart format, analysis pipeline
- [docs/plans/](docs/plans/) — phase-by-phase plan
- [docs/mobile-checklist.md](docs/mobile-checklist.md) — what was verified in emulation and what remains for a real device
- [docs/android-app.md](docs/android-app.md) — publishing to Google Play: Trusted Web Activity (Bubblewrap), assetlinks, signing, listing; Capacitor as the alternative

## License

- Code — [MIT](LICENSE).
- Music — CC0 1.0 and CC BY 4.0 (the rock pack), sound effects — CC0 1.0; authors and sources in [`public/music/LICENSES.md`](public/music/LICENSES.md).
