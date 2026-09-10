from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.adapters import LilaTelemetryAdapter
from scripts.preprocessing.export_dataset import (
    SCHEMA_VERSION,
    export_dataset,
)


DATASET_ROOT = Path(
    "raw-data/extracted/player_data"
)


def require_dataset() -> None:
    if not DATASET_ROOT.exists():
        pytest.skip(
            "Raw LILA telemetry dataset is not available."
        )


def get_small_real_match_id() -> str:
    require_dataset()

    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    match_ids = adapter.discover_match_ids()

    if not match_ids:
        pytest.skip(
            "No LILA matches are available."
        )

    return match_ids[0]


def load_json(
    file_path: Path,
) -> dict:
    with file_path.open(
        "r",
        encoding="utf-8",
    ) as file_handle:
        return json.load(
            file_handle
        )


def test_export_single_match_creates_expected_static_structure(
    tmp_path: Path,
) -> None:
    match_id = get_small_real_match_id()

    result = export_dataset(
        dataset_root=DATASET_ROOT,
        output_root=tmp_path,
        match_ids=[
            match_id
        ],
    )

    assert result.match_count == 1
    assert result.map_count == 3

    assert (
        tmp_path
        / "data"
        / "manifest.json"
    ).exists()

    assert (
        tmp_path
        / "data"
        / "maps.json"
    ).exists()

    assert (
        tmp_path
        / "data"
        / "matches"
        / f"{match_id}.json"
    ).exists()

    assert (
        tmp_path
        / "assets"
        / "maps"
        / "AmbroseValley_Minimap.png"
    ).exists()

    assert (
        tmp_path
        / "assets"
        / "maps"
        / "GrandRift_Minimap.png"
    ).exists()

    assert (
        tmp_path
        / "assets"
        / "maps"
        / "Lockdown_Minimap.jpg"
    ).exists()


def test_manifest_contains_lightweight_match_summary(
    tmp_path: Path,
) -> None:
    match_id = get_small_real_match_id()

    export_dataset(
        dataset_root=DATASET_ROOT,
        output_root=tmp_path,
        match_ids=[
            match_id
        ],
    )

    manifest = load_json(
        tmp_path
        / "data"
        / "manifest.json"
    )

    assert (
        manifest["schema_version"]
        == SCHEMA_VERSION
    )
    assert manifest["match_count"] == 1
    assert len(
        manifest["matches"]
    ) == 1

    summary = (
        manifest["matches"][0]
    )

    assert summary["match_id"] == match_id
    assert summary["participant_count"] >= 1
    assert (
        summary["human_count"]
        + summary["bot_count"]
        == summary["participant_count"]
    )

    assert set(
        summary["event_counts"]
    ) == {
        "kill",
        "death",
        "storm_death",
        "loot",
    }


def test_match_json_contains_normalized_contract(
    tmp_path: Path,
) -> None:
    match_id = get_small_real_match_id()

    export_dataset(
        dataset_root=DATASET_ROOT,
        output_root=tmp_path,
        match_ids=[
            match_id
        ],
    )

    match_payload = load_json(
        tmp_path
        / "data"
        / "matches"
        / f"{match_id}.json"
    )

    assert match_payload["match_id"] == match_id
    assert "participants" in match_payload
    assert "tracks" in match_payload
    assert "events" in match_payload

    assert {
        event["type"]
        for event in match_payload["events"]
    } <= {
        "kill",
        "death",
        "storm_death",
        "loot",
    }


def test_maps_json_contains_three_normalized_maps(
    tmp_path: Path,
) -> None:
    match_id = get_small_real_match_id()

    export_dataset(
        dataset_root=DATASET_ROOT,
        output_root=tmp_path,
        match_ids=[
            match_id
        ],
    )

    maps_payload = load_json(
        tmp_path
        / "data"
        / "maps.json"
    )

    assert (
        maps_payload["schema_version"]
        == SCHEMA_VERSION
    )
    assert maps_payload["map_count"] == 3

    maps_by_id = {
        game_map["id"]: game_map
        for game_map in maps_payload[
            "maps"
        ]
    }

    assert set(
        maps_by_id
    ) == {
        "AmbroseValley",
        "GrandRift",
        "Lockdown",
    }

    assert (
        maps_by_id["GrandRift"][
            "texture_width"
        ]
        == 2160
    )
    assert (
        maps_by_id["GrandRift"][
            "texture_height"
        ]
        == 2158
    )


def test_export_rejects_unknown_requested_match(
    tmp_path: Path,
) -> None:
    require_dataset()

    with pytest.raises(
        ValueError,
        match="unknown match IDs",
    ):
        export_dataset(
            dataset_root=DATASET_ROOT,
            output_root=tmp_path,
            match_ids=[
                "not-a-real-match"
            ],
        )


def test_export_clears_stale_match_json_files(
    tmp_path: Path,
) -> None:
    match_id = get_small_real_match_id()

    stale_directory = (
        tmp_path
        / "data"
        / "matches"
    )
    stale_directory.mkdir(
        parents=True
    )

    stale_file = (
        stale_directory
        / "stale-match.json"
    )
    stale_file.write_text(
        "{}",
        encoding="utf-8",
    )

    export_dataset(
        dataset_root=DATASET_ROOT,
        output_root=tmp_path,
        match_ids=[
            match_id
        ],
    )

    assert not stale_file.exists()


def test_manifest_exposes_iso_dates_only(
    tmp_path: Path,
) -> None:
    match_id = get_small_real_match_id()

    export_dataset(
        dataset_root=DATASET_ROOT,
        output_root=tmp_path,
        match_ids=[
            match_id
        ],
    )

    manifest = load_json(
        tmp_path
        / "data"
        / "manifest.json"
    )

    assert manifest["dates"]
    assert all(
        date_value.startswith(
            "2026-02-"
        )
        for date_value in manifest["dates"]
    )

    assert all(
        summary["date"].startswith(
            "2026-02-"
        )
        for summary in manifest["matches"]
    )
