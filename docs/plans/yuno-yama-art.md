# Юно и Яма — иллюстрации для игры

Основа — четыре картинки в `public/offers/` (1005 × 540 = слот 335 × 180 в 3×): двое чиби-ребят и спящий чёрный котик в наушниках (`limited.webp`).

**Вопрос владельцу:** кто из них Юно, а кто Яма? Ниже они названы по волосам: **Тёмный** и **Белая** (по картинкам — мальчик и девочка; если нет — поправить boy / girl в блоках).

## Блоки промпта (вставлять дословно)

Промпт = `[STYLE] + [STAGE] + [DARK] + [WHITE] + сцена`; если герой один, лишний блок не вставляем.

**[STYLE]** `Chibi anime game illustration, 2.5-head proportions, big expressive eyes, clean thick dark outlines, soft cel shading with glossy highlights, neon accents in gold, cyan and magenta, glowing faceted crystals in cyan and pink, small music-note speech bubbles, high contrast, no text, no letters, no watermark.`

**[STAGE]** `Dark navy-black stage with warm gold light rays and horizontal gold light stripes.`

**[DARK]** `Boy with messy dark brown hair falling over his eyes, black zip-up hoodie with a small white crown emblem on the sleeve, loose beige cargo pants, chunky black-and-white sneakers, big black headphones with a gold music-note icon on each ear cup, holding a black smartphone, calm sleepy expression, gold accent colour.`

**[WHITE]** `Girl with very long straight silver-white hair, black hood with one white stripe across it, white skull hair clip in her bangs, black jacket with white stripes on the sleeves, black pants, black-and-white sneakers, big black headphones with a gold music-note icon, pink-magenta eyes, cheerful energetic expression, magenta accent colour.`

**Прозрачный фон** (пп. 3–7, 9): генераторы не дают альфу — вместо [STAGE] вставить `isolated on a plain solid mid-grey #808080 background, full body, no floor shadow`, потом вырезать фон (remove.bg, Photoshop). Серый, а не белый: иначе пропадут белые волосы.

## Список

| # | Куда | Размер, формат | Фон |
|---|---|---|---|
| 1 | Окно NEON PASS, герой (`public/offers/pass.webp`) | 1005 × 540, 1,86 : 1 | сцена |
| 2 | Карта колоды «+ Своя музыка» | квадрат 1024 → `tools/covers/make-cover.py` → 730 × 1050 | сцена |
| 3 | Помощник обучения, Тёмный: указывает | 512 × 512, 1 : 1 | прозрачный |
| 4 | Помощник обучения, Белая: «класс!» | 512 × 512, 1 : 1 | прозрачный |
| 5 | Результат: победа (3 звезды) | 720 × 720, 1 : 1 | прозрачный |
| 6 | Результат: провал | 720 × 720, 1 : 1 | прозрачный |
| 7 | Результат: новый рекорд | 720 × 720, 1 : 1 | прозрачный |
| 8 | Финал бесконечного режима, корона | 1005 × 540, 1,86 : 1 | сцена |
| 9 | Пустые экраны («Мои дуэли», «Рекорды», свои песни) | 900 × 675, 4 : 3 | прозрачный |
| 10 | Открытие главы | 1005 × 540, 1,86 : 1 | сцена |
| 11 | Магазин, шапка | 1005 × 540, 1,86 : 1 | сцена |
| 12 | Заставка загрузки | 1080 × 1920, 9 : 16 | сцена |

## Сцены (добавить после блоков)

1. **PASS:** `Both kids on a glowing stage; the girl proudly holds up a shiny golden ticket with an infinity symbol, the boy lifts his phone and endless music notes stream out of it and turn into glowing neon tiles, golden sunburst, wide banner, characters left and right, empty centre-top.`
2. **«+ Своя музыка»:** `The boy sits cross-legged holding his phone up, a glowing music file icon above it unfolds into falling neon rhythm tiles; the girl points at a big glowing plus sign, square, characters in the central 60 %.`
3. **Обучение, Тёмный:** `The boy pointing down-right with one finger, friendly half-smile, one headphone ear cup pushed back.`
4. **Обучение, Белая:** `The girl giving a big thumbs up and winking, hair swinging, small sparkle stars around her.`
5. **Победа:** `Both kids jumping with joy, arms up, three golden stars bursting above them, crystals flying.`
6. **Провал:** `The boy sits hugging his knees, a little sad but calm; the girl pats his shoulder and makes a determined fist, "one more try" mood, gentle and supportive.`
7. **Рекорд:** `The girl holds a big shining golden star like a trophy, the boy takes a photo of her with his phone, confetti of cyan and pink crystals.`
8. **Корона:** `Both kids in small golden crowns with a cyan gem, back to back under spotlights, speed lines and neon rings behind, triumphant poses, wide banner.`
9. **Пусто:** `The boy asleep leaning on a big headphone case with the small black cat in headphones curled beside him; the girl waves cheerfully as if inviting a friend.`
10. **Глава:** `Both kids push open a huge neon gate of light bars, gold light pours out, silhouettes of album covers float inside, wide banner.`
11. **Магазин:** `The kids behind a small neon shop counter; the girl presents vinyl records, the boy guards glowing crystals, a golden ticket on the counter, cosy mood, wide banner.`
12. **Заставка:** `Vertical poster: both kids sit on the edge of a glowing stage, legs dangling, sharing one phone, the small black cat in headphones between them, gold rays from above, empty lower third for a loading bar.`

## Три правила постоянства

1. **Референсы.** Каждую генерацию запускать с картинкой-референсом из `public/offers/` (`crystals-m.webp` — лучший вид обоих в полный рост): character reference / image prompt в Midjourney (`--cref`, `--sref`), приложенная картинка в ChatGPT или Gemini с фразой «same two characters, same outfits». Вес средний, иначе копируется поза.
2. **Не менять блоки.** STYLE, DARK и WHITE копировать дословно, менять только сцену; удачный seed записывать и переиспользовать. Генерировать крупнее, уменьшать до размера из таблицы, сохранять в WebP.
3. **Проверка перед приёмом:** золотая нота на обеих парах наушников, череп в чёлке у Белой, белая полоса на капюшоне, корона на рукаве Тёмного, бежевые штаны, чёрно-белые кроссовки, пять пальцев, никакого текста в кадре (надписи ставит интерфейс). Не совпало — перегенерировать.
