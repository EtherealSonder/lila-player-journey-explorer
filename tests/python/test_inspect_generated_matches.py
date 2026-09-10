from __future__ import annotations

from pathlib import Path

import pytest

from scripts.validation.inspect_generated_matches import (
    KNOWN_DUPLICATE_MATCH_ID,
    inspect_generated_matches,
)


PUBLIC_ROOT = Path(
    "public"
)


def test_manual_inspection_packet_covers_representative_matches() -> None:
    if not (
        PUBLIC_ROOT
        / "data"
        / "manifest.json"
    ).exists():
        pytest.skip(
            "Full generated export is not available."
        )

    report = inspect_generated_matches(
        PUBLIC_ROOT
    )

    assert (
        report[
            "manifest_match_count"
        ]
        == 796
    )
    assert (
        report[
            "actual_match_file_count"
        ]
        == 796
    )

    selected = report[
        "selected_matches"
    ]

    assert len(
        selected
    ) >= 4

    selected_ids = {
        match[
            "match_id"
        ]
        for match in selected
    }

    assert (
        KNOWN_DUPLICATE_MATCH_ID
        in selected_ids
    )

    selected_maps = {
        match[
            "map_id"
        ]
        for match in selected
    }

    assert selected_maps == {
        "AmbroseValley",
        "GrandRift",
        "Lockdown",
    }

    assert all(
        match[
            "summary_reconciles"
        ]
        for match in selected
    )

    assert all(
        0.0
        <= match[
            "map_u_range"
        ][0]
        <= match[
            "map_u_range"
        ][1]
        <= 1.0
        for match in selected
    )

    assert all(
        0.0
        <= match[
            "map_v_range"
        ][0]
        <= match[
            "map_v_range"
        ][1]
        <= 1.0
        for match in selected
    )


def test_manual_inspection_packet_reports_real_file_sizes() -> None:
    if not (
        PUBLIC_ROOT
        / "data"
        / "manifest.json"
    ).exists():
        pytest.skip(
            "Full generated export is not available."
        )

    report = inspect_generated_matches(
        PUBLIC_ROOT
    )

    sizes = report[
        "match_file_sizes"
    ]

    assert (
        sizes[
            "smallest_bytes"
        ]
        > 0
    )
    assert (
        sizes[
            "largest_bytes"
        ]
        >= sizes[
            "smallest_bytes"
        ]
    )
    assert (
        sizes[
            "total_bytes"
        ]
        >= sizes[
            "largest_bytes"
        ]
    )

    assert len(
        report[
            "map_assets"
        ]
    ) == 3

    assert all(
        game_map[
            "file_size_bytes"
        ]
        is not None
        and game_map[
            "file_size_bytes"
        ]
        > 0
        for game_map in report[
            "map_assets"
        ]
    )
