from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import asdict, dataclass, field
import json
import math
from pathlib import Path
from typing import Any


EXPECTED_LILA_MATCH_COUNT = 796
EXPECTED_LILA_MAP_IDS = {
    "AmbroseValley",
    "GrandRift",
    "Lockdown",
}
EXPECTED_LILA_DATES = {
    "2026-02-10",
    "2026-02-11",
    "2026-02-12",
    "2026-02-13",
    "2026-02-14",
}
EXPECTED_LILA_MAP_MATCH_COUNTS = {
    "AmbroseValley": 566,
    "GrandRift": 59,
    "Lockdown": 171,
}
EXPECTED_LILA_DATE_MATCH_COUNTS = {
    "2026-02-10": 284,
    "2026-02-11": 201,
    "2026-02-12": 162,
    "2026-02-13": 112,
    "2026-02-14": 37,
}
EXPECTED_LILA_CANONICAL_PARTICIPANT_COUNT = 1242
EXPECTED_LILA_CANONICAL_HUMAN_COUNT = 798
EXPECTED_LILA_CANONICAL_BOT_COUNT = 444

KNOWN_DUPLICATE_MATCH_ID = (
    "ac049b28-8116-4ff1-9e60-4be0537b8cc9"
)
EXPECTED_DUPLICATE_MATCH_PARTICIPANT_COUNT = 7

NORMALIZED_EVENT_TYPES = {
    "kill",
    "death",
    "storm_death",
    "loot",
}
PARTICIPANT_CATEGORIES = {
    "human",
    "bot",
}
EVENT_OWNER_ROLES = {
    "killer",
    "victim",
    "participant",
}
FORBIDDEN_RAW_EVENT_NAMES = {
    "Position",
    "BotPosition",
    "Kill",
    "Killed",
    "BotKill",
    "BotKilled",
    "KilledByStorm",
    "Loot",
}
FORBIDDEN_RAW_KEYS = {
    "ts",
    "event_name",
}


@dataclass
class ValidationReport:
    passed: bool = True
    errors: list[str] = field(
        default_factory=list
    )
    warnings: list[str] = field(
        default_factory=list
    )

    match_count: int = 0
    map_count: int = 0
    participant_count: int = 0
    human_count: int = 0
    bot_count: int = 0
    track_count: int = 0
    point_count: int = 0
    event_count: int = 0

    out_of_bounds_point_count: int = 0
    out_of_bounds_event_count: int = 0

    map_match_counts: dict[str, int] = field(
        default_factory=dict
    )
    date_match_counts: dict[str, int] = field(
        default_factory=dict
    )
    event_counts: dict[str, int] = field(
        default_factory=dict
    )

    def add_error(
        self,
        message: str,
    ) -> None:
        self.errors.append(
            message
        )
        self.passed = False

    def add_warning(
        self,
        message: str,
    ) -> None:
        self.warnings.append(
            message
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(
            self
        )


def validate_exported_dataset(
    public_root: Path,
    *,
    enforce_lila_profile: bool = True,
) -> ValidationReport:
    """
    Validate the browser-facing normalized static export.

    This intentionally validates the generated contract rather than re-parsing
    raw Parquet. It checks that all exported matches, summaries, maps, tracks,
    events, dates, participant categories, and projection coordinates remain
    internally consistent.

    Out-of-bounds normalized map coordinates are counted and reported, but are
    not treated as failures because the adapter deliberately preserves them as
    diagnostics instead of clamping them.
    """

    public_root = public_root.resolve()
    data_root = public_root / "data"
    manifest_path = data_root / "manifest.json"
    maps_path = data_root / "maps.json"
    matches_root = data_root / "matches"

    report = ValidationReport()

    if not manifest_path.exists():
        report.add_error(
            f"Missing manifest: {manifest_path}"
        )
        return report

    if not maps_path.exists():
        report.add_error(
            f"Missing map registry: {maps_path}"
        )
        return report

    if not matches_root.exists():
        report.add_error(
            f"Missing matches directory: {matches_root}"
        )
        return report

    manifest = _load_json(
        manifest_path,
        report,
    )
    maps_payload = _load_json(
        maps_path,
        report,
    )

    if manifest is None or maps_payload is None:
        return report

    map_registry = _validate_maps_payload(
        public_root=public_root,
        maps_payload=maps_payload,
        report=report,
    )

    summaries = manifest.get(
        "matches"
    )

    if not isinstance(
        summaries,
        list,
    ):
        report.add_error(
            "manifest.json field 'matches' must be a list."
        )
        return report

    report.match_count = len(
        summaries
    )

    if manifest.get(
        "match_count"
    ) != report.match_count:
        report.add_error(
            "manifest.json match_count does not match the number of summaries."
        )

    summary_ids: set[str] = set()
    summary_by_id: dict[str, dict[str, Any]] = {}
    map_match_counts: Counter[str] = Counter()
    date_match_counts: Counter[str] = Counter()
    aggregate_event_counts: Counter[str] = Counter()

    for index, summary in enumerate(
        summaries
    ):
        context = (
            f"manifest matches[{index}]"
        )

        if not isinstance(
            summary,
            dict,
        ):
            report.add_error(
                f"{context} must be an object."
            )
            continue

        match_id = summary.get(
            "match_id"
        )

        if not isinstance(
            match_id,
            str,
        ) or not match_id:
            report.add_error(
                f"{context} has an invalid match_id."
            )
            continue

        if match_id in summary_ids:
            report.add_error(
                f"Duplicate match summary ID: {match_id}"
            )
            continue

        summary_ids.add(
            match_id
        )
        summary_by_id[
            match_id
        ] = summary

        map_id = summary.get(
            "map_id"
        )
        date = summary.get(
            "date"
        )

        if isinstance(
            map_id,
            str,
        ):
            map_match_counts[
                map_id
            ] += 1

            if map_id not in map_registry:
                report.add_error(
                    f"Match {match_id} references unknown map {map_id}."
                )

        if isinstance(
            date,
            str,
        ):
            date_match_counts[
                date
            ] += 1

            if not _looks_like_iso_date(
                date
            ):
                report.add_error(
                    f"Match {match_id} has non-ISO date {date!r}."
                )

        participant_count = summary.get(
            "participant_count"
        )
        human_count = summary.get(
            "human_count"
        )
        bot_count = summary.get(
            "bot_count"
        )

        if all(
            isinstance(
                value,
                int,
            )
            for value in (
                participant_count,
                human_count,
                bot_count,
            )
        ):
            if (
                human_count
                + bot_count
                != participant_count
            ):
                report.add_error(
                    f"Match {match_id} summary participant counts do not reconcile."
                )

            report.participant_count += (
                participant_count
            )
            report.human_count += (
                human_count
            )
            report.bot_count += (
                bot_count
            )

        event_counts = summary.get(
            "event_counts"
        )

        if not isinstance(
            event_counts,
            dict,
        ):
            report.add_error(
                f"Match {match_id} summary event_counts must be an object."
            )
        else:
            if set(
                event_counts
            ) != NORMALIZED_EVENT_TYPES:
                report.add_error(
                    f"Match {match_id} summary event keys are invalid: "
                    f"{sorted(event_counts)}"
                )
            else:
                for event_type, count in (
                    event_counts.items()
                ):
                    if not isinstance(
                        count,
                        int,
                    ) or count < 0:
                        report.add_error(
                            f"Match {match_id} has invalid event count "
                            f"{event_type}={count!r}."
                        )
                    else:
                        aggregate_event_counts[
                            event_type
                        ] += count

    match_files = sorted(
        matches_root.glob(
            "*.json"
        )
    )
    file_match_ids = {
        path.stem
        for path in match_files
    }

    missing_files = sorted(
        summary_ids
        - file_match_ids
    )
    extra_files = sorted(
        file_match_ids
        - summary_ids
    )

    if missing_files:
        report.add_error(
            "Missing match JSON files for summary IDs: "
            + ", ".join(
                missing_files[:10]
            )
            + (
                " ..."
                if len(
                    missing_files
                ) > 10
                else ""
            )
        )

    if extra_files:
        report.add_error(
            "Match JSON files exist without manifest summaries: "
            + ", ".join(
                extra_files[:10]
            )
            + (
                " ..."
                if len(
                    extra_files
                ) > 10
                else ""
            )
        )

    detailed_event_counts: Counter[str] = (
        Counter()
    )
    detailed_participant_count = 0
    detailed_human_count = 0
    detailed_bot_count = 0

    for match_path in match_files:
        match = _load_json(
            match_path,
            report,
        )

        if match is None:
            continue

        summary = summary_by_id.get(
            match_path.stem
        )

        if summary is None:
            continue

        counts = _validate_match_payload(
            match_path=match_path,
            match=match,
            summary=summary,
            map_registry=map_registry,
            report=report,
        )

        detailed_participant_count += (
            counts["participant_count"]
        )
        detailed_human_count += (
            counts["human_count"]
        )
        detailed_bot_count += (
            counts["bot_count"]
        )

        report.track_count += (
            counts["track_count"]
        )
        report.point_count += (
            counts["point_count"]
        )
        report.event_count += (
            counts["event_count"]
        )
        report.out_of_bounds_point_count += (
            counts[
                "out_of_bounds_point_count"
            ]
        )
        report.out_of_bounds_event_count += (
            counts[
                "out_of_bounds_event_count"
            ]
        )

        detailed_event_counts.update(
            counts[
                "event_counts"
            ]
        )

    if (
        detailed_participant_count
        != report.participant_count
    ):
        report.add_error(
            "Aggregate participant count differs between manifest summaries "
            "and detailed match files."
        )

    if (
        detailed_human_count
        != report.human_count
    ):
        report.add_error(
            "Aggregate human count differs between manifest summaries and "
            "detailed match files."
        )

    if (
        detailed_bot_count
        != report.bot_count
    ):
        report.add_error(
            "Aggregate bot count differs between manifest summaries and "
            "detailed match files."
        )

    if detailed_event_counts != (
        aggregate_event_counts
    ):
        report.add_error(
            "Aggregate event counts differ between manifest summaries and "
            "detailed match files."
        )

    manifest_map_ids = manifest.get(
        "map_ids"
    )
    actual_map_ids = sorted(
        map_match_counts
    )

    if manifest_map_ids != actual_map_ids:
        report.add_error(
            "manifest.json map_ids does not match maps referenced by matches."
        )

    manifest_dates = manifest.get(
        "dates"
    )
    actual_dates = sorted(
        date_match_counts
    )

    if manifest_dates != actual_dates:
        report.add_error(
            "manifest.json dates does not match dates referenced by matches."
        )

    report.map_match_counts = dict(
        sorted(
            map_match_counts.items()
        )
    )
    report.date_match_counts = dict(
        sorted(
            date_match_counts.items()
        )
    )
    report.event_counts = {
        event_type: (
            detailed_event_counts[
                event_type
            ]
        )
        for event_type in sorted(
            NORMALIZED_EVENT_TYPES
        )
    }

    if (
        report.out_of_bounds_point_count
        > 0
    ):
        report.add_warning(
            "Some trajectory points fall outside normalized map bounds. "
            "They were preserved intentionally and should be inspected during "
            "projection/minimap validation."
        )

    if (
        report.out_of_bounds_event_count
        > 0
    ):
        report.add_warning(
            "Some event markers fall outside normalized map bounds. "
            "They were preserved intentionally and should be inspected during "
            "projection/minimap validation."
        )

    if enforce_lila_profile:
        _validate_lila_profile(
            manifest=manifest,
            summary_by_id=summary_by_id,
            report=report,
        )

    return report


def _validate_maps_payload(
    *,
    public_root: Path,
    maps_payload: dict[str, Any],
    report: ValidationReport,
) -> dict[str, dict[str, Any]]:
    maps = maps_payload.get(
        "maps"
    )

    if not isinstance(
        maps,
        list,
    ):
        report.add_error(
            "maps.json field 'maps' must be a list."
        )
        return {}

    report.map_count = len(
        maps
    )

    if maps_payload.get(
        "map_count"
    ) != report.map_count:
        report.add_error(
            "maps.json map_count does not match the number of map records."
        )

    registry: dict[str, dict[str, Any]] = {}

    for index, game_map in enumerate(
        maps
    ):
        context = (
            f"maps[{index}]"
        )

        if not isinstance(
            game_map,
            dict,
        ):
            report.add_error(
                f"{context} must be an object."
            )
            continue

        map_id = game_map.get(
            "id"
        )

        if not isinstance(
            map_id,
            str,
        ) or not map_id:
            report.add_error(
                f"{context} has an invalid id."
            )
            continue

        if map_id in registry:
            report.add_error(
                f"Duplicate map ID: {map_id}"
            )
            continue

        registry[
            map_id
        ] = game_map

        image_path = game_map.get(
            "image_path"
        )

        if not isinstance(
            image_path,
            str,
        ) or not image_path.startswith(
            "/"
        ):
            report.add_error(
                f"Map {map_id} has invalid image_path."
            )
        else:
            asset_path = (
                public_root
                / image_path.lstrip(
                    "/"
                )
            )

            if not asset_path.exists():
                report.add_error(
                    f"Map {map_id} asset is missing: {asset_path}"
                )

        width = game_map.get(
            "texture_width"
        )
        height = game_map.get(
            "texture_height"
        )

        if not isinstance(
            width,
            int,
        ) or width <= 0:
            report.add_error(
                f"Map {map_id} has invalid texture_width."
            )

        if not isinstance(
            height,
            int,
        ) or height <= 0:
            report.add_error(
                f"Map {map_id} has invalid texture_height."
            )

        projection = game_map.get(
            "projection"
        )

        if not isinstance(
            projection,
            dict,
        ):
            report.add_error(
                f"Map {map_id} has invalid projection."
            )
            continue

        for key in (
            "origin_x",
            "origin_z",
            "scale",
        ):
            value = projection.get(
                key
            )

            if not _is_finite_number(
                value
            ):
                report.add_error(
                    f"Map {map_id} projection {key} is not finite."
                )

        scale = projection.get(
            "scale"
        )

        if (
            _is_finite_number(
                scale
            )
            and scale <= 0
        ):
            report.add_error(
                f"Map {map_id} projection scale must be positive."
            )

    return registry


def _validate_match_payload(
    *,
    match_path: Path,
    match: dict[str, Any],
    summary: dict[str, Any],
    map_registry: dict[str, dict[str, Any]],
    report: ValidationReport,
) -> dict[str, Any]:
    match_id = match.get(
        "match_id"
    )

    if match_id != match_path.stem:
        report.add_error(
            f"{match_path.name} contains mismatched match_id {match_id!r}."
        )

    if match_id != summary.get(
        "match_id"
    ):
        report.add_error(
            f"{match_path.name} does not match its manifest summary ID."
        )

    for field_name in (
        "date",
        "map_id",
        "duration_seconds",
    ):
        if match.get(
            field_name
        ) != summary.get(
            field_name
        ):
            report.add_error(
                f"Match {match_id} field {field_name} differs from summary."
            )

    map_id = match.get(
        "map_id"
    )

    if map_id not in map_registry:
        report.add_error(
            f"Match {match_id} references missing map {map_id!r}."
        )

    duration = match.get(
        "duration_seconds"
    )

    if (
        not _is_finite_number(
            duration
        )
        or duration < 0
    ):
        report.add_error(
            f"Match {match_id} has invalid duration_seconds."
        )
        duration = 0.0

    participants = match.get(
        "participants"
    )
    tracks = match.get(
        "tracks"
    )
    events = match.get(
        "events"
    )

    if not isinstance(
        participants,
        list,
    ):
        report.add_error(
            f"Match {match_id} participants must be a list."
        )
        participants = []

    if not isinstance(
        tracks,
        list,
    ):
        report.add_error(
            f"Match {match_id} tracks must be a list."
        )
        tracks = []

    if not isinstance(
        events,
        list,
    ):
        report.add_error(
            f"Match {match_id} events must be a list."
        )
        events = []

    participant_categories: dict[
        str,
        str,
    ] = {}

    human_count = 0
    bot_count = 0

    for participant in participants:
        if not isinstance(
            participant,
            dict,
        ):
            report.add_error(
                f"Match {match_id} contains a non-object participant."
            )
            continue

        participant_id = participant.get(
            "id"
        )
        category = participant.get(
            "category"
        )

        if not isinstance(
            participant_id,
            str,
        ) or not participant_id:
            report.add_error(
                f"Match {match_id} contains invalid participant ID."
            )
            continue

        if participant_id in (
            participant_categories
        ):
            report.add_error(
                f"Match {match_id} contains duplicate participant "
                f"{participant_id}."
            )
            continue

        if category not in (
            PARTICIPANT_CATEGORIES
        ):
            report.add_error(
                f"Match {match_id} participant {participant_id} has "
                f"invalid category {category!r}."
            )
            continue

        participant_categories[
            participant_id
        ] = category

        if category == "human":
            human_count += 1
        elif category == "bot":
            bot_count += 1

    if len(
        participants
    ) != summary.get(
        "participant_count"
    ):
        report.add_error(
            f"Match {match_id} participant_count differs from summary."
        )

    if human_count != summary.get(
        "human_count"
    ):
        report.add_error(
            f"Match {match_id} human_count differs from summary."
        )

    if bot_count != summary.get(
        "bot_count"
    ):
        report.add_error(
            f"Match {match_id} bot_count differs from summary."
        )

    track_participant_ids: set[str] = set()
    point_count = 0
    out_of_bounds_point_count = 0

    for track in tracks:
        if not isinstance(
            track,
            dict,
        ):
            report.add_error(
                f"Match {match_id} contains a non-object track."
            )
            continue

        participant_id = track.get(
            "participant_id"
        )

        if participant_id not in (
            participant_categories
        ):
            report.add_error(
                f"Match {match_id} track references unknown participant "
                f"{participant_id!r}."
            )
            continue

        if participant_id in (
            track_participant_ids
        ):
            report.add_error(
                f"Match {match_id} has duplicate tracks for "
                f"{participant_id}."
            )

        track_participant_ids.add(
            participant_id
        )

        points = track.get(
            "points"
        )

        if not isinstance(
            points,
            list,
        ):
            report.add_error(
                f"Match {match_id} track {participant_id} points must be a list."
            )
            continue

        previous_time = (
            -math.inf
        )

        for point_index, point in enumerate(
            points
        ):
            context = (
                f"Match {match_id} track {participant_id} "
                f"point {point_index}"
            )

            if not isinstance(
                point,
                dict,
            ):
                report.add_error(
                    f"{context} must be an object."
                )
                continue

            point_count += 1

            time_seconds = point.get(
                "time_seconds"
            )

            if not _is_finite_number(
                time_seconds
            ):
                report.add_error(
                    f"{context} has non-finite time_seconds."
                )
            else:
                if time_seconds < 0:
                    report.add_error(
                        f"{context} has negative time_seconds."
                    )

                if time_seconds < previous_time:
                    report.add_error(
                        f"{context} is out of chronological order."
                    )

                if time_seconds > duration:
                    report.add_error(
                        f"{context} occurs after match duration."
                    )

                previous_time = (
                    time_seconds
                )

            if not _validate_spatial_record(
                record=point,
                context=context,
                report=report,
            ):
                continue

            if _is_out_of_bounds(
                point
            ):
                out_of_bounds_point_count += 1

    missing_tracks = (
        set(
            participant_categories
        )
        - track_participant_ids
    )

    if missing_tracks:
        report.add_error(
            f"Match {match_id} participants without tracks: "
            + ", ".join(
                sorted(
                    missing_tracks
                )
            )
        )

    event_counter: Counter[str] = Counter()
    out_of_bounds_event_count = 0
    previous_event_time = (
        -math.inf
    )

    for event_index, event in enumerate(
        events
    ):
        context = (
            f"Match {match_id} event {event_index}"
        )

        if not isinstance(
            event,
            dict,
        ):
            report.add_error(
                f"{context} must be an object."
            )
            continue

        event_type = event.get(
            "type"
        )

        if event_type not in (
            NORMALIZED_EVENT_TYPES
        ):
            report.add_error(
                f"{context} has invalid normalized type {event_type!r}."
            )
        else:
            event_counter[
                event_type
            ] += 1

        participant_id = event.get(
            "participant_id"
        )
        participant_category = (
            event.get(
                "participant_category"
            )
        )

        if participant_id not in (
            participant_categories
        ):
            report.add_error(
                f"{context} references unknown participant {participant_id!r}."
            )
        elif (
            participant_category
            != participant_categories[
                participant_id
            ]
        ):
            report.add_error(
                f"{context} participant_category does not match participant."
            )

        owner_role = event.get(
            "owner_role"
        )

        if owner_role not in (
            EVENT_OWNER_ROLES
        ):
            report.add_error(
                f"{context} has invalid owner_role {owner_role!r}."
            )

        for category_field in (
            "source_category",
            "target_category",
        ):
            value = event.get(
                category_field
            )

            if (
                value is not None
                and value not in PARTICIPANT_CATEGORIES
            ):
                report.add_error(
                    f"{context} has invalid {category_field} {value!r}."
                )

        time_seconds = event.get(
            "time_seconds"
        )

        if not _is_finite_number(
            time_seconds
        ):
            report.add_error(
                f"{context} has non-finite time_seconds."
            )
        else:
            if time_seconds < 0:
                report.add_error(
                    f"{context} has negative time_seconds."
                )

            if (
                time_seconds
                < previous_event_time
            ):
                report.add_error(
                    f"{context} is out of chronological order."
                )

            if time_seconds > duration:
                report.add_error(
                    f"{context} occurs after match duration."
                )

            previous_event_time = (
                time_seconds
            )

        if _validate_spatial_record(
            record=event,
            context=context,
            report=report,
        ) and _is_out_of_bounds(
            event
        ):
            out_of_bounds_event_count += 1

        _check_forbidden_raw_content(
            value=event,
            context=context,
            report=report,
        )

    expected_event_counts = (
        summary.get(
            "event_counts"
        )
    )

    if isinstance(
        expected_event_counts,
        dict,
    ):
        normalized_counter = {
            event_type: (
                event_counter[
                    event_type
                ]
            )
            for event_type in (
                NORMALIZED_EVENT_TYPES
            )
        }

        if normalized_counter != (
            expected_event_counts
        ):
            report.add_error(
                f"Match {match_id} event counts differ from summary."
            )

    _check_forbidden_raw_content(
        value=match,
        context=f"Match {match_id}",
        report=report,
    )

    return {
        "participant_count": len(
            participants
        ),
        "human_count": human_count,
        "bot_count": bot_count,
        "track_count": len(
            tracks
        ),
        "point_count": point_count,
        "event_count": len(
            events
        ),
        "out_of_bounds_point_count": (
            out_of_bounds_point_count
        ),
        "out_of_bounds_event_count": (
            out_of_bounds_event_count
        ),
        "event_counts": event_counter,
    }


def _validate_spatial_record(
    *,
    record: dict[str, Any],
    context: str,
    report: ValidationReport,
) -> bool:
    valid = True

    for field_name in (
        "world_x",
        "world_y",
        "world_z",
        "map_u",
        "map_v",
    ):
        if not _is_finite_number(
            record.get(
                field_name
            )
        ):
            report.add_error(
                f"{context} has non-finite {field_name}."
            )
            valid = False

    return valid


def _is_out_of_bounds(
    record: dict[str, Any],
) -> bool:
    map_u = record.get(
        "map_u"
    )
    map_v = record.get(
        "map_v"
    )

    if (
        not _is_finite_number(
            map_u
        )
        or not _is_finite_number(
            map_v
        )
    ):
        return False

    return (
        map_u < 0.0
        or map_u > 1.0
        or map_v < 0.0
        or map_v > 1.0
    )


def _check_forbidden_raw_content(
    *,
    value: Any,
    context: str,
    report: ValidationReport,
) -> None:
    if isinstance(
        value,
        dict,
    ):
        for key, child in (
            value.items()
        ):
            if key in FORBIDDEN_RAW_KEYS:
                report.add_error(
                    f"{context} leaks raw LILA key {key!r}."
                )

            _check_forbidden_raw_content(
                value=child,
                context=context,
                report=report,
            )

    elif isinstance(
        value,
        list,
    ):
        for child in value:
            _check_forbidden_raw_content(
                value=child,
                context=context,
                report=report,
            )

    elif isinstance(
        value,
        str,
    ):
        if value in (
            FORBIDDEN_RAW_EVENT_NAMES
        ):
            report.add_error(
                f"{context} leaks raw LILA event name {value!r}."
            )

        if value.endswith(
            ".nakama-0"
        ):
            report.add_error(
                f"{context} leaks raw .nakama-0 identifier suffix."
            )


def _validate_lila_profile(
    *,
    manifest: dict[str, Any],
    summary_by_id: dict[str, dict[str, Any]],
    report: ValidationReport,
) -> None:
    if report.match_count != (
        EXPECTED_LILA_MATCH_COUNT
    ):
        report.add_error(
            "Expected 796 unique LILA matches after reconstruction, "
            f"found {report.match_count}."
        )

    if set(
        report.map_match_counts
    ) != EXPECTED_LILA_MAP_IDS:
        report.add_error(
            "Exported map IDs do not match the expected LILA map set."
        )

    if (
        report.map_match_counts
        != EXPECTED_LILA_MAP_MATCH_COUNTS
    ):
        report.add_error(
            "Per-map match counts do not match the Phase 1 LILA audit."
        )

    if set(
        report.date_match_counts
    ) != EXPECTED_LILA_DATES:
        report.add_error(
            "Exported ISO dates do not match the expected five LILA dates."
        )

    if (
        report.date_match_counts
        != EXPECTED_LILA_DATE_MATCH_COUNTS
    ):
        report.add_error(
            "Per-date canonical match counts do not reconcile with the "
            "known cross-date exact duplicate."
        )

    if report.participant_count != (
        EXPECTED_LILA_CANONICAL_PARTICIPANT_COUNT
    ):
        report.add_error(
            "Canonical participant total does not match expected deduplicated "
            "LILA count of 1242."
        )

    if report.human_count != (
        EXPECTED_LILA_CANONICAL_HUMAN_COUNT
    ):
        report.add_error(
            "Canonical human participant total does not match expected 798."
        )

    if report.bot_count != (
        EXPECTED_LILA_CANONICAL_BOT_COUNT
    ):
        report.add_error(
            "Canonical bot participant total does not match expected 444."
        )

    duplicate_summary = (
        summary_by_id.get(
            KNOWN_DUPLICATE_MATCH_ID
        )
    )

    if duplicate_summary is None:
        report.add_error(
            "Known duplicate match is missing from the final manifest."
        )
    elif duplicate_summary.get(
        "participant_count"
    ) != (
        EXPECTED_DUPLICATE_MATCH_PARTICIPANT_COUNT
    ):
        report.add_error(
            "Known duplicate match did not resolve to 7 canonical participants."
        )


def _load_json(
    file_path: Path,
    report: ValidationReport,
) -> dict[str, Any] | None:
    try:
        with file_path.open(
            "r",
            encoding="utf-8",
        ) as file_handle:
            payload = json.load(
                file_handle
            )
    except (
        OSError,
        json.JSONDecodeError,
    ) as exc:
        report.add_error(
            f"Could not read valid JSON from {file_path}: {exc}"
        )
        return None

    if not isinstance(
        payload,
        dict,
    ):
        report.add_error(
            f"Top-level JSON payload must be an object: {file_path}"
        )
        return None

    return payload


def _is_finite_number(
    value: Any,
) -> bool:
    return (
        isinstance(
            value,
            (int, float),
        )
        and not isinstance(
            value,
            bool,
        )
        and math.isfinite(
            value
        )
    )


def _looks_like_iso_date(
    value: str,
) -> bool:
    if len(
        value
    ) != 10:
        return False

    return (
        value[4] == "-"
        and value[7] == "-"
        and value[:4].isdigit()
        and value[5:7].isdigit()
        and value[8:].isdigit()
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate the normalized browser-facing telemetry export."
        )
    )

    parser.add_argument(
        "--public-root",
        type=Path,
        default=Path(
            "public"
        ),
        help=(
            "Frontend public directory containing data/ and assets/."
        ),
    )

    parser.add_argument(
        "--generic",
        action="store_true",
        help=(
            "Validate only the generic normalized contract and skip "
            "LILA dataset-specific expected counts."
        ),
    )

    parser.add_argument(
        "--report-json",
        type=Path,
        default=None,
        help=(
            "Optional path to write the machine-readable validation report."
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    report = validate_exported_dataset(
        args.public_root,
        enforce_lila_profile=(
            not args.generic
        ),
    )

    print(
        "Normalized static dataset validation"
    )
    print(
        f"Status: {'PASS' if report.passed else 'FAIL'}"
    )
    print(
        f"Matches: {report.match_count}"
    )
    print(
        f"Maps: {report.map_count}"
    )
    print(
        f"Participants: {report.participant_count} "
        f"(human={report.human_count}, bot={report.bot_count})"
    )
    print(
        f"Tracks: {report.track_count}"
    )
    print(
        f"Trajectory points: {report.point_count}"
    )
    print(
        f"Events: {report.event_count}"
    )
    print(
        f"Event counts: {report.event_counts}"
    )
    print(
        f"Map match counts: {report.map_match_counts}"
    )
    print(
        f"Date match counts: {report.date_match_counts}"
    )
    print(
        "Out-of-bounds coordinates: "
        f"points={report.out_of_bounds_point_count}, "
        f"events={report.out_of_bounds_event_count}"
    )

    if report.warnings:
        print(
            "Warnings:"
        )
        for warning in report.warnings:
            print(
                f"  - {warning}"
            )

    if report.errors:
        print(
            "Errors:"
        )
        for error in report.errors:
            print(
                f"  - {error}"
            )

    if args.report_json is not None:
        args.report_json.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with args.report_json.open(
            "w",
            encoding="utf-8",
            newline="\n",
        ) as file_handle:
            json.dump(
                report.to_dict(),
                file_handle,
                indent=2,
                ensure_ascii=False,
            )
            file_handle.write(
                "\n"
            )

        print(
            f"Report written: {args.report_json.resolve()}"
        )

    if not report.passed:
        raise SystemExit(
            1
        )


if __name__ == "__main__":
    main()
