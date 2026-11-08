#!/usr/bin/env python3
"""Generates build/icon.png (1024) and build/icon.ico from scratch.

Style matches the app: monospace, black and white, nothing extra.
Requires Pillow and the Courier New Bold font (ships with macOS/Windows).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "build"
FONT = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"
SS = 2  # supersampling factor
SIZE = 1024 * SS

BG = (17, 17, 17, 255)  # same as the dark theme background
FG = (255, 255, 255, 255)

TEXT = "D2000"
FONT_SIZE = 236 * SS
TRACKING = -14 * SS  # tight, like the .brand letter-spacing in the UI


def squircle_mask() -> Image.Image:
    # macOS icon grid: 824x824 tile in a 1024 canvas, corner radius ~ 22.5%
    tile = 824 * SS
    margin = (SIZE - tile) // 2
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (margin, margin, margin + tile - 1, margin + tile - 1),
        radius=int(tile * 0.225),
        fill=255,
    )
    return mask


def render() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    img.paste(Image.new("RGBA", (SIZE, SIZE), BG), mask=squircle_mask())
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, FONT_SIZE)

    advance = font.getlength("0") + TRACKING
    text_w = advance * len(TEXT) - TRACKING
    x0 = (SIZE - text_w) / 2
    # center the whole group (cap height + gap + cursor bar) vertically
    cap_h = -font.getbbox("D", anchor="ls")[1]
    gap, bar_h = 62 * SS, 32 * SS
    group_h = cap_h + gap + bar_h
    baseline = (SIZE - group_h) / 2 + cap_h + 26 * SS  # optical nudge: text is the visual mass
    for i, ch in enumerate(TEXT):
        draw.text((x0 + i * advance, baseline), ch, font=font, fill=FG, anchor="ls")

    # terminal cursor under the text, aligned with the left edge of the text
    bar_w = advance * 1.0
    bar_y = baseline + gap
    draw.rectangle((x0, bar_y, x0 + bar_w, bar_y + bar_h), fill=FG)
    return img


def main() -> None:
    big = render().resize((1024, 1024), Image.LANCZOS)
    big.save(OUT / "icon.png")
    sizes = [16, 24, 32, 48, 64, 128, 256]
    big.save(OUT / "icon.ico", sizes=[(s, s) for s in sizes])
    print("written", OUT / "icon.png", OUT / "icon.ico")


if __name__ == "__main__":
    main()
