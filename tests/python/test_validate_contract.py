from __future__ import annotations

import json
from pathlib import Path
import shutil

import pytest

from scripts.validation.validate_contract import (
    validate_phase2_contract,
)


PUBLIC_ROOT = Path("public")


def test_current_full_export_passes_phase2_contract_validation() -> None:
    if not (
        PUBLIC_ROOT
        / "data"
        / "manifest.json"
    ).exists():
        pytest.skip(
            "Full generated export is not available under public/data."
        )

    report = validate_phase2_contract(
        PUBLIC_ROOT
    )

    assert report.passed, "\n".join(
        report.errors
    )
    assert report.manifest_matches == 796
    assert report.match_files == 796
    assert report.checked_matches == 796
    assert report.maps == 3


def test_contract_validator_detects_raw_schema_leak(
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
        ).glob("*.json")
    )

    payload = _load_json(
        match_path
    )
    payload["raw_probe"] = {
        "ts": 123,
        "event_name": "BotKill",
    }
    _write_json(
        match_path,
        payload,
    )

    report = validate_phase2_contract(
        tmp_path
    )

    assert not report.passed
    assert any(
        "raw LILA"
        in error
        for error in report.errors
    )


def test_contract_validator_detects_unexpected_match_field(
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
        ).glob("*.json")
    )

    payload = _load_json(
        match_path
    )
    payload["lila_specific_debug"] = True
    _write_json(
        match_path,
        payload,
    )

    report = validate_phase2_contract(
        tmp_path
    )

    assert not report.passed
    assert any(
        "contract keys differ from expected"
        in error
        for error in report.errors
    )


def test_contract_validator_detects_manifest_match_file_mismatch(
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
        ).glob("*.json")
    )
    match_path.unlink()

    report = validate_phase2_contract(
        tmp_path
    )

    assert not report.passed
    assert any(
        "Missing detailed match JSON files"
        in error
        for error in report.errors
    )


def test_contract_validator_detects_missing_map_asset(
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

    first_map = maps_payload["maps"][0]
    asset_path = (
        tmp_path
        / first_map["image_path"].lstrip("/")
    )
    asset_path.unlink()

    report = validate_phase2_contract(
        tmp_path
    )

    assert not report.passed
    assert any(
        "missing asset"
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
            "Full generated export is not available."
        )

    manifest = _load_json(
        PUBLIC_ROOT
        / "data"
        / "manifest.json"
    )
    maps_payload = _load_json(
        PUBLIC_ROOT
        / "data"
        / "maps.json"
    )

    summaries = manifest["matches"]

    if not summaries:
        pytest.skip(
            "Static export contains no matches."
        )

    summary = summaries[0]
    match_id = summary["match_id"]

    target_data = target_root / "data"
    target_matches = target_data / "matches"

    target_matches.mkdir(
        parents=True,
        exist_ok=True,
    )

    small_manifest = {
        "schema_version": manifest["schema_version"],
        "match_count": 1,
        "map_ids": sorted(
            game_map["id"]
            for game_map in maps_payload["maps"]
        ),
        "dates": [
            summary["date"]
        ],
        "matches": [
            summary
        ],
    }

    _write_json(
        target_data / "manifest.json",
        small_manifest,
    )
    _write_json(
        target_data / "maps.json",
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

    for game_map in maps_payload["maps"]:
        source = (
            PUBLIC_ROOT
            / game_map["image_path"].lstrip("/")
        )
        target = (
            target_root
            / game_map["image_path"].lstrip("/")
        )

        target.parent.mkdir(
            parents=True,
            exist_ok=True,
        )
        shutil.copy2(
            source,
            target,
        )


def _load_json(
    path: Path,
) -> dict:
    with path.open(
        "r",
        encoding="utf-8",
    ) as file_handle:
        return json.load(file_handle)


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
        file_handle.write("\n")
