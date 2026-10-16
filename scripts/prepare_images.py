"""Картинки лендинга из исходников генерации → public/img/ (T-550).

    python scripts/prepare_images.py <папка исходников> [имя=файл ...]

По умолчанию для слайда <имя> берётся <имя>.png из папки; «имя=файл» подставляет другой исходник (сравнить варианты).
Главная: home-N.jpg 1920×1080 — обрезка 3:2 → 16:9 (по высоте, точка обрезки — ANCHOR: 0 — сверху, 1 — снизу);
<имя>-m.jpg 1080×2340 — из своей вертикали <имя>-m.png, а пока её нет — временно из середины горизонтали.
Цвет и зерно не трогаем: общий грейд серии — отдельным шагом, когда соберутся все кадры.
"""
import sys
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "img"
SLIDES = ["home-1", "home-2", "home-3"]
ANCHOR = {"home-3": 0.3}   # лицо в верхней трети — режем больше снизу
WIDE, TALL = (1920, 1080), (1080, 2340)


def cover(im: Image.Image, size: tuple[int, int], ay: float = 0.5, ax: float = 0.5) -> Image.Image:
    """Как object-fit: cover — обрезать под пропорцию size и уменьшить/увеличить до size."""
    w, h = im.size
    tw, th = size
    k = max(tw / w, th / h)
    cw, ch = round(tw / k), round(th / k)
    x, y = round((w - cw) * ax), round((h - ch) * ay)
    return im.crop((x, y, x + cw, y + ch)).resize(size, Image.LANCZOS)


def save(im: Image.Image, name: str) -> None:
    path = OUT / name
    im.convert("RGB").save(path, "JPEG", quality=84, optimize=True, progressive=True)
    print(f"{name}: {path.stat().st_size // 1024} КБ")


GALLERY_WIDE, GALLERY_N = (1400, 1200), (1280, 720)   # кадр слева от статьи (центр кадра) и «на весь экран» / телефон
GALLERY_FULL = (1920, 1080)                            # «на весь экран» у кадров со своей полной версией (схемы)


def darken(im: Image.Image, k: float) -> Image.Image:
    """Затемнить под белую подпись: k — доля (0,25 = на четверть темнее)."""
    return Image.blend(im.convert("RGB"), Image.new("RGB", im.size, (0, 0, 0)), k)


def gallery(src: Path) -> list[str]:
    """Кадры галерей: <slug>-<n>.png → a-<slug>-<n>.jpg (1400×1200, на 25 % темнее) и a-<slug>-<n>-n.jpg (1280×720);
    cover.png → cover.jpg и cover-n.jpg (оба темнее — на обложке подпись в любом окне)."""
    made = []
    for f in sorted(src.glob("*-[0-9].png")):
        if f.stem.startswith("home-"):
            continue
        im = Image.open(f)
        name = f"a-{f.stem}"
        save(darken(cover(im, GALLERY_WIDE), 0.25), f"{name}.jpg")
        # у схем своя версия «на весь экран» (<кадр>--full.png): крупнее и в 1920×1080 — мелкий текст не мылится
        full = src / f"{f.stem}--full.png"
        save(cover(Image.open(full), GALLERY_FULL) if full.exists() else cover(im, GALLERY_N), f"{name}-n.jpg")
        made.append(name)
    if (src / "cover.png").exists():
        im = Image.open(src / "cover.png")
        save(darken(cover(im, GALLERY_WIDE), 0.25), "cover.jpg")
        save(darken(cover(im, GALLERY_N), 0.25), "cover-n.jpg")
    return made


def main() -> None:
    src = Path(sys.argv[1])
    pick = dict(a.split("=", 1) for a in sys.argv[2:])
    print("галереи:", ", ".join(gallery(src)))
    for name in SLIDES:
        im = Image.open(src / pick.get(name, f"{name}.png"))
        save(cover(im, WIDE, ANCHOR.get(name, 0.5)), f"{name}.jpg")
        tall = src / pick.get(f"{name}-m", f"{name}-m.png")
        save(cover(Image.open(tall), TALL) if tall.exists() else cover(im, TALL, ANCHOR.get(name, 0.5)), f"{name}-m.jpg")


if __name__ == "__main__":
    main()
