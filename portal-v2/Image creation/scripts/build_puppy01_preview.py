#!/usr/bin/env python3
"""
Build Puppy 01 transparent pose frames + preview board.

This script fixes two issues from naive grid slicing:
1) non-uniform grid boundaries on the source sheet (which can clip tails),
2) green background that should be transparent for animation use.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path("/Users/laura/Portal V2 Fresh/portal-v2/Image creation")
SRC = ROOT / "references/pose_grids/ref-01/ref-01-trimmed.png"
OUT_DIR = ROOT / "preview/puppy01-v1-transparent"
BOARD_PATH = ROOT / "preview/puppy01-v1-transparent-board.png"


def mode_rgb(arr: np.ndarray) -> np.ndarray:
    flat = arr.reshape(-1, 3).astype(np.int64)
    packed = (flat[:, 0] << 16) | (flat[:, 1] << 8) | flat[:, 2]
    vals, counts = np.unique(packed, return_counts=True)
    val = int(vals[np.argmax(counts)])
    return np.array([(val >> 16) & 255, (val >> 8) & 255, val & 255], dtype=np.int32)


def detect_splits(mask: np.ndarray) -> tuple[list[int], list[int]]:
    """Find 3x3 split lines by locating low-foreground valleys near thirds."""
    h, w = mask.shape
    xc = mask.sum(axis=0)
    yc = mask.sum(axis=1)

    def pick(counts: np.ndarray, total: int, target: float) -> int:
        lo = int(max(1, target - total * 0.14))
        hi = int(min(total - 2, target + total * 0.14))
        idx = lo + int(np.argmin(counts[lo:hi]))
        return idx

    x1 = pick(xc, w, w / 3.0)
    x2 = pick(xc, w, 2.0 * w / 3.0)
    y1 = pick(yc, h, h / 3.0)
    y2 = pick(yc, h, 2.0 * h / 3.0)

    # Guard against degenerate ordering in noisy masks.
    if not (0 < x1 < x2 < w):
        x1, x2 = int(w / 3), int(2 * w / 3)
    if not (0 < y1 < y2 < h):
        y1, y2 = int(h / 3), int(2 * h / 3)

    return [0, x1, x2, w], [0, y1, y2, h]


def connected_components(mask: np.ndarray) -> list[dict]:
    """Return components with pixel list + bbox + area."""
    h, w = mask.shape
    visited = np.zeros((h, w), dtype=bool)
    comps: list[dict] = []
    dirs = ((1, 0), (-1, 0), (0, 1), (0, -1))

    for y in range(h):
        for x in range(w):
            if not mask[y, x] or visited[y, x]:
                continue
            q = deque([(x, y)])
            visited[y, x] = True
            pixels: list[tuple[int, int]] = []
            x0 = x1 = x
            y0 = y1 = y

            while q:
                cx, cy = q.popleft()
                pixels.append((cx, cy))
                if cx < x0:
                    x0 = cx
                if cx > x1:
                    x1 = cx
                if cy < y0:
                    y0 = cy
                if cy > y1:
                    y1 = cy

                for dx, dy in dirs:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        q.append((nx, ny))

            comps.append(
                {
                    "pixels": pixels,
                    "bbox": (x0, y0, x1, y1),
                    "area": len(pixels),
                }
            )

    return comps


def remove_corner_overlays(alpha: np.ndarray) -> np.ndarray:
    """Drop watermark/icon components in corners while preserving dog pixels."""
    h, w = alpha.shape
    mask = alpha > 0
    comps = connected_components(mask)
    keep = np.zeros_like(mask)

    max_overlay_area = int(h * w * 0.18)

    for comp in comps:
        x0, y0, x1, y1 = comp["bbox"]
        area = comp["area"]

        top_left = x1 < int(w * 0.45) and y1 < int(h * 0.45)
        top_right = x0 > int(w * 0.55) and y1 < int(h * 0.45)
        bottom_right = x0 > int(w * 0.55) and y0 > int(h * 0.55)
        tiny_noise = area < 10

        should_drop = tiny_noise or ((top_left or top_right or bottom_right) and area < max_overlay_area)
        if should_drop:
            continue

        for px, py in comp["pixels"]:
            keep[py, px] = True

    return np.where(keep, 255, 0).astype(np.uint8)


def trim_alpha(img: Image.Image, pad: int = 18) -> Image.Image:
    bbox = img.getbbox()
    if bbox is None:
        return img
    crop = img.crop(bbox)
    out = Image.new("RGBA", (crop.width + 2 * pad, crop.height + 2 * pad), (0, 0, 0, 0))
    out.alpha_composite(crop, (pad, pad))
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    base = Image.open(SRC).convert("RGB")
    arr = np.array(base).astype(np.int32)
    bg = mode_rgb(arr)

    # Foreground mask for split detection.
    dist2 = ((arr - bg) ** 2).sum(axis=2)
    fg = dist2 > (20**2)
    xs, ys = detect_splits(fg)

    frames: list[tuple[int, int, Image.Image]] = []

    for r in range(1, 4):
        for c in range(1, 4):
            cell = base.crop((xs[c - 1], ys[r - 1], xs[c], ys[r]))
            c_arr = np.array(cell).astype(np.int32)
            c_dist2 = ((c_arr - bg) ** 2).sum(axis=2)
            alpha = np.where(c_dist2 > (24**2), 255, 0).astype(np.uint8)
            alpha = remove_corner_overlays(alpha)

            rgba = np.dstack([c_arr.astype(np.uint8), alpha])
            frame = Image.fromarray(rgba, mode="RGBA")
            frame = trim_alpha(frame, pad=18)

            frame.save(OUT_DIR / f"puppy01-r{r}c{c}.png")
            frames.append((r, c, frame))

    # Build checkerboard preview.
    cw = max(f.width for _, _, f in frames)
    ch = max(f.height for _, _, f in frames)
    pad = 20
    header = 84
    board = Image.new("RGBA", (pad + 3 * (cw + pad), header + pad + 3 * (ch + pad)), (19, 30, 44, 255))
    draw = ImageDraw.Draw(board)
    font = ImageFont.load_default()

    draw.text((pad, 16), "Puppy 01 (v1) - Transparent Pose Frames", fill=(230, 245, 255, 255), font=font)
    draw.text((pad, 40), "No green bg; no clipped tails/backs in grid extraction", fill=(160, 190, 210, 255), font=font)

    for r, c, frame in frames:
        x = pad + (c - 1) * (cw + pad)
        y = header + pad + (r - 1) * (ch + pad)

        checker = Image.new("RGBA", (cw, ch), (45, 55, 70, 255))
        cdraw = ImageDraw.Draw(checker)
        step = 24
        for yy in range(0, ch, step):
            for xx in range(0, cw, step):
                if ((xx // step) + (yy // step)) % 2 == 0:
                    cdraw.rectangle((xx, yy, xx + step - 1, yy + step - 1), fill=(58, 71, 90, 255))

        board.alpha_composite(checker, (x, y))
        board.alpha_composite(frame, (x + (cw - frame.width) // 2, y + (ch - frame.height) // 2))
        draw.rectangle((x, y, x + cw, y + ch), outline=(83, 108, 138, 255), width=2)
        draw.text((x + 8, y + 8), f"r{r}c{c}", fill=(236, 247, 255, 255), font=font)

    board.save(BOARD_PATH)
    print(f"built {BOARD_PATH}")
    print(f"frames {OUT_DIR}")


if __name__ == "__main__":
    main()
