#!/usr/bin/env python3
"""
Extract 3x3 pose cells from puppy reference sheets.

The input screenshots include an outer white border and internal 3x3 layout.
This script trims the white border, slices the grid, and writes one PNG per pose.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

from PIL import Image


def non_white_bbox(img: Image.Image, white_threshold: int = 245) -> tuple[int, int, int, int]:
    """Return the bounding box of pixels that are not near-white."""
    rgb = img.convert("RGB")
    px = rgb.load()
    width, height = rgb.size

    left = width
    right = -1
    top = height
    bottom = -1

    for y in range(height):
        for x in range(width):
            r, g, b = px[x, y]
            if not (r >= white_threshold and g >= white_threshold and b >= white_threshold):
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)

    if right < left or bottom < top:
        raise ValueError("No non-white pixels found; cannot detect artwork bounds.")
    return (left, top, right + 1, bottom + 1)


def split_grid(img: Image.Image, rows: int = 3, cols: int = 3) -> Iterable[tuple[int, int, Image.Image]]:
    """Yield (row, col, cropped_cell) for each grid cell."""
    width, height = img.size
    for row in range(rows):
        y0 = round(row * height / rows)
        y1 = round((row + 1) * height / rows)
        for col in range(cols):
            x0 = round(col * width / cols)
            x1 = round((col + 1) * width / cols)
            yield row + 1, col + 1, img.crop((x0, y0, x1, y1))


def process_sheet(source: Path, output_root: Path) -> None:
    img = Image.open(source)
    bbox = non_white_bbox(img)
    cropped = img.crop(bbox)

    sheet_name = source.stem
    out_dir = output_root / sheet_name
    out_dir.mkdir(parents=True, exist_ok=True)

    # Save trimmed full sheet for quick visual checks.
    cropped.save(out_dir / f"{sheet_name}-trimmed.png")

    for row, col, cell in split_grid(cropped, rows=3, cols=3):
        cell.save(out_dir / f"pose-r{row}c{col}.png")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract 3x3 pose cells from puppy reference sheets.")
    parser.add_argument(
        "--input",
        nargs="+",
        required=True,
        help="Input PNG files (e.g., references/source_screens/ref-01.png).",
    )
    parser.add_argument(
        "--output-root",
        default="references/pose_grids",
        help="Output directory for extracted poses (default: references/pose_grids).",
    )
    args = parser.parse_args()

    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    for input_path in args.input:
        source = Path(input_path)
        if not source.exists():
            raise FileNotFoundError(f"Input file not found: {source}")
        process_sheet(source, output_root)


if __name__ == "__main__":
    main()
