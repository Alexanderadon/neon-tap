"""
Card cover from a square picture: public/covers/<id>.webp, 730 x 1050 (the deck card's 292 x 420).

A square (or landscape) picture sits in the middle at full width; the space above and below is the
picture's own edge reflected and blurred, darkening towards the card's edge, with the picture
feathered into it, so the card reads as one image in the same colours. A portrait picture (a poster,
aspect below 0.8) simply fills the card, cropped to its shape. Square places (shop, result, duel)
crop the middle back out with object-fit: cover.

  python tools/covers/make-cover.py <picture> <track id> [--out public/covers]
Run through `npm run assets:covers` (assets-src/covers-raw/<id>.png|jpg|webp -> public/covers/<id>.webp).
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

W, H = 730, 1050
BLUR = 26
DARKEN = 0.72
FEATHER = 64


def square(im: Image.Image) -> Image.Image:
    """Centre-crop to a square and fit the card width."""
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    return im.resize((W, W), Image.LANCZOS)


def ramp(height: int, start: int, end: int) -> Image.Image:
    """A vertical L mask running from `start` on the first row to `end` on the last."""
    mask = Image.new("L", (1, height))
    mask.putdata([round(start + (end - start) * y / max(1, height - 1)) for y in range(height)])
    return mask.resize((W, height))


def extension(strip: Image.Image, seam_at_bottom: bool) -> Image.Image:
    """The picture's edge continued: reflected, blurred, darkening away from the seam."""
    ext = strip.transpose(Image.FLIP_TOP_BOTTOM).filter(ImageFilter.GaussianBlur(BLUR))
    dark = ImageEnhance.Brightness(ext).enhance(DARKEN)
    # Mask: 255 = keep the lit version; the row at the seam stays lit, the card's edge is darkest.
    lit = ramp(ext.height, 0, 255) if seam_at_bottom else ramp(ext.height, 255, 0)
    return Image.composite(ext, dark, lit)


def fill(im: Image.Image) -> Image.Image:
    """Scale to cover the card and crop the middle."""
    k = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def make(src: Path, out: Path) -> None:
    src_im = Image.open(src).convert("RGB")
    if src_im.width / src_im.height < 0.8:
        card = fill(src_im)
        out.parent.mkdir(parents=True, exist_ok=True)
        card.save(out, "WEBP", quality=82, method=6)
        print(f"{out} ({out.stat().st_size // 1024} KB, portrait) tint {tint(src_im)} palette {json.dumps(palette(src_im))}")
        return
    pic = square(src_im)
    pad = (H - W) // 2
    card = Image.new("RGB", (W, H))
    card.paste(extension(pic.crop((0, 0, W, pad)), True), (0, 0))
    card.paste(extension(pic.crop((0, W - pad, W, W)), False), (0, pad + W))
    # Under the picture's feathered rows: the picture itself, blurred, so the seam has no step.
    card.paste(pic.filter(ImageFilter.GaussianBlur(BLUR)), (0, pad))
    alpha = Image.new("L", (W, W), 255)
    alpha.paste(ramp(FEATHER, 0, 255), (0, 0))
    alpha.paste(ramp(FEATHER, 255, 0), (0, W - FEATHER))
    card.paste(pic, (0, pad), alpha)
    out.parent.mkdir(parents=True, exist_ok=True)
    card.save(out, "WEBP", quality=82, method=6)
    print(f"{out} ({out.stat().st_size // 1024} KB) tint {tint(src_im)} palette {json.dumps(palette(src_im))}")





def tint(im: Image.Image) -> str:
    """
    The picture's accent for the game's buttons and glows: the most VIVID colour of the middle square,
    weighted by the square root of its area — so a poster's neon title beats its big dark sky — lifted
    to a lightness the button text reads on. A picture with nothing saturated (a snowscape) gets its
    mean colour with the saturation raised, never grey.
    """
    from colorsys import hls_to_rgb, rgb_to_hls

    small = square(im).resize((96, 96), Image.BILINEAR).quantize(32, method=Image.Quantize.MEDIANCUT).convert("RGB")
    counts: dict[tuple[int, int, int], int] = {}
    for px in small.getdata():
        counts[px] = counts.get(px, 0) + 1
    best: tuple[int, int, int] | None = None
    score = 0.0
    for (r, g, b), n in counts.items():
        h, l, s = rgb_to_hls(r / 255, g / 255, b / 255)
        if s < 0.35 or l < 0.18 or l > 0.85:
            continue
        v = (n ** 0.5) * (s ** 2)
        if v > score:
            score, best = v, (r, g, b)
    if best is None:
        mean = small.resize((1, 1), Image.BILINEAR).getpixel((0, 0))
        h, l, s = rgb_to_hls(mean[0] / 255, mean[1] / 255, mean[2] / 255)
        r, g, b = hls_to_rgb(h, 0.62, max(0.45, s))
        return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))
    h, l, s = rgb_to_hls(best[0] / 255, best[1] / 255, best[2] / 255)
    r, g, b = hls_to_rgb(h, min(0.72, max(0.55, l)), max(0.6, s))
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))





def palette(im: Image.Image) -> dict:
    """
    The level's colours from the poster: five vivid lane colours with distinct hues (the poster's own
    neon first; a one-colour poster fills the set by turning its hue), the two darkest common tones as
    the background gradient, the accent (see tint) and the second vivid colour as the glow. Lanes are
    lifted to a lightness / saturation that reads as a tile on the dark field.
    """
    from colorsys import hls_to_rgb, rgb_to_hls

    small = square(im).resize((96, 96), Image.BILINEAR).quantize(32, method=Image.Quantize.MEDIANCUT).convert("RGB")
    counts: dict[tuple[int, int, int], int] = {}
    for px in small.getdata():
        counts[px] = counts.get(px, 0) + 1
    hexs = lambda r, g, b: "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))  # noqa: E731
    vivid = []
    darks = []
    for (r, g, b), n in counts.items():
        h, l, s = rgb_to_hls(r / 255, g / 255, b / 255)
        if l < 0.22:
            darks.append((n, h, l, s))
        if s >= 0.35 and 0.18 <= l <= 0.85:
            vivid.append(((n**0.5) * (s**2), h, l, s))
    vivid.sort(reverse=True)
    lanes: list[tuple[float, float, float]] = []
    for _, h, l, s in vivid:
        if all(min(abs(h - h2), 1 - abs(h - h2)) >= 0.085 for h2, _, _ in lanes):
            lanes.append((h, l, s))
        if len(lanes) == 5:
            break
    if not lanes:
        mean = small.resize((1, 1), Image.BILINEAR).getpixel((0, 0))
        h, l, s = rgb_to_hls(mean[0] / 255, mean[1] / 255, mean[2] / 255)
        lanes.append((h, l, max(0.45, s)))
    # A poster with fewer than five hues: turn the main hue in steps, alternating sides, so the family stays.
    base_h = lanes[0][0]
    step = 0
    while len(lanes) < 5:
        step += 1
        h = (base_h + (0.11 * ((step + 1) // 2)) * (1 if step % 2 else -1)) % 1
        lanes.append((h, lanes[0][1], lanes[0][2]))
    lane_hex = [hexs(*hls_to_rgb(h, min(0.7, max(0.55, l)), max(0.7, s))) for h, l, s in lanes]
    darks.sort(reverse=True)
    top = darks[0] if darks else (0, 0.66, 0.05, 0.2)
    bottom = darks[1] if len(darks) > 1 else top
    bg = [hexs(*hls_to_rgb(top[1], min(0.09, max(0.03, top[2] * 0.5)), min(0.5, top[3]))), hexs(*hls_to_rgb(bottom[1], min(0.12, max(0.04, bottom[2] * 0.6)), min(0.5, bottom[3])))]
    return {"bg": bg, "lanes": lane_hex, "glow": lane_hex[1]}


if __name__ == "__main__":
    argv = sys.argv[1:]
    out_dir = Path("public/covers")
    if "--out" in argv:
        i = argv.index("--out")
        out_dir = Path(argv[i + 1])
        del argv[i : i + 2]
    if len(argv) != 2:
        sys.exit(__doc__)
    make(Path(argv[0]), out_dir / f"{argv[1]}.webp")
