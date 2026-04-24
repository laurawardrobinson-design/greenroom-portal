#!/usr/bin/env python3
"""
Pack Puppy 01 frames into a spritesheet atlas + JSON manifest.

Includes:
- base pose frames (r1c1..r3c3),
- reference-driven walk frames discovered from preview/puppy01-walk-v2/walk-*.png.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image


ROOT = Path("/Users/laura/Portal V2 Fresh/portal-v2/Image creation")
POSES_DIR = ROOT / "preview/puppy01-v1-transparent"
WALK_DIR = ROOT / "preview/puppy01-walk-v2"
ATLAS_PATH = ROOT / "preview/puppy01-atlas.png"
JSON_PATH = ROOT / "preview/puppy01-atlas.json"


def frame_sources() -> list[tuple[str, Path]]:
    items: list[tuple[str, Path]] = []

    # 9 source poses.
    for r in range(1, 4):
        for c in range(1, 4):
            fid = f"r{r}c{c}"
            items.append((fid, POSES_DIR / f"puppy01-{fid}.png"))

    walk_paths = sorted(
        WALK_DIR.glob("walk-*.png"),
        key=lambda p: int(re.search(r"walk-(\d+)\.png$", p.name).group(1)) if re.search(r"walk-(\d+)\.png$", p.name) else 10_000,
    )
    for path in walk_paths:
        m = re.search(r"walk-(\d+)\.png$", path.name)
        if m is None:
            continue
        idx = int(m.group(1))
        fid = f"walk{idx:02d}"
        items.append((fid, path))

    return items


def build() -> None:
    loaded: list[tuple[str, Image.Image, Path]] = []
    for fid, path in frame_sources():
        if not path.exists():
            raise FileNotFoundError(f"Missing frame: {path}")
        loaded.append((fid, Image.open(path).convert("RGBA"), path))

    cell_w = max(img.width for _, img, _ in loaded)
    cell_h = max(img.height for _, img, _ in loaded)
    pad = 8
    cols = 6
    rows = (len(loaded) + cols - 1) // cols

    atlas_w = pad + cols * (cell_w + pad)
    atlas_h = pad + rows * (cell_h + pad)
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))

    frames: dict[str, dict] = {}
    for idx, (fid, img, source_path) in enumerate(loaded):
        row = idx // cols
        col = idx % cols
        x = pad + col * (cell_w + pad)
        y = pad + row * (cell_h + pad)
        draw_x = x + (cell_w - img.width) // 2
        draw_y = y + (cell_h - img.height) // 2
        atlas.alpha_composite(img, (draw_x, draw_y))

        frames[fid] = {
            "frame": {"x": draw_x, "y": draw_y, "w": img.width, "h": img.height},
            "cell": {"x": x, "y": y, "w": cell_w, "h": cell_h},
            "source": str(source_path.relative_to(ROOT)),
        }

    walk_ids = [fid for fid in frames.keys() if fid.startswith("walk")]
    walk_ids.sort(key=lambda x: int(x.replace("walk", "")))

    run_ids = [fid for fid in ["walk01", "walk03", "walk05", "walk07"] if fid in walk_ids]
    if not run_ids and walk_ids:
        step = max(1, len(walk_ids) // 4)
        run_ids = walk_ids[::step][:4]

    animations = {
        "idle": {
            "frames": ["r1c1", "r1c1"] + ([walk_ids[0]] if walk_ids else ["r1c1"]) + ["r1c1"],
            "fps": 4,
            "loop": True,
            "notes": "Light idle hold with tiny movement from walk frame 00.",
        },
        "walk": {
            "frames": walk_ids,
            "fps": 12,
            "loop": True,
            "notes": "Walk cycle generated from user-provided 16-frame reference sheet.",
        },
        "run": {
            "frames": (["r2c3"] + run_ids + ["r2c3"]) if run_ids else ["r2c3", "r2c3"],
            "fps": 13,
            "loop": True,
            "notes": "Provisional run cadence using selected walk extremes.",
        },
    }

    manifest = {
        "meta": {
            "name": "puppy01",
            "version": "v3",
            "image": str(ATLAS_PATH.relative_to(ROOT)),
            "generatedBy": "scripts/build_puppy01_atlas.py",
            "cellSize": {"w": cell_w, "h": cell_h},
            "atlasSize": {"w": atlas_w, "h": atlas_h},
            "padding": pad,
        },
        "frames": frames,
        "animations": animations,
        "poseMap": {
            "r1c1": "side_stand",
            "r1c2": "scratch",
            "r1c3": "back_view",
            "r2c1": "lying_down",
            "r2c2": "front_yawn",
            "r2c3": "run_leap",
            "r3c1": "angry_step",
            "r3c2": "eat_bowl",
            "r3c3": "stretch",
        },
    }

    atlas.save(ATLAS_PATH)
    JSON_PATH.write_text(json.dumps(manifest, indent=2))

    print(f"Wrote {ATLAS_PATH}")
    print(f"Wrote {JSON_PATH}")


if __name__ == "__main__":
    build()
