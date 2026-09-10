from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import polars as pl


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_ROOT = PROJECT_ROOT / "raw-data" / "extracted" / "player_data"
REPORTS_DIR = PROJECT_ROOT / "reports"

EXPECTED_EVENTS = {
    "Position",
    "BotPosition",
    "Kill",
    "Killed",
    "BotKill",
    "BotKilled",
    "KilledByStorm",
    "Loot",
}


def decode_event(value: object) -> str | None:
    if value is None:
        return None

    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except UnicodeDecodeError:
            return repr(value)

    return str(value)


def parse_filename(path: Path) -> tuple[str | None, str | None]:
    stem = path.name.removesuffix(".nakama-0")

    try:
        user_id, match_id = stem.rsplit("_", 1)
        return user_id, match_id
    except ValueError:
        return None, None


def classify_participant(
    user_id: str,
    events: set[str],
) -> tuple[str, dict]:
    numeric_user_id = user_id.isdigit()
    has_position = "Position" in events
    has_bot_position = "BotPosition" in events

    if has_bot_position and not has_position:
        category = "bot"
    elif has_position and not has_bot_position:
        category = "human"
    elif has_position and has_bot_position:
        category = "mixed"
    else:
        category = "unknown"

    evidence = {
        "numeric_user_id": numeric_user_id,
        "has_position": has_position,
        "has_bot_position": has_bot_position,
    }

    return category, evidence


def datetime_ms_value(value: datetime) -> int:
    return int(value.timestamp() * 1000)


def reinterpret_as_unix_seconds(value: datetime) -> str:
    raw_integer = datetime_ms_value(value)

    try:
        interpreted = datetime.fromtimestamp(
            raw_integer,
            tz=timezone.utc,
        )
        return interpreted.isoformat()
    except (ValueError, OSError, OverflowError):
        return "invalid"


def inspect_file(path: Path) -> dict:
    df = pl.read_parquet(path)

    relative_path = path.relative_to(DATASET_ROOT)

    filename_user_id, filename_match_id = parse_filename(path)

    row_count = df.height

    if row_count == 0:
        return {
            "path": str(relative_path),
            "date": relative_path.parts[0],
            "row_count": 0,
            "empty_file": True,
        }

    decoded_events = [
        decode_event(value)
        for value in df["event"].to_list()
    ]

    event_counts = Counter(decoded_events)
    event_set = {
        event
        for event in decoded_events
        if event is not None
    }

    user_values = df["user_id"].drop_nulls().unique().to_list()
    match_values = df["match_id"].drop_nulls().unique().to_list()
    map_values = df["map_id"].drop_nulls().unique().to_list()

    record_user_id = str(user_values[0]) if len(user_values) == 1 else None

    participant_category = "unknown"
    classification_evidence = {}

    if record_user_id is not None:
        participant_category, classification_evidence = classify_participant(
            record_user_id,
            event_set,
        )

    ts_values = df["ts"].to_list()

    ts_ms_values = [
        datetime_ms_value(value)
        for value in ts_values
        if value is not None
    ]

    timestamp_non_decreasing = all(
        left <= right
        for left, right in zip(
            ts_ms_values,
            ts_ms_values[1:],
        )
    )

    first_ts = min(ts_values)
    last_ts = max(ts_values)

    raw_duration_ms = (
        datetime_ms_value(last_ts)
        - datetime_ms_value(first_ts)
    )

    # Based on observed data, the underlying integer appears to represent
    # Unix seconds despite the Parquet logical type being timestamp[ms].
    inferred_duration_seconds = raw_duration_ms

    numeric_issues = {}

    coordinate_ranges = {}

    for column in ["x", "y", "z"]:
        values = df[column].to_list()

        finite_values = [
            float(value)
            for value in values
            if value is not None and math.isfinite(float(value))
        ]

        non_finite_count = sum(
            1
            for value in values
            if value is not None
            and not math.isfinite(float(value))
        )

        coordinate_ranges[column] = {
            "min": min(finite_values) if finite_values else None,
            "max": max(finite_values) if finite_values else None,
        }

        numeric_issues[column] = {
            "non_finite_count": non_finite_count,
        }

    null_counts = {
        column: int(df[column].null_count())
        for column in df.columns
    }

    normalized_record_match_ids = [
        str(value).removesuffix(".nakama-0")
        for value in match_values
    ]

    identity_check = {
        "single_user_id": len(user_values) == 1,
        "single_match_id": len(match_values) == 1,
        "single_map_id": len(map_values) == 1,
        "user_id_matches_filename": (
            len(user_values) == 1
            and str(user_values[0]) == filename_user_id
        ),
        "match_id_matches_filename": (
            len(normalized_record_match_ids) == 1
            and normalized_record_match_ids[0] == filename_match_id
        ),
    }

    unknown_events = sorted(
        event
        for event in event_set
        if event not in EXPECTED_EVENTS
    )

    return {
        "path": str(relative_path),
        "date": relative_path.parts[0],
        "filename_user_id": filename_user_id,
        "filename_match_id": filename_match_id,
        "row_count": row_count,
        "empty_file": False,
        "record_user_ids": [str(value) for value in user_values],
        "record_match_ids": [str(value) for value in match_values],
        "map_ids": [str(value) for value in map_values],
        "participant_category": participant_category,
        "classification_evidence": classification_evidence,
        "event_counts": dict(sorted(event_counts.items())),
        "unknown_events": unknown_events,
        "null_counts": null_counts,
        "identity_check": identity_check,
        "timestamp": {
            "first_raw_display": first_ts.isoformat(),
            "last_raw_display": last_ts.isoformat(),
            "first_reinterpreted_as_unix_seconds": (
                reinterpret_as_unix_seconds(first_ts)
            ),
            "last_reinterpreted_as_unix_seconds": (
                reinterpret_as_unix_seconds(last_ts)
            ),
            "raw_duration_ms": raw_duration_ms,
            "inferred_duration_seconds": inferred_duration_seconds,
            "non_decreasing": timestamp_non_decreasing,
        },
        "coordinates": coordinate_ranges,
        "numeric_issues": numeric_issues,
    }


def main() -> None:
    files = sorted(DATASET_ROOT.rglob("*.nakama-0"))

    print("FULL TELEMETRY SCAN")
    print("=" * 70)
    print(f"Files discovered: {len(files)}")
    print()

    file_reports = []

    global_events = Counter()
    events_by_date = defaultdict(Counter)
    events_by_map = defaultdict(Counter)
    events_by_category = defaultdict(Counter)

    category_counts = Counter()

    unknown_events = Counter()

    null_totals = Counter()

    identity_failures = Counter()

    empty_files = []

    timestamp_order_failures = []

    mixed_participants = []
    unknown_participants = []

    map_counts = Counter()

    numeric_id_category = Counter()
    uuid_id_category = Counter()

    for index, path in enumerate(files, start=1):
        report = inspect_file(path)
        file_reports.append(report)

        if report["empty_file"]:
            empty_files.append(report["path"])
            continue

        category = report["participant_category"]
        category_counts[category] += 1

        user_id = report["record_user_ids"][0] if (
            len(report["record_user_ids"]) == 1
        ) else ""

        if user_id.isdigit():
            numeric_id_category[category] += 1
        else:
            uuid_id_category[category] += 1

        if category == "mixed":
            mixed_participants.append(report["path"])

        if category == "unknown":
            unknown_participants.append(report["path"])

        for event, count in report["event_counts"].items():
            global_events[event] += count
            events_by_date[report["date"]][event] += count
            events_by_category[category][event] += count

            for map_id in report["map_ids"]:
                events_by_map[map_id][event] += count

        for event in report["unknown_events"]:
            unknown_events[event] += report["event_counts"][event]

        for column, count in report["null_counts"].items():
            null_totals[column] += count

        for key, passed in report["identity_check"].items():
            if not passed:
                identity_failures[key] += 1

        if not report["timestamp"]["non_decreasing"]:
            timestamp_order_failures.append(report["path"])

        for map_id in report["map_ids"]:
            map_counts[map_id] += 1

        if index % 100 == 0 or index == len(files):
            print(f"Scanned {index}/{len(files)} files")

    summary = {
        "total_files": len(files),
        "empty_files": empty_files,
        "participant_categories": dict(category_counts),
        "numeric_user_id_categories": dict(numeric_id_category),
        "uuid_user_id_categories": dict(uuid_id_category),
        "maps": dict(map_counts),
        "global_event_counts": dict(sorted(global_events.items())),
        "events_by_date": {
            key: dict(sorted(value.items()))
            for key, value in sorted(events_by_date.items())
        },
        "events_by_map": {
            key: dict(sorted(value.items()))
            for key, value in sorted(events_by_map.items())
        },
        "events_by_participant_category": {
            key: dict(sorted(value.items()))
            for key, value in sorted(events_by_category.items())
        },
        "unknown_events": dict(sorted(unknown_events.items())),
        "null_totals": dict(null_totals),
        "identity_failures": dict(identity_failures),
        "timestamp_order_failures": timestamp_order_failures,
        "mixed_participant_files": mixed_participants,
        "unknown_participant_files": unknown_participants,
        "files": file_reports,
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    output_path = REPORTS_DIR / "telemetry_scan.json"

    with output_path.open("w", encoding="utf-8") as file:
        json.dump(summary, file, indent=2)

    print()
    print("SCAN SUMMARY")
    print("=" * 70)

    print(f"Total files: {summary['total_files']}")
    print(f"Empty files: {len(empty_files)}")

    print()
    print("Participant categories:")
    for category, count in sorted(category_counts.items()):
        print(f"  {category}: {count}")

    print()
    print("Numeric user ID classification:")
    for category, count in sorted(numeric_id_category.items()):
        print(f"  {category}: {count}")

    print()
    print("UUID user ID classification:")
    for category, count in sorted(uuid_id_category.items()):
        print(f"  {category}: {count}")

    print()
    print("Maps:")
    for map_id, count in sorted(map_counts.items()):
        print(f"  {map_id}: {count} files")

    print()
    print("Global events:")
    for event, count in sorted(global_events.items()):
        print(f"  {event}: {count}")

    print()
    print(f"Unknown event types: {len(unknown_events)}")

    for event, count in sorted(unknown_events.items()):
        print(f"  {event}: {count}")

    print()
    print("Null totals:")
    for column, count in sorted(null_totals.items()):
        print(f"  {column}: {count}")

    print()
    print("Identity consistency failures:")
    if identity_failures:
        for key, count in sorted(identity_failures.items()):
            print(f"  {key}: {count}")
    else:
        print("  None")

    print()
    print(
        "Timestamp ordering failures: "
        f"{len(timestamp_order_failures)}"
    )

    print(
        "Mixed participant files: "
        f"{len(mixed_participants)}"
    )

    print(
        "Unknown participant files: "
        f"{len(unknown_participants)}"
    )

    print()
    print(f"Telemetry scan written to: {output_path}")


if __name__ == "__main__":
    main()