#!/usr/bin/env python3
"""
Generate Puppy 01 walk cycle from the provided 4x4 reference sheet.

Pipeline:
- slice 16 cells,
- remove background to transparent,
- stabilize pose placement on a shared baseline,
- remove tiny disconnected artifacts,
- export walk frames + board + gif.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path("/Users/laura/Portal V2 Fresh/portal-v2/Image creation")
REF_SHEET = ROOT / "references/source_screens/ref-walk-16.jpg"
OUT_DIR = ROOT / "preview/puppy01-walk-v2"
BOARD = ROOT / "preview/puppy01-walk-v2-board.png"
GIF = ROOT / "preview/puppy01-walk-v2.gif"

CANVAS_W, CANVAS_H = 374, 320
GRID_COLS = 4
GRID_ROWS = 4
# Coherent footstep order derived from the stable upper-half references.
# Source indices are from the 4x4 sheet in row-major order.
WALK_ORDER = [0, 4, 5, 6, 2, 1, 3, 7]


def connected_components(mask: np.ndarray) -> list[dict]:
    h, w = mask.shape
    visited = np.zeros((h, w), dtype=bool)
    comps: list[dict] = []
    neighbors = ((1, 0), (-1, 0), (0, 1), (0, -1))

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
                x0 = min(x0, cx)
                x1 = max(x1, cx)
                y0 = min(y0, cy)
                y1 = max(y1, cy)
                for dx, dy in neighbors:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        q.append((nx, ny))

            comps.append(
                {
                    "pixels": pixels,
                    "area": len(pixels),
                    "bbox": (x0, y0, x1, y1),
                }
            )
    return comps


def bbox_gap(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    dx = 0 if ax0 <= bx1 and bx0 <= ax1 else min(abs(ax0 - bx1), abs(bx0 - ax1))
    dy = 0 if ay0 <= by1 and by0 <= ay1 else min(abs(ay0 - by1), abs(by0 - ay1))
    return float((dx * dx + dy * dy) ** 0.5)


def remove_stray_components(frame: Image.Image) -> Image.Image:
    arr = np.array(frame.convert("RGBA"), dtype=np.uint8)
    alpha = arr[:, :, 3] > 8
    comps = connected_components(alpha)
    if not comps:
        return frame

    comps.sort(key=lambda c: c["area"], reverse=True)
    dog = comps[0]
    keep_mask = np.zeros_like(alpha)

    # Keep dog component.
    for x, y in dog["pixels"]:
        keep_mask[y, x] = True

    # Keep likely shadow (large secondary component near dog).
    if len(comps) > 1:
        c = comps[1]
        pix = np.array([arr[py, px, :3] for px, py in c["pixels"]], dtype=np.int16)
        mean_rgb = pix.mean(axis=0)
        shadow_like = (
            abs(float(mean_rgb[0]) - float(mean_rgb[1])) < 14
            and abs(float(mean_rgb[1]) - float(mean_rgb[2])) < 14
            and 95.0 <= float(mean_rgb.mean()) <= 235.0
        )
        if c["area"] >= 320 and bbox_gap(c["bbox"], dog["bbox"]) < 120 and shadow_like:
            for x, y in c["pixels"]:
                keep_mask[y, x] = True

    # Keep meaningful nearby details (e.g. detached tongue pixels), drop tiny far specks.
    for c in comps[2:]:
        near_dog = bbox_gap(c["bbox"], dog["bbox"]) < 40
        if c["area"] >= 90 and near_dog:
            for x, y in c["pixels"]:
                keep_mask[y, x] = True

    arr[~keep_mask] = (0, 0, 0, 0)
    return Image.fromarray(arr, "RGBA")


def defringe_light_edges(frame: Image.Image) -> Image.Image:
    arr = np.array(frame.convert("RGBA"), dtype=np.uint8)
    h, w, _ = arr.shape
    alpha = arr[:, :, 3]
    out = arr.copy()

    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if alpha[y, x] == 0:
                continue
            rgb = arr[y, x, :3].astype(np.int16)
            # Likely white/gray matte fringe from JPG extraction.
            if rgb.mean() < 205 or (rgb.max() - rgb.min()) > 28:
                continue

            edge_touch = False
            neighbors = []
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    yy = y + dy
                    xx = x + dx
                    if alpha[yy, xx] == 0:
                        edge_touch = True
                        continue
                    nrgb = arr[yy, xx, :3].astype(np.int16)
                    if nrgb.mean() < 200:
                        neighbors.append(nrgb)

            if edge_touch and len(neighbors) >= 2:
                out[y, x, :3] = np.median(np.stack(neighbors, axis=0), axis=0).astype(np.uint8)

    return Image.fromarray(out, "RGBA")


def slice_reference_frames(sheet: Image.Image) -> list[Image.Image]:
    w, h = sheet.size
    cw = w // GRID_COLS
    ch = h // GRID_ROWS
    frames: list[Image.Image] = []

    for r in range(GRID_ROWS):
        for c in range(GRID_COLS):
            cell = sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            arr = np.array(cell, dtype=np.int16)

            # Estimate local background from cell borders.
            border = np.concatenate(
                [
                    arr[:10, :, :].reshape(-1, 3),
                    arr[-10:, :, :].reshape(-1, 3),
                    arr[:, :10, :].reshape(-1, 3),
                    arr[:, -10:, :].reshape(-1, 3),
                ],
                axis=0,
            )
            bg = np.median(border, axis=0)
            dist = np.sqrt(((arr - bg) ** 2).sum(axis=2))

            # Soft alpha ramp for anti-aliased extraction from JPG source.
            alpha = ((dist - 10.0) / 18.0 * 255.0).clip(0, 255).astype(np.uint8)
            alpha = np.array(
                Image.fromarray(alpha, "L").filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
            )
            alpha[alpha < 8] = 0

            rgba = np.dstack([arr.clip(0, 255).astype(np.uint8), alpha])
            img = Image.fromarray(rgba, "RGBA")
            bbox = img.getbbox()
            if bbox is None:
                bbox = (0, 0, 1, 1)
            frames.append(img.crop(bbox))

    return frames


def stabilize_frames(frames: list[Image.Image]) -> list[Image.Image]:
    target_w = 326
    target_h = 248
    target_cx = 187
    target_bottom = 292
    out: list[Image.Image] = []

    for frame in frames:
        scale = min(target_w / frame.width, target_h / frame.height)
        nw = max(1, int(round(frame.width * scale)))
        nh = max(1, int(round(frame.height * scale)))
        rz = frame.resize((nw, nh), Image.Resampling.LANCZOS)

        canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        b = rz.getbbox()
        if b is None:
            b = (0, 0, nw, nh)
        cx = (b[0] + b[2]) // 2
        bottom = b[3]
        ox = target_cx - cx
        oy = target_bottom - bottom
        canvas.alpha_composite(rz, (ox, oy))

        cleaned = remove_stray_components(canvas)
        cleaned = defringe_light_edges(cleaned)
        out.append(cleaned)

    return out


def build_board(frames: list[Image.Image]) -> Image.Image:
    cols = 4
    rows = max(1, (len(frames) + cols - 1) // cols)
    pad = 10
    header = 56
    board = Image.new(
        "RGBA",
        (pad + cols * (CANVAS_W + pad), header + pad + rows * (CANVAS_H + pad)),
        (236, 236, 236, 255),
    )
    d = ImageDraw.Draw(board)
    d.text((pad, 16), "Puppy01 Walk v2 (gait-clean 8-frame cycle)", fill=(45, 45, 45, 255))
    d.text((pad, 34), f"Source order: {WALK_ORDER}", fill=(92, 92, 92, 255))

    for i, frame in enumerate(frames):
        r = i // cols
        c = i % cols
        x = pad + c * (CANVAS_W + pad)
        y = header + pad + r * (CANVAS_H + pad)
        board.alpha_composite(frame, (x, y))
        d.rectangle((x, y, x + CANVAS_W, y + CANVAS_H), outline=(186, 186, 186, 255), width=1)
        d.text((x + 8, y + 8), f"f{i:02d}", fill=(118, 118, 118, 255))
    return board


def main() -> None:
    if not REF_SHEET.exists():
        raise FileNotFoundError(f"Missing reference sheet: {REF_SHEET}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(REF_SHEET).convert("RGB")

    sliced = slice_reference_frames(sheet)
    stabilized = stabilize_frames(sliced)
    frames = [stabilized[i] for i in WALK_ORDER]

    # Remove stale frames from older runs so atlas pick-up is deterministic.
    for stale in OUT_DIR.glob("walk-*.png"):
        stale.unlink()

    for i, frame in enumerate(frames):
        frame.save(OUT_DIR / f"walk-{i:02d}.png")

    board = build_board(frames)
    board.save(BOARD)

    frames[0].save(
        GIF,
        save_all=True,
        append_images=frames[1:],
        duration=70,
        loop=0,
        disposal=2,
    )

    print(f"Wrote {len(frames)} frames to {OUT_DIR}")
    print(f"Wrote board {BOARD}")
    print(f"Wrote gif {GIF}")


if __name__ == "__main__":
    main()
