"""Generate NeedShare PNG icons from the SVG reference geometry.

The script avoids third-party dependencies so it can run in constrained
build environments. It procedurally recreates the three doorway motif and
can either write square PNGs in a few target sizes or emit ready-to-paste
``data:image/png`` URIs for embedding directly in HTML and manifest files.
"""
from __future__ import annotations

import argparse
import base64
import struct
from pathlib import Path
import zlib
from typing import Dict, Iterable, Tuple

Color = Tuple[int, int, int, int]

COLORS: Dict[str, Color] = {
    "background": (0xFB, 0xF7, 0xFF, 0xFF),
    "left": (0x5F, 0x65, 0xB5, 0xFF),
    "middle": (0xE1, 0x9B, 0xD9, 0xFF),
    "right": (0x8F, 0xE1, 0xB5, 0xFF),
}


def _door_color(x24: float, y24: float) -> Color:
    """Return the icon color for a given point in the 24×24 coordinate space."""
    doors = (
        (6.0, COLORS["left"]),
        (12.0, COLORS["middle"]),
        (18.0, COLORS["right"]),
    )
    for center_x, color in doors:
        offset = center_x - 6.0
        left_edge = 3.0 + offset
        right_edge = 9.0 + offset
        if left_edge <= x24 <= right_edge:
            if 10.0 <= y24 <= 17.0:
                return color
            if y24 < 10.0:
                dx = x24 - center_x
                dy = y24 - 10.0
                if dx * dx + dy * dy <= 9.0 and y24 >= 7.0:
                    return color
    return COLORS["background"]


def _render_png(size: int) -> bytes:
    width = height = size
    scale = size / 24.0
    rows = bytearray()
    for y in range(height):
        rows.append(0)  # filter type None
        y24 = (y + 0.5) / scale
        for x in range(width):
            x24 = (x + 0.5) / scale
            rows.extend(_door_color(x24, y24))
    compressed = zlib.compress(bytes(rows), level=9)

    def chunk(chunk_type: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + chunk_type
            + data
            + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png_parts = [b"\x89PNG\r\n\x1a\n", chunk(b"IHDR", ihdr), chunk(b"IDAT", compressed), chunk(b"IEND", b"")]
    return b"".join(png_parts)


def _write_png(path: Path, png: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def _targets(output_dir: Path) -> Iterable[Tuple[Path, int]]:
    return (
        (output_dir / "needshare-touch-180.png", 180),
        (output_dir / "needshare-icon-192.png", 192),
        (output_dir / "needshare-icon-512.png", 512),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate NeedShare PNG icons")
    parser.add_argument(
        "--write",
        action="store_true",
        help="write PNG files alongside printing data URIs",
    )
    parser.add_argument(
        "--output-dir",
        default="icons",
        help="directory to hold generated PNG files when --write is supplied",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    for path, size in _targets(output_dir):
        png = _render_png(size)
        if args.write:
            _write_png(path, png)
            print(f"Wrote {path} ({size}x{size})")
        data_uri = base64.b64encode(png).decode("ascii")
        print(f"{path.name}: data:image/png;base64,{data_uri}")


if __name__ == "__main__":
    main()
