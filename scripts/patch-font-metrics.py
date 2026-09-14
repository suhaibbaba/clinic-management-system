"""Rewrite Tajawal's vertical metrics into the font files the app ships.

Usage: pip install 'fonttools[woff]' && python3 scripts/patch-font-metrics.py
"""

from pathlib import Path

from fontTools.ttLib import TTFont

SOURCE = Path("apps/web/node_modules/@fontsource/tajawal/files")
TARGET = Path("apps/web/src/fonts")
SUBSETS = ("arabic", "latin")
WEIGHTS = (400, 500, 700)
FORMATS = ("woff2", "woff")

ASCENT = 780
DESCENT = -220
LINE_GAP = 0
USE_TYPO_METRICS = 1 << 7


def patch(font: TTFont) -> None:
    upem = font["head"].unitsPerEm
    if upem != 1000:
        raise SystemExit(f"expected 1000 units per em, found {upem}")

    hhea = font["hhea"]
    hhea.ascender, hhea.descender, hhea.lineGap = ASCENT, DESCENT, LINE_GAP

    os2 = font["OS/2"]
    # Bit 7 is only defined from version 4, and version 3 carries every field version 4 does.
    os2.version = max(os2.version, 4)
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = ASCENT, DESCENT, LINE_GAP
    # usWinAscent/usWinDescent stay at the glyphs' real extents: they are a clipping box on
    # legacy rasterisers, and this bit is what stops them being read as a line height.
    os2.fsSelection |= USE_TYPO_METRICS


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    for subset in SUBSETS:
        for weight in WEIGHTS:
            for fmt in FORMATS:
                name = f"tajawal-{subset}-{weight}-normal.{fmt}"
                font = TTFont(SOURCE / name)
                before = (font["hhea"].ascender, font["hhea"].descender, font["hhea"].lineGap)
                patch(font)
                font.flavor = fmt
                font.save(TARGET / name)
                print(f"{name:34} {before} -> ({ASCENT}, {DESCENT}, {LINE_GAP})")


if __name__ == "__main__":
    main()
