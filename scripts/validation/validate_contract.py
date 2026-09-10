from __future__ import annotations

import argparse
from dataclasses import dataclass, field
import json
from pathlib import Path
from typing import Any


EXPECTED_MANIFEST_KEYS = {
    "schema_version",
    "match_count",
    "map_ids",
    "dates",
    "matches",
}

EXPECTED_MAPS_KEYS = {
    "schema_version",
    "map_count",
    "maps",
}

EXPECTED_MATCH_KEYS = {
    "match_id",
    "date",
    "map_id",
    "duration_seconds",
    "participants",
    "tracks",
    "events",
}

EXPECTED_SUMMARY_KEYS = {
    "match_id",
    "date",
    "map_id",
    "duration_seconds",
    "participant_count",
    "human_count",
    "bot_count",
    "event_counts",
}

EXPECTED_MAP_KEYS = {
    "id",
    "display_name",
    "image_path",
    "projection",
    "texture_width",
    "texture_height",
}

EXPECTED_PROJECTION_KEYS = {
    "origin_x",
    "origin_z",
    "scale",
}

EXPECTED_PARTICIPANT_KEYS = {
    "id",
    "category",
}

EXPECTED_TRACK_KEYS = {
    "participant_id",
    "points",
}

EXPECTED_POINT_KEYS = {
    "time_seconds",
    "world_x",
    "world_y",
    "world_z",
    "map_u",
    "map_v",
}

EXPECTED_EVENT_REQUIRED_KEYS = {
    "time_seconds",
    "type",
    "participant_id",
    "participant_category",
    "owner_role",
    "world_x",
    "world_y",
    "world_z",
    "map_u",
    "map_v",
    "source_category",
    "target_category",
    "metadata",
}

NORMALIZED_EVENT_TYPES = {
    "kill",
    "death",
    "storm_death",
    "loot",
}

NORMALIZED_PARTICIPANT_CATEGORIES = {
    "human",
    "bot",
}

RAW_LILA_EVENT_NAMES = {
    "Position",
    "BotPosition",
    "Kill",
    "Killed",
    "BotKill",
    "BotKilled",
    "KilledByStorm",
    "Loot",
}

RAW_LILA_KEYS = {
    "user_id",
    "match_id_raw",
    "map_id_raw",
    "x",
    "y",
    "z",
    "ts",
    "event",
    "event_name",
    "timestamp_raw",
}

RAW_FILE_SUFFIX = ".nakama-0"


@dataclass
class ContractValidationReport:
    passed: bool = True
    errors: list[str] = field(default_factory=list)

    manifest_matches: int = 0
    match_files: int = 0
    maps: int = 0
    checked_matches: int = 0

    def add_error(self, message: str) -> None:
        self.errors.append(message)
        self.passed = False


def validate_phase2_contract(
    public_root: Path,
) -> ContractValidationReport:
    """
    Validate the final browser-facing Phase 2 contract.

    This validator is intentionally frontend-oriented. It verifies that a
    browser can discover available maps, dates, and matches from manifest.json,
    resolve map metadata from maps.json, and load detailed telemetry from a
    selected match JSON without knowing the raw LILA Parquet schema.
    """

    public_root = public_root.resolve()
    data_root = public_root / "data"
    matches_root = data_root / "matches"

    report = ContractValidationReport()

    manifest_path = data_root / "manifest.json"
    maps_path = data_root / "maps.json"

    if not manifest_path.exists():
        report.add_error(
            f"Missing browser manifest: {manifest_path}"
        )
        return report

    if not maps_path.exists():
        report.add_error(
            f"Missing browser map registry: {maps_path}"
        )
        return report

    if not matches_root.exists():
        report.add_error(
            f"Missing browser match directory: {matches_root}"
        )
        return report

    manifest = _load_json(manifest_path, report)
    maps_payload = _load_json(maps_path, report)

    if manifest is None or maps_payload is None:
        return report

    _require_exact_keys(
        manifest,
        EXPECTED_MANIFEST_KEYS,
        "manifest.json",
        report,
    )
    _require_exact_keys(
        maps_payload,
        EXPECTED_MAPS_KEYS,
        "maps.json",
        report,
    )

    summaries = manifest.get("matches")
    maps = maps_payload.get("maps")

    if not isinstance(summaries, list):
        report.add_error(
            "manifest.json field 'matches' must be a list."
        )
        return report

    if not isinstance(maps, list):
        report.add_error(
            "maps.json field 'maps' must be a list."
        )
        return report

    report.manifest_matches = len(summaries)
    report.maps = len(maps)

    if manifest.get("match_count") != len(summaries):
        report.add_error(
            "manifest.json match_count does not equal matches length."
        )

    if maps_payload.get("map_count") != len(maps):
        report.add_error(
            "maps.json map_count does not equal maps length."
        )

    map_by_id: dict[str, dict[str, Any]] = {}

    for index, game_map in enumerate(maps):
        context = f"maps.json maps[{index}]"

        if not isinstance(game_map, dict):
            report.add_error(
                f"{context} must be an object."
            )
            continue

        _require_exact_keys(
            game_map,
            EXPECTED_MAP_KEYS,
            context,
            report,
        )

        map_id = game_map.get("id")

        if not isinstance(map_id, str) or not map_id:
            report.add_error(
                f"{context} has invalid id."
            )
            continue

        if map_id in map_by_id:
            report.add_error(
                f"Duplicate map id in maps.json: {map_id}"
            )
            continue

        map_by_id[map_id] = game_map

        projection = game_map.get("projection")

        if not isinstance(projection, dict):
            report.add_error(
                f"{context}.projection must be an object."
            )
        else:
            _require_exact_keys(
                projection,
                EXPECTED_PROJECTION_KEYS,
                f"{context}.projection",
                report,
            )

        image_path = game_map.get("image_path")

        if not isinstance(image_path, str) or not image_path.startswith("/"):
            report.add_error(
                f"{context}.image_path must be a browser-root-relative path."
            )
        else:
            asset_path = public_root / image_path.lstrip("/")

            if not asset_path.exists():
                report.add_error(
                    f"{context} points to missing asset: {asset_path}"
                )

    manifest_map_ids = manifest.get("map_ids")
    manifest_dates = manifest.get("dates")

    if manifest_map_ids != sorted(map_by_id):
        report.add_error(
            "manifest.json map_ids must exactly match sorted maps.json IDs."
        )

    if not isinstance(manifest_dates, list):
        report.add_error(
            "manifest.json dates must be a list."
        )

    summary_by_id: dict[str, dict[str, Any]] = {}

    for index, summary in enumerate(summaries):
        context = f"manifest.json matches[{index}]"

        if not isinstance(summary, dict):
            report.add_error(
                f"{context} must be an object."
            )
            continue

        _require_exact_keys(
            summary,
            EXPECTED_SUMMARY_KEYS,
            context,
            report,
        )

        match_id = summary.get("match_id")

        if not isinstance(match_id, str) or not match_id:
            report.add_error(
                f"{context} has invalid match_id."
            )
            continue

        if RAW_FILE_SUFFIX in match_id:
            report.add_error(
                f"{context} leaks raw file suffix in match_id."
            )

        if match_id in summary_by_id:
            report.add_error(
                f"Duplicate match id in manifest: {match_id}"
            )
            continue

        summary_by_id[match_id] = summary

        if summary.get("map_id") not in map_by_id:
            report.add_error(
                f"{context} references unknown map_id."
            )

        event_counts = summary.get("event_counts")

        if not isinstance(event_counts, dict):
            report.add_error(
                f"{context}.event_counts must be an object."
            )
        elif set(event_counts) != NORMALIZED_EVENT_TYPES:
            report.add_error(
                f"{context}.event_counts must contain only normalized event keys."
            )

    match_paths = sorted(matches_root.glob("*.json"))
    report.match_files = len(match_paths)

    expected_match_filenames = {
        f"{match_id}.json"
        for match_id in summary_by_id
    }
    actual_match_filenames = {
        path.name
        for path in match_paths
    }

    if expected_match_filenames != actual_match_filenames:
        missing = sorted(
            expected_match_filenames - actual_match_filenames
        )
        extra = sorted(
            actual_match_filenames - expected_match_filenames
        )

        if missing:
            report.add_error(
                "Missing detailed match JSON files: "
                + ", ".join(missing[:10])
            )

        if extra:
            report.add_error(
                "Unexpected detailed match JSON files: "
                + ", ".join(extra[:10])
            )

    for match_path in match_paths:
        match = _load_json(match_path, report)

        if match is None:
            continue

        report.checked_matches += 1

        _validate_match_contract(
            match_path=match_path,
            match=match,
            summary=summary_by_id.get(match_path.stem),
            map_by_id=map_by_id,
            report=report,
        )

    _validate_frontend_discovery_flow(
        manifest=manifest,
        map_by_id=map_by_id,
        summary_by_id=summary_by_id,
        matches_root=matches_root,
        report=report,
    )

    _scan_for_raw_lila_leakage(
        value=manifest,
        context="manifest.json",
        report=report,
    )
    _scan_for_raw_lila_leakage(
        value=maps_payload,
        context="maps.json",
        report=report,
    )

    return report


def _validate_match_contract(
    *,
    match_path: Path,
    match: dict[str, Any],
    summary: dict[str, Any] | None,
    map_by_id: dict[str, dict[str, Any]],
    report: ContractValidationReport,
) -> None:
    context = match_path.name

    _require_exact_keys(
        match,
        EXPECTED_MATCH_KEYS,
        context,
        report,
    )

    if match.get("match_id") != match_path.stem:
        report.add_error(
            f"{context} match_id does not match filename."
        )

    if summary is None:
        report.add_error(
            f"{context} has no corresponding manifest summary."
        )
    else:
        for field_name in (
            "match_id",
            "date",
            "map_id",
            "duration_seconds",
        ):
            if match.get(field_name) != summary.get(field_name):
                report.add_error(
                    f"{context} field {field_name} differs from manifest summary."
                )

    map_id = match.get("map_id")

    if map_id not in map_by_id:
        report.add_error(
            f"{context} references map_id not present in maps.json."
        )

    participants = match.get("participants")
    tracks = match.get("tracks")
    events = match.get("events")

    if not isinstance(participants, list):
        report.add_error(
            f"{context}.participants must be a list."
        )
        participants = []

    if not isinstance(tracks, list):
        report.add_error(
            f"{context}.tracks must be a list."
        )
        tracks = []

    if not isinstance(events, list):
        report.add_error(
            f"{context}.events must be a list."
        )
        events = []

    participant_ids: set[str] = set()

    for index, participant in enumerate(participants):
        participant_context = (
            f"{context}.participants[{index}]"
        )

        if not isinstance(participant, dict):
            report.add_error(
                f"{participant_context} must be an object."
            )
            continue

        _require_exact_keys(
            participant,
            EXPECTED_PARTICIPANT_KEYS,
            participant_context,
            report,
        )

        participant_id = participant.get("id")
        category = participant.get("category")

        if not isinstance(participant_id, str) or not participant_id:
            report.add_error(
                f"{participant_context} has invalid id."
            )
        else:
            participant_ids.add(participant_id)

        if category not in NORMALIZED_PARTICIPANT_CATEGORIES:
            report.add_error(
                f"{participant_context} has non-normalized category."
            )

    for index, track in enumerate(tracks):
        track_context = f"{context}.tracks[{index}]"

        if not isinstance(track, dict):
            report.add_error(
                f"{track_context} must be an object."
            )
            continue

        _require_exact_keys(
            track,
            EXPECTED_TRACK_KEYS,
            track_context,
            report,
        )

        participant_id = track.get("participant_id")

        if participant_id not in participant_ids:
            report.add_error(
                f"{track_context} references unknown participant."
            )

        points = track.get("points")

        if not isinstance(points, list):
            report.add_error(
                f"{track_context}.points must be a list."
            )
            continue

        for point_index, point in enumerate(points):
            point_context = (
                f"{track_context}.points[{point_index}]"
            )

            if not isinstance(point, dict):
                report.add_error(
                    f"{point_context} must be an object."
                )
                continue

            _require_exact_keys(
                point,
                EXPECTED_POINT_KEYS,
                point_context,
                report,
            )

    for index, event in enumerate(events):
        event_context = f"{context}.events[{index}]"

        if not isinstance(event, dict):
            report.add_error(
                f"{event_context} must be an object."
            )
            continue

        _require_exact_keys(
            event,
            EXPECTED_EVENT_REQUIRED_KEYS,
            event_context,
            report,
        )

        if event.get("type") not in NORMALIZED_EVENT_TYPES:
            report.add_error(
                f"{event_context} has non-normalized event type."
            )

        if event.get("participant_category") not in (
            NORMALIZED_PARTICIPANT_CATEGORIES
        ):
            report.add_error(
                f"{event_context} has non-normalized participant_category."
            )

        if event.get("participant_id") not in participant_ids:
            report.add_error(
                f"{event_context} references unknown participant."
            )

    _scan_for_raw_lila_leakage(
        value=match,
        context=context,
        report=report,
    )


def _validate_frontend_discovery_flow(
    *,
    manifest: dict[str, Any],
    map_by_id: dict[str, dict[str, Any]],
    summary_by_id: dict[str, dict[str, Any]],
    matches_root: Path,
    report: ContractValidationReport,
) -> None:
    """
    Simulate the minimum frontend data-loading flow.

    The frontend should be able to:
    1. read available maps, dates, and matches from manifest.json,
    2. resolve map presentation metadata from maps.json,
    3. load a detailed selected-match JSON file,
    4. use normalized participant, track, event, and UV fields only.
    """

    map_ids = manifest.get("map_ids")
    dates = manifest.get("dates")
    summaries = manifest.get("matches")

    if (
        not isinstance(map_ids, list)
        or not isinstance(dates, list)
        or not isinstance(summaries, list)
        or not summaries
    ):
        report.add_error(
            "Frontend discovery flow cannot start from manifest.json."
        )
        return

    selected_summary = summaries[0]

    if not isinstance(selected_summary, dict):
        report.add_error(
            "Frontend discovery flow cannot select a valid match summary."
        )
        return

    selected_match_id = selected_summary.get("match_id")
    selected_map_id = selected_summary.get("map_id")

    if selected_match_id not in summary_by_id:
        report.add_error(
            "Frontend discovery flow cannot resolve selected match."
        )
        return

    if selected_map_id not in map_by_id:
        report.add_error(
            "Frontend discovery flow cannot resolve selected map metadata."
        )
        return

    selected_match_path = (
        matches_root / f"{selected_match_id}.json"
    )

    if not selected_match_path.exists():
        report.add_error(
            "Frontend discovery flow cannot load selected detailed match JSON."
        )
        return

    selected_match = _load_json(
        selected_match_path,
        report,
    )

    if selected_match is None:
        return

    required_frontend_fields = {
        "participants",
        "tracks",
        "events",
    }

    if not required_frontend_fields.issubset(selected_match):
        report.add_error(
            "Frontend detailed match payload is missing normalized visualization fields."
        )


def _require_exact_keys(
    payload: dict[str, Any],
    expected_keys: set[str],
    context: str,
    report: ContractValidationReport,
) -> None:
    actual_keys = set(payload)

    if actual_keys != expected_keys:
        missing = sorted(expected_keys - actual_keys)
        extra = sorted(actual_keys - expected_keys)

        message_parts = [
            f"{context} contract keys differ from expected."
        ]

        if missing:
            message_parts.append(
                f"Missing: {missing}."
            )

        if extra:
            message_parts.append(
                f"Unexpected: {extra}."
            )

        report.add_error(
            " ".join(message_parts)
        )


def _scan_for_raw_lila_leakage(
    *,
    value: Any,
    context: str,
    report: ContractValidationReport,
) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key in RAW_LILA_KEYS:
                report.add_error(
                    f"{context} leaks raw LILA key {key!r}."
                )

            _scan_for_raw_lila_leakage(
                value=child,
                context=context,
                report=report,
            )

    elif isinstance(value, list):
        for child in value:
            _scan_for_raw_lila_leakage(
                value=child,
                context=context,
                report=report,
            )

    elif isinstance(value, str):
        if value in RAW_LILA_EVENT_NAMES:
            report.add_error(
                f"{context} leaks raw LILA event value {value!r}."
            )

        if value.endswith(RAW_FILE_SUFFIX):
            report.add_error(
                f"{context} leaks raw LILA file suffix."
            )


def _load_json(
    path: Path,
    report: ContractValidationReport,
) -> dict[str, Any] | None:
    try:
        with path.open(
            "r",
            encoding="utf-8",
        ) as file_handle:
            payload = json.load(file_handle)
    except (
        OSError,
        json.JSONDecodeError,
    ) as exc:
        report.add_error(
            f"Could not load valid JSON from {path}: {exc}"
        )
        return None

    if not isinstance(payload, dict):
        report.add_error(
            f"Top-level JSON must be an object: {path}"
        )
        return None

    return payload


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate the final Phase 2 browser-facing normalized data contract."
        )
    )

    parser.add_argument(
        "--public-root",
        type=Path,
        default=Path("public"),
        help=(
            "Frontend public directory containing data/ and assets/."
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    report = validate_phase2_contract(
        args.public_root
    )

    print(
        "Phase 2N final contract validation"
    )
    print(
        f"Status: {'PASS' if report.passed else 'FAIL'}"
    )
    print(
        f"Manifest matches: {report.manifest_matches}"
    )
    print(
        f"Detailed match files: {report.match_files}"
    )
    print(
        f"Detailed matches checked: {report.checked_matches}"
    )
    print(
        f"Maps: {report.maps}"
    )

    if report.errors:
        print("Errors:")

        for error in report.errors:
            print(
                f"  - {error}"
            )

    if not report.passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
