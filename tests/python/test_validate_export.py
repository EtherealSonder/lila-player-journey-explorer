from __future__ import annotations

import json
from pathlib import Path
import shutil

import pytest

from scripts.validation.validate_export import (
    EXPECTED_LILA_DATE_MATCH_COUNTS,
    EXPECTED_LILA_MAP_MATCH_COUNTS,
    NORMALIZED_EVENT_TYPES,
    validate_exported_dataset,
)


PUBLIC_ROOT = Path(
    "public"
)


def test_current_full_export_passes_validation() -> None:
    manifest_path = (
        PUBLIC_ROOT
        / "data"
        / "manifest.json"
    )

    if not manifest_path.exists():
        pytest.skip(
            "Full static export is not available under public/data."
        )

    report = validate_exported_dataset(
        PUBLIC_ROOT,
        enforce_lila_profile=True,
    )

    assert report.passed, "\n".join(
        report.errors
    )
    assert report.match_count == 796
    assert report.map_count == 3
    assert report.participant_count == 1242
    assert report.human_count == 798
    assert report.bot_count == 444
    assert (
        report.map_match_counts
        == EXPECTED_LILA_MAP_MATCH_COUNTS
    )
    assert (
        report.date_match_counts
        == EXPECTED_LILA_DATE_MATCH_COUNTS
    )
    assert set(
        report.event_counts
    ) == NORMALIZED_EVENT_TYPES


def test_validator_detects_summary_detail_mismatch(
    tmp_path: Path,
) -> None:
    _copy_small_valid_export(
        tmp_path
    )

    match_path = next(
        (
            tmp_path
            / "data"
            / "matches"
        ).glob(
            "*.json"
        )
    )

    payload = _load_json(
        match_path
    )

    payload[
        "duration_seconds"
    ] += 1

    _write_json(
        match_path,
        payload,
    )

    report = validate_exported_dataset(
        tmp_path,
        enforce_lila_profile=False,
    )

    assert not report.passed
    assert any(
        "duration_seconds differs from summary"
        in error
        for error in report.errors
    )


def test_validator_detects_raw_lila_event_name_leak(
    tmp_path: Path,
) -> None:
    _copy_small_valid_export(
        tmp_path
    )

    match_path = next(
        (
            tmp_path
            / "data"
            / "matches"
        ).glob(
            "*.json"
        )
    )

    payload = _load_json(
        match_path
    )

    payload["raw_debug"] = {
        "event_name": "BotKill"
    }

    _write_json(
        match_path,
        payload,
    )

    report = validate_exported_dataset(
        tmp_path,
        enforce_lila_profile=False,
    )

    assert not report.passed
    assert any(
        (
            "raw LILA key"
            in error
            or "raw LILA event name"
            in error
        )
        for error in report.errors
    )


def test_validator_treats_out_of_bounds_coordinates_as_warning(
    tmp_path: Path,
) -> None:
    _copy_small_valid_export(
        tmp_path
    )

    match_path = next(
        (
            tmp_path
            / "data"
            / "matches"
        ).glob(
            "*.json"
        )
    )

    payload = _load_json(
        match_path
    )

    first_point = _find_first_point(
        payload
    )

    if first_point is None:
        pytest.skip(
            "Selected exported match has no trajectory points."
        )

    first_point[
        "map_u"
    ] = 1.25

    _write_json(
        match_path,
        payload,
    )

    report = validate_exported_dataset(
        tmp_path,
        enforce_lila_profile=False,
    )

    assert report.passed
    assert (
        report.out_of_bounds_point_count
        >= 1
    )
    assert report.warnings


def test_validator_detects_non_chronological_track(
    tmp_path: Path,
) -> None:
    _copy_small_valid_export(
        tmp_path
    )

    match_path = next(
        (
            tmp_path
            / "data"
            / "matches"
        ).glob(
            "*.json"
        )
    )

    payload = _load_json(
        match_path
    )

    points = _find_track_with_multiple_points(
        payload
    )

    if points is None:
        pytest.skip(
            "Selected exported match does not contain a multi-point track."
        )

    points[1][
        "time_seconds"
    ] = (
        points[0][
            "time_seconds"
        ]
        - 1.0
    )

    _write_json(
        match_path,
        payload,
    )

    report = validate_exported_dataset(
        tmp_path,
        enforce_lila_profile=False,
    )

    assert not report.passed
    assert any(
        "out of chronological order"
        in error
        for error in report.errors
    )


def test_validator_detects_missing_map_asset(
    tmp_path: Path,
) -> None:
    _copy_small_valid_export(
        tmp_path
    )

    maps_payload = _load_json(
        tmp_path
        / "data"
        / "maps.json"
    )

    first_map = (
        maps_payload[
            "maps"
        ][0]
    )

    asset_path = (
        tmp_path
        / first_map[
            "image_path"
        ].lstrip(
            "/"
        )
    )

    asset_path.unlink()

    report = validate_exported_dataset(
        tmp_path,
        enforce_lila_profile=False,
    )

    assert not report.passed
    assert any(
        "asset is missing"
        in error
        for error in report.errors
    )


def _copy_small_valid_export(
    target_root: Path,
) -> None:
    if not (
        PUBLIC_ROOT
        / "data"
        / "manifest.json"
    ).exists():
        pytest.skip(
            "Full static export is not available under public/data."
        )

    manifest = _load_json(
        PUBLIC_ROOT
        / "data"
        / "manifest.json"
    )

    summaries = manifest.get(
        "matches",
        [],
    )

    if not summaries:
        pytest.skip(
            "Static export contains no matches."
        )

    summary = summaries[0]
    match_id = summary[
        "match_id"
    ]

    target_data = (
        target_root
        / "data"
    )
    target_matches = (
        target_data
        / "matches"
    )
    target_assets = (
        target_root
        / "assets"
        / "maps"
    )

    target_matches.mkdir(
        parents=True,
        exist_ok=True,
    )
    target_assets.mkdir(
        parents=True,
        exist_ok=True,
    )

    maps_payload = _load_json(
        PUBLIC_ROOT
        / "data"
        / "maps.json"
    )

    small_manifest = {
        "schema_version": manifest.get(
            "schema_version",
            1,
        ),
        "match_count": 1,
        "map_ids": [
            summary[
                "map_id"
            ]
        ],
        "dates": [
            summary[
                "date"
            ]
        ],
        "matches": [
            summary
        ],
    }

    _write_json(
        target_data
        / "manifest.json",
        small_manifest,
    )
    _write_json(
        target_data
        / "maps.json",
        maps_payload,
    )

    shutil.copy2(
        PUBLIC_ROOT
        / "data"
        / "matches"
        / f"{match_id}.json",
        target_matches
        / f"{match_id}.json",
    )

    for game_map in (
        maps_payload[
            "maps"
        ]
    ):
        image_path = (
            game_map[
                "image_path"
            ]
        )

        source = (
            PUBLIC_ROOT
            / image_path.lstrip(
                "/"
            )
        )
        target = (
            target_root
            / image_path.lstrip(
                "/"
            )
        )

        target.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        shutil.copy2(
            source,
            target,
        )


def _find_first_point(
    match_payload: dict,
) -> dict | None:
    for track in match_payload.get(
        "tracks",
        [],
    ):
        points = track.get(
            "points",
            [],
        )

        if points:
            return points[0]

    return None


def _find_track_with_multiple_points(
    match_payload: dict,
) -> list[dict] | None:
    for track in match_payload.get(
        "tracks",
        [],
    ):
        points = track.get(
            "points",
            [],
        )

        if len(
            points
        ) >= 2:
            return points

    return None


def _load_json(
    path: Path,
) -> dict:
    with path.open(
        "r",
        encoding="utf-8",
    ) as file_handle:
        return json.load(
            file_handle
        )


def _write_json(
    path: Path,
    payload: dict,
) -> None:
    with path.open(
        "w",
        encoding="utf-8",
        newline="\n",
    ) as file_handle:
        json.dump(
            payload,
            file_handle,
            indent=2,
            ensure_ascii=False,
        )
        file_handle.write(
            "\n"
        )
