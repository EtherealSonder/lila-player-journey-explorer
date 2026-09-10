from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops


PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATASET_ROOT = (
    PROJECT_ROOT
    / "raw-data"
    / "extracted"
    / "player_data"
)

MINIMAPS_DIR = DATASET_ROOT / "minimaps"

REPORTS_DIR = PROJECT_ROOT / "reports"

OUTPUT_PATH = REPORTS_DIR / "minimap_audit.json"


EXPECTED_MAP_FILES = {
    "AmbroseValley": "AmbroseValley_Minimap.png",
    "GrandRift": "GrandRift_Minimap.png",
    "Lockdown": "Lockdown_Minimap.jpg",
}


def inspect_alpha_bounds(image: Image.Image) -> dict:
    """
    Inspect alpha-based content bounds.

    For images without an alpha channel, returns null bounds.
    """

    if "A" not in image.getbands():
        return {
            "has_alpha_channel": False,
            "alpha_bbox": None,
            "transparent_pixel_count": None,
            "opaque_pixel_count": None,
            "partial_alpha_pixel_count": None,
        }

    alpha = image.getchannel("A")

    alpha_bbox = alpha.getbbox()

    histogram = alpha.histogram()

    transparent_pixels = histogram[0]
    opaque_pixels = histogram[255]
    partial_alpha_pixels = sum(histogram[1:255])

    return {
        "has_alpha_channel": True,
        "alpha_bbox": (
            list(alpha_bbox)
            if alpha_bbox is not None
            else None
        ),
        "transparent_pixel_count": transparent_pixels,
        "opaque_pixel_count": opaque_pixels,
        "partial_alpha_pixel_count": partial_alpha_pixels,
    }


def inspect_non_black_bounds(image: Image.Image) -> dict:
    """
    Estimate the bounding box of pixels that are not pure black.

    This is useful for JPEG or RGB images where transparency is
    unavailable but the artwork may still sit inside black margins.
    """

    rgb = image.convert("RGB")

    black_background = Image.new(
        "RGB",
        rgb.size,
        (0, 0, 0),
    )

    difference = ImageChops.difference(
        rgb,
        black_background,
    )

    bbox = difference.getbbox()

    return {
        "non_black_bbox": (
            list(bbox)
            if bbox is not None
            else None
        ),
    }


def calculate_bbox_margins(
    bbox: list[int] | None,
    width: int,
    height: int,
) -> dict | None:
    if bbox is None:
        return None

    left, top, right, bottom = bbox

    return {
        "left_px": left,
        "top_px": top,
        "right_px": width - right,
        "bottom_px": height - bottom,
    }


def calculate_bbox_coverage(
    bbox: list[int] | None,
    width: int,
    height: int,
) -> float | None:
    if bbox is None:
        return None

    left, top, right, bottom = bbox

    bbox_width = max(0, right - left)
    bbox_height = max(0, bottom - top)

    image_area = width * height

    if image_area == 0:
        return None

    bbox_area = bbox_width * bbox_height

    return bbox_area / image_area


def inspect_minimap(
    map_id: str,
    filename: str,
) -> dict:
    path = MINIMAPS_DIR / filename

    if not path.exists():
        return {
            "map_id": map_id,
            "filename": filename,
            "exists": False,
        }

    with Image.open(path) as image:
        image.load()

        width, height = image.size

        alpha_info = inspect_alpha_bounds(image)
        non_black_info = inspect_non_black_bounds(image)

        alpha_bbox = alpha_info["alpha_bbox"]

        non_black_bbox = non_black_info[
            "non_black_bbox"
        ]

        return {
            "map_id": map_id,
            "filename": filename,
            "exists": True,

            "path": str(
                path.relative_to(DATASET_ROOT)
            ),

            "format": image.format,
            "mode": image.mode,

            "width": width,
            "height": height,

            "is_square": width == height,

            "aspect_ratio": (
                width / height
                if height != 0
                else None
            ),

            "file_size_bytes": (
                path.stat().st_size
            ),

            "bands": list(
                image.getbands()
            ),

            "alpha": alpha_info,

            "alpha_content": {
                "bbox": alpha_bbox,
                "margins": (
                    calculate_bbox_margins(
                        alpha_bbox,
                        width,
                        height,
                    )
                ),
                "coverage_ratio": (
                    calculate_bbox_coverage(
                        alpha_bbox,
                        width,
                        height,
                    )
                ),
            },

            "non_black_content": {
                "bbox": non_black_bbox,
                "margins": (
                    calculate_bbox_margins(
                        non_black_bbox,
                        width,
                        height,
                    )
                ),
                "coverage_ratio": (
                    calculate_bbox_coverage(
                        non_black_bbox,
                        width,
                        height,
                    )
                ),
            },
        }


def find_unexpected_files() -> list[str]:
    expected_filenames = set(
        EXPECTED_MAP_FILES.values()
    )

    unexpected = []

    if not MINIMAPS_DIR.exists():
        return unexpected

    for path in sorted(
        MINIMAPS_DIR.iterdir()
    ):
        if not path.is_file():
            continue

        if path.name not in expected_filenames:
            unexpected.append(path.name)

    return unexpected


def main() -> None:
    if not MINIMAPS_DIR.exists():
        raise FileNotFoundError(
            f"Minimap directory not found: "
            f"{MINIMAPS_DIR}"
        )

    reports = []

    print("MINIMAP AUDIT")
    print("=" * 70)
    print(
        f"Minimap directory: "
        f"{MINIMAPS_DIR}"
    )
    print()

    for map_id, filename in (
        EXPECTED_MAP_FILES.items()
    ):
        report = inspect_minimap(
            map_id,
            filename,
        )

        reports.append(report)

        print(f"{map_id}")
        print("-" * 70)

        if not report["exists"]:
            print(
                f"Missing file: {filename}"
            )
            print()
            continue

        print(
            f"File: {report['filename']}"
        )

        print(
            f"Format: {report['format']}"
        )

        print(
            f"Mode: {report['mode']}"
        )

        print(
            f"Dimensions: "
            f"{report['width']} x "
            f"{report['height']}"
        )

        print(
            f"Square: "
            f"{report['is_square']}"
        )

        print(
            f"Aspect ratio: "
            f"{report['aspect_ratio']:.6f}"
        )

        print(
            f"File size: "
            f"{report['file_size_bytes']} bytes"
        )

        alpha = report["alpha"]

        print(
            f"Alpha channel: "
            f"{alpha['has_alpha_channel']}"
        )

        if alpha["has_alpha_channel"]:
            print(
                f"Transparent pixels: "
                f"{alpha['transparent_pixel_count']}"
            )

            print(
                f"Opaque pixels: "
                f"{alpha['opaque_pixel_count']}"
            )

            print(
                f"Partial-alpha pixels: "
                f"{alpha['partial_alpha_pixel_count']}"
            )

            print(
                "Alpha content bbox: "
                f"{report['alpha_content']['bbox']}"
            )

            print(
                "Alpha margins: "
                f"{report['alpha_content']['margins']}"
            )

            coverage = report[
                "alpha_content"
            ]["coverage_ratio"]

            if coverage is not None:
                print(
                    "Alpha bbox coverage: "
                    f"{coverage:.4%}"
                )

        print(
            "Non-black content bbox: "
            f"{report['non_black_content']['bbox']}"
        )

        print(
            "Non-black margins: "
            f"{report['non_black_content']['margins']}"
        )

        coverage = report[
            "non_black_content"
        ]["coverage_ratio"]

        if coverage is not None:
            print(
                "Non-black bbox coverage: "
                f"{coverage:.4%}"
            )

        print()

    unexpected_files = (
        find_unexpected_files()
    )

    output = {
        "minimap_directory": str(
            MINIMAPS_DIR
        ),

        "expected_maps": list(
            EXPECTED_MAP_FILES.keys()
        ),

        "unexpected_files": (
            unexpected_files
        ),

        "minimaps": reports,
    }

    REPORTS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    with OUTPUT_PATH.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            output,
            file,
            indent=2,
        )

    print("=" * 70)

    print(
        f"Unexpected minimap files: "
        f"{len(unexpected_files)}"
    )

    for filename in unexpected_files:
        print(f"  {filename}")

    print()

    print(
        f"Minimap audit written to: "
        f"{OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()