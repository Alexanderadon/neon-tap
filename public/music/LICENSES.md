# Asset licenses

## Music

Every built-in track is released under **CC0 1.0 (public domain dedication)** by its author on OpenGameArt.org.
Files were trimmed to ≤ 150 s and loudness-normalised for the game (short loops repeated to reach 90–150 s); no other changes.
Attribution is not required for CC0 — it is listed here out of respect for the authors.

| File | Title | Author | Source | License |
|---|---|---|---|---|
| `midnight-drive.mp3` | Midnight Drive | congusbongus | [OpenGameArt](https://opengameart.org/content/midnight-drive) | CC0 1.0 |
| `city-loop.mp3` | City Loop | wipics | [OpenGameArt](https://opengameart.org/content/city-loop-0) | CC0 1.0 |
| `energetic-electro.mp3` | Energetic Electro Tune | tinyworlds | [OpenGameArt](https://opengameart.org/content/energetic-electro-tune) | CC0 1.0 |
| `neon-hyperdrive.mp3` | Neon Hyperdrive | adiutorium | [OpenGameArt](https://opengameart.org/content/neon-hyperdrive) | CC0 1.0 |
| `robotic-city.mp3` | Robotic City | Section31 | [OpenGameArt](https://opengameart.org/content/robotic-city) | CC0 1.0 |
| `night-prowler.mp3` | Night Prowler | Section31 | [OpenGameArt](https://opengameart.org/content/night-prowler) | CC0 1.0 |
| `black-diamond.mp3` | Black Diamond | joth | [OpenGameArt](https://opengameart.org/content/black-diamond) | CC0 1.0 |
| `dance-field.mp3` | Dance Field | centurionofwar | [OpenGameArt](https://opengameart.org/content/dance-field) | CC0 1.0 |
| `hardstyler.mp3` | Hardstyler | Of Far Different Nature | [OpenGameArt](https://opengameart.org/content/hardstyler) | CC0 1.0 |
| `bouncer.mp3` | Bouncer | Of Far Different Nature | [OpenGameArt](https://opengameart.org/content/bouncer-0) | CC0 1.0 |
| `action-track.mp3` | Action Track | lushogames | [OpenGameArt](https://opengameart.org/content/action-track) | CC0 1.0 |
| `chase.mp3` | Chase | adiutorium | [OpenGameArt](https://opengameart.org/content/chase-2) | CC0 1.0 |
| `mindstream.mp3` | MindStream | DST | [OpenGameArt](https://opengameart.org/content/mindstream) | CC0 1.0 |
| `lunar-arrow.mp3` | Lunar Arrow | mmry | [OpenGameArt](https://opengameart.org/content/lunar-arrow) | CC0 1.0 |
| `cyber-march.mp3` | Cyber March | iamoneabe | [OpenGameArt](https://opengameart.org/content/cyber-march) | CC0 1.0 |
| `the-lab.mp3` | The Lab | tricksntraps | [OpenGameArt](https://opengameart.org/content/free-rhythm-game-music-pack-1) | CC0 1.0 |

## Sound effects

Samples from the **Kenney** CC0 packs, converted to MP3 and peak-normalised (`scripts/prepare-sfx.ts`).

| Pack | License |
|---|---|
| [Kenney — Impact Sounds](https://kenney.nl/assets/impact-sounds) | CC0 1.0 |
| [Kenney — Interface Sounds](https://kenney.nl/assets/interface-sounds) | CC0 1.0 |
| [Kenney — UI Audio](https://kenney.nl/assets/ui-audio) | CC0 1.0 |

| File | Source | Used for |
|---|---|---|
| `sfx/hit-0.mp3` | Kenney — Impact Sounds / `impactGeneric_light_000.ogg` | note hit (round-robin 1/5) |
| `sfx/hit-1.mp3` | Kenney — Impact Sounds / `impactGeneric_light_001.ogg` | note hit (round-robin 2/5) |
| `sfx/hit-2.mp3` | Kenney — Impact Sounds / `impactGeneric_light_002.ogg` | note hit (round-robin 3/5) |
| `sfx/hit-3.mp3` | Kenney — Impact Sounds / `impactGeneric_light_003.ogg` | note hit (round-robin 4/5) |
| `sfx/hit-4.mp3` | Kenney — Impact Sounds / `impactGeneric_light_004.ogg` | note hit (round-robin 5/5) |
| `sfx/miss-0.mp3` | Kenney — Impact Sounds / `impactSoft_heavy_000.ogg` | miss thud (round-robin 1/3) |
| `sfx/miss-1.mp3` | Kenney — Impact Sounds / `impactSoft_heavy_002.ogg` | miss thud (round-robin 2/3) |
| `sfx/miss-2.mp3` | Kenney — Impact Sounds / `impactSoft_heavy_004.ogg` | miss thud (round-robin 3/3) |
| `sfx/combo-break-0.mp3` | Kenney — Impact Sounds / `impactGlass_medium_001.ogg` | combo shatters (1/2) |
| `sfx/combo-break-1.mp3` | Kenney — Impact Sounds / `impactGlass_medium_003.ogg` | combo shatters (2/2) |
| `sfx/metronome.mp3` | Kenney — Interface Sounds / `click_001.ogg` | calibration metronome |
| `sfx/metronome-accent.mp3` | Kenney — Interface Sounds / `drop_001.ogg` | calibration metronome downbeat |
| `sfx/milestone.mp3` | Kenney — Interface Sounds / `confirmation_002.ogg` | combo milestone chime |
| `sfx/ui.mp3` | Kenney — UI Audio / `click2.ogg` | button click |
| `sfx/rank.mp3` | Kenney — Interface Sounds / `confirmation_001.ogg` | result screen rank reveal |

## Voice

Russian voice lines in `public/voice/<voice>/` were synthesised with Microsoft neural TTS voices
**ru-RU-DmitryNeural** and **ru-RU-SvetlanaNeural** through the open-source `msedge-tts` client (`scripts/generate-voice.ts`),
then silence-trimmed and loudness-normalised. The voices belong to Microsoft; the generated clips are used here
in a non-commercial portfolio project. A Web Speech API fallback is used when the clips cannot be loaded.
