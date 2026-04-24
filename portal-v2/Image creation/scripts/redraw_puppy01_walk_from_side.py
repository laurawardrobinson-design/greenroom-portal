#!/usr/bin/env python3
"""
Redraw Puppy 01 walk from original side profile by preserving the original
upper-body artwork and re-animating legs only.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path("/Users/laura/Portal V2 Fresh/portal-v2/Image creation")
SRC = ROOT / "preview/puppy01-v1-transparent/puppy01-r1c1.png"
OUT_DIR = ROOT / "preview/puppy01-walk-redraw"
BOARD = ROOT / "preview/puppy01-walk-redraw-board.png"
GIF = ROOT / "preview/puppy01-walk-redraw.gif"

W, H = 374, 320


def polygon_mask(size: tuple[int, int], points: list[tuple[int, int]]) -> Image.Image:
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return m


def masked_layer(base: Image.Image, mask: Image.Image) -> Image.Image:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer.paste(base, (0, 0), mask)
    return layer


def sample_color(base: Image.Image, x: int, y: int) -> tuple[int, int, int, int]:
    px = base.load()
    for r in range(0, 8):
        for oy in range(-r, r + 1):
            for ox in range(-r, r + 1):
                xx = min(max(0, x + ox), base.width - 1)
                yy = min(max(0, y + oy), base.height - 1)
                if px[xx, yy][3] > 20:
                    return px[xx, yy]
    return (170, 123, 74, 255)


def gait_leg(phase: float, footfall: float) -> tuple[float, float, float]:
    # Heartbeat cadence.
    t = (phase - footfall) % 1.0
    stance = 0.68
    if t < stance:
        u = t / stance
        angle = math.radians(7.0 - 20.0 * u)
        lift = 0.0
        stride = -8.0 + 16.0 * u
    else:
        u = (t - stance) / (1.0 - stance)
        ease = 0.5 - 0.5 * math.cos(math.pi * u)
        angle = math.radians(-13.0 + 26.0 * ease)
        lift = 11.0 * (math.sin(math.pi * u) ** 1.3)
        stride = 5.5 * math.sin(math.pi * u)
    return angle, lift, stride


def draw_leg(
    d: ImageDraw.ImageDraw,
    shoulder: tuple[float, float],
    angle: float,
    lift: float,
    stride: float,
    color: tuple[int, int, int, int],
    length: float = 114.0,
    top_w: float = 13.0,
    paw_w: float = 18.0,
) -> None:
    sx, sy = shoulder
    dx = math.sin(angle) * length + stride
    dy = math.cos(angle) * length - lift
    fx, fy = sx + dx, sy + dy

    vx = fx - sx
    vy = fy - sy
    mag = max(1e-6, (vx * vx + vy * vy) ** 0.5)
    nx = -vy / mag
    ny = vx / mag

    p1 = (sx + nx * top_w * 0.5, sy + ny * top_w * 0.5)
    p2 = (sx - nx * top_w * 0.5, sy - ny * top_w * 0.5)
    p3 = (fx - nx * paw_w * 0.5, fy - ny * paw_w * 0.5)
    p4 = (fx + nx * paw_w * 0.5, fy + ny * paw_w * 0.5)
    d.polygon([p1, p2, p3, p4], fill=color)
    d.ellipse((fx - paw_w * 0.62, fy - 6, fx + paw_w * 0.62, fy + 8), fill=color)


def build_body_shell(base: Image.Image) -> Image.Image:
    # Preserve original top silhouette and facial details exactly.
    body_poly = [
        (22, 116), (35, 78), (58, 68), (74, 42), (100, 24), (145, 34), (163, 20),
        (190, 30), (220, 36), (208, 64), (194, 78), (180, 92), (168, 110), (155, 124),
        (130, 130), (145, 168), (172, 162), (192, 192), (206, 208), (244, 204), (278, 196),
        (301, 172), (305, 132), (322, 122), (336, 102), (350, 85), (360, 85), (360, 101),
        (347, 118), (333, 130), (306, 132), (257, 132), (212, 126), (176, 122), (150, 130),
        (122, 132), (86, 128), (58, 123), (36, 122),
    ]
    mask = polygon_mask(base.size, body_poly).filter(ImageFilter.MaxFilter(3))
    return masked_layer(base, mask)


def draw_frame(base_body: Image.Image, i: int, frame_count: int, colors: dict[str, tuple[int, int, int, int]]) -> Image.Image:
    p = i / frame_count
    tau = 2.0 * math.pi

    body_x = 1.1 * math.sin(tau * p)
    body_y = 2.0 * math.sin(tau * p * 2.0 + 0.35)

    # Heartbeat order:
    # near hind, near front, far hind, far front.
    hn = gait_leg(p, 0.00)
    fn = gait_leg(p, 0.10)
    hf = gait_leg(p, 0.50)
    ff = gait_leg(p, 0.60)

    frame = Image.new("RGBA", base_body.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(frame)

    # Ground shadow.
    cx = 192 + body_x
    cy = 286 + 0.8 * math.sin(tau * p * 2.0 + 0.7)
    rx = 144 + 6 * math.sin(tau * p * 2.0 + 0.2)
    ry = 18
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=colors["shadow"])

    # Far legs first.
    draw_leg(d, (120 + body_x, 166 + body_y), ff[0], ff[1], ff[2], colors["leg_far"])
    draw_leg(d, (292 + body_x, 199 + body_y), hf[0], hf[1], hf[2], colors["leg_far"])

    # Composite preserved original upper body.
    frame.alpha_composite(ImageChops.offset(base_body, int(round(body_x)), int(round(body_y))))

    # Near legs on top.
    draw_leg(d, (169 + body_x, 167 + body_y), fn[0], fn[1], fn[2], colors["leg_near"])
    draw_leg(d, (244 + body_x, 205 + body_y), hn[0], hn[1], hn[2], colors["leg_near"])

    return frame


def build_board(frames: list[Image.Image]) -> Image.Image:
    cols = 4
    rows = math.ceil(len(frames) / cols)
    pad = 14
    header = 62
    bg = (12, 24, 42, 255)
    mint = (137, 214, 195, 255)
    board = Image.new("RGBA", (pad + cols * (W + pad), header + pad + rows * (H + pad)), bg)
    d = ImageDraw.Draw(board)
    f = ImageFont.load_default()
    d.text((pad, 14), "Puppy 01 Walk Redraw (original side profile body preserved)", fill=(230, 244, 255, 255), font=f)
    d.text((pad, 34), "Legs redrawn with heartbeat gait, seam-free composition", fill=(153, 179, 204, 255), font=f)
    for i, fr in enumerate(frames):
        r, c = divmod(i, cols)
        x = pad + c * (W + pad)
        y = header + pad + r * (H + pad)
        tile = Image.new("RGBA", (W, H), mint)
        tile.alpha_composite(fr, (0, 0))
        board.alpha_composite(tile, (x, y))
        d.rectangle((x, y, x + W, y + H), outline=(88, 112, 138, 255), width=2)
        d.text((x + 8, y + 8), f"f{i:02d}", fill=(236, 249, 255, 255), font=f)
    return board


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    base = Image.open(SRC).convert("RGBA")
    body = build_body_shell(base)

    colors = {
        "leg_near": sample_color(base, 170, 246),
        "leg_far": sample_color(base, 108, 242),
        "shadow": sample_color(base, 192, 286),
    }

    frame_count = 8
    frames: list[Image.Image] = []
    for i in range(frame_count):
        fr = draw_frame(body, i, frame_count, colors)
        fr.save(OUT_DIR / f"walk-{i:02d}.png")
        frames.append(fr)

    build_board(frames).save(BOARD)
    frames[0].save(
        GIF,
        save_all=True,
        append_images=frames[1:],
        duration=110,
        loop=0,
        disposal=2,
    )

    print(f"Wrote frames to {OUT_DIR}")
    print(f"Wrote board {BOARD}")
    print(f"Wrote gif {GIF}")


if __name__ == "__main__":
    main()
