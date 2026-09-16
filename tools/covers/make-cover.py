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
        print(f"{out} ({out.stat().st_size // 1024} KB, portrait)")
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
    print(f"{out} ({out.stat().st_size // 1024} KB)")


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
