from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from statistics import mean, median


PROJECT_ROOT = Path(__file__).resolve().parents[2]

REPORTS_DIR = PROJECT_ROOT / "reports"

TELEMETRY_SCAN_PATH = REPORTS_DIR / "telemetry_scan.json"
INVENTORY_PATH = REPORTS_DIR / "dataset_inventory.json"

OUTPUT_PATH = REPORTS_DIR / "match_aggregation.json"


def load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(
            f"Required audit file does not exist: {path}"
        )

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def raw_timestamp_to_integer_ms(value: str) -> int:
    """
    Convert the timestamp string produced during telemetry scanning
    back into its stored millisecond integer representation.

    Important:
    The resulting integer is NOT treated as a real Unix timestamp.

    We only use differences between values.

    Observed telemetry strongly suggests that a delta of 1 stored
    millisecond should be interpreted as approximately 1 gameplay second.
    """

    dt = datetime.fromisoformat(value)

    epoch = datetime(1970, 1, 1)

    delta = dt - epoch

    return int(round(delta.total_seconds() * 1000))


def build_duplicate_path_set(inventory: dict) -> set[str]:
    duplicate_paths: set[str] = set()

    for group in inventory.get("duplicate_content_groups", []):
        for path in group.get("paths", []):
            duplicate_paths.add(path)

    return duplicate_paths


def aggregate_match(
    match_id: str,
    file_reports: list[dict],
    exact_duplicate_paths: set[str],
) -> dict:
    participant_ids = []
    participant_category_counts = Counter()

    row_count = 0
    event_counts = Counter()

    maps = set()
    dates = set()

    file_paths = []

    timestamp_failure_files = []
    duplicate_content_files = []

    participant_files = defaultdict(list)

    participant_timeline = []

    file_start_values = []
    file_end_values = []

    for report in file_reports:
        path = report["path"]

        file_paths.append(path)

        row_count += report["row_count"]

        for map_id in report.get("map_ids", []):
            maps.add(map_id)

        dates.add(report["date"])

        user_ids = report.get("record_user_ids", [])

        if len(user_ids) == 1:
            user_id = user_ids[0]
            participant_ids.append(user_id)
            participant_files[user_id].append(path)

        category = report.get(
            "participant_category",
            "unknown",
        )

        participant_category_counts[category] += 1

        for event, count in report.get(
            "event_counts",
            {},
        ).items():
            event_counts[event] += count

        timestamp = report["timestamp"]

        first_raw = raw_timestamp_to_integer_ms(
            timestamp["first_raw_display"]
        )

        last_raw = raw_timestamp_to_integer_ms(
            timestamp["last_raw_display"]
        )

        file_start_values.append(first_raw)
        file_end_values.append(last_raw)

        participant_timeline.append(
            {
                "path": path,
                "user_id": (
                    user_ids[0]
                    if len(user_ids) == 1
                    else None
                ),
                "category": category,
                "first_raw_value": first_raw,
                "last_raw_value": last_raw,
                "duration_seconds": (
                    last_raw - first_raw
                ),
            }
        )

        if not timestamp.get("non_decreasing", True):
            timestamp_failure_files.append(path)

        if path in exact_duplicate_paths:
            duplicate_content_files.append(path)

    match_start_raw = min(file_start_values)
    match_end_raw = max(file_end_values)

    inferred_match_duration_seconds = (
        match_end_raw - match_start_raw
    )

    for participant in participant_timeline:
        participant["start_offset_seconds"] = (
            participant["first_raw_value"]
            - match_start_raw
        )

        participant["end_offset_seconds"] = (
            participant["last_raw_value"]
            - match_start_raw
        )

        del participant["first_raw_value"]
        del participant["last_raw_value"]

    duplicate_participants = {
        user_id: paths
        for user_id, paths in participant_files.items()
        if len(paths) > 1
    }

    unique_participant_ids = sorted(
        set(participant_ids)
    )

    raw_file_count = len(file_reports)
    unique_participant_count = len(
        unique_participant_ids
    )

    anomaly_flags = []

    if len(maps) > 1:
        anomaly_flags.append("multiple_maps")

    if len(dates) > 1:
        anomaly_flags.append("multiple_dates")

    if duplicate_participants:
        anomaly_flags.append(
            "duplicate_participant_in_match"
        )

    if duplicate_content_files:
        anomaly_flags.append(
            "exact_duplicate_content"
        )

    if timestamp_failure_files:
        anomaly_flags.append(
            "timestamp_order_failure"
        )

    return {
        "match_id": match_id,
        "dates": sorted(dates),
        "maps": sorted(maps),

        "raw_file_count": raw_file_count,
        "unique_participant_count": (
            unique_participant_count
        ),

        "participant_category_counts": dict(
            sorted(
                participant_category_counts.items()
            )
        ),

        "row_count": row_count,

        "event_counts": dict(
            sorted(event_counts.items())
        ),

        "timeline": {
            "match_start_raw_value": match_start_raw,
            "match_end_raw_value": match_end_raw,
            "inferred_duration_seconds": (
                inferred_match_duration_seconds
            ),
        },

        "participants": sorted(
            participant_timeline,
            key=lambda participant: (
                participant["start_offset_seconds"],
                participant["user_id"] or "",
            ),
        ),

        "duplicate_participants": (
            duplicate_participants
        ),

        "duplicate_content_files": sorted(
            duplicate_content_files
        ),

        "timestamp_order_failure_files": sorted(
            timestamp_failure_files
        ),

        "anomaly_flags": anomaly_flags,

        "source_files": sorted(file_paths),
    }


def main() -> None:
    telemetry_scan = load_json(
        TELEMETRY_SCAN_PATH
    )

    inventory = load_json(
        INVENTORY_PATH
    )

    exact_duplicate_paths = (
        build_duplicate_path_set(inventory)
    )

    matches_by_id = defaultdict(list)

    for file_report in telemetry_scan["files"]:
        if file_report.get("empty_file"):
            continue

        match_id = file_report.get(
            "filename_match_id"
        )

        if match_id is None:
            continue

        matches_by_id[match_id].append(
            file_report
        )

    reconstructed_matches = []

    print("MATCH RECONSTRUCTION")
    print("=" * 70)
    print(
        f"Participant files available: "
        f"{len(telemetry_scan['files'])}"
    )
    print(
        f"Unique match IDs discovered: "
        f"{len(matches_by_id)}"
    )
    print()

    for index, match_id in enumerate(
        sorted(matches_by_id),
        start=1,
    ):
        match_report = aggregate_match(
            match_id=match_id,
            file_reports=matches_by_id[match_id],
            exact_duplicate_paths=(
                exact_duplicate_paths
            ),
        )

        reconstructed_matches.append(
            match_report
        )

        if (
            index % 100 == 0
            or index == len(matches_by_id)
        ):
            print(
                f"Reconstructed "
                f"{index}/{len(matches_by_id)} matches"
            )

    participant_counts = [
        match["unique_participant_count"]
        for match in reconstructed_matches
    ]

    raw_file_counts = [
        match["raw_file_count"]
        for match in reconstructed_matches
    ]

    durations = [
        match["timeline"][
            "inferred_duration_seconds"
        ]
        for match in reconstructed_matches
    ]

    anomaly_counter = Counter()

    matches_with_anomalies = []

    map_match_counts = Counter()
    date_match_counts = Counter()

    human_count_distribution = []
    bot_count_distribution = []

    for match in reconstructed_matches:
        for flag in match["anomaly_flags"]:
            anomaly_counter[flag] += 1

        if match["anomaly_flags"]:
            matches_with_anomalies.append(
                {
                    "match_id": match["match_id"],
                    "flags": match["anomaly_flags"],
                }
            )

        for map_id in match["maps"]:
            map_match_counts[map_id] += 1

        for date in match["dates"]:
            date_match_counts[date] += 1

        category_counts = (
            match[
                "participant_category_counts"
            ]
        )

        human_count_distribution.append(
            category_counts.get("human", 0)
        )

        bot_count_distribution.append(
            category_counts.get("bot", 0)
        )

    largest_matches = sorted(
        reconstructed_matches,
        key=lambda match: (
            match["unique_participant_count"],
            match["row_count"],
        ),
        reverse=True,
    )[:10]

    longest_matches = sorted(
        reconstructed_matches,
        key=lambda match: match["timeline"][
            "inferred_duration_seconds"
        ],
        reverse=True,
    )[:10]

    summary = {
        "total_matches": len(
            reconstructed_matches
        ),

        "participant_files": len(
            telemetry_scan["files"]
        ),

        "match_file_count_stats": {
            "min": min(raw_file_counts),
            "max": max(raw_file_counts),
            "mean": mean(raw_file_counts),
            "median": median(raw_file_counts),
        },

        "unique_participant_count_stats": {
            "min": min(participant_counts),
            "max": max(participant_counts),
            "mean": mean(participant_counts),
            "median": median(
                participant_counts
            ),
        },

        "duration_seconds_stats": {
            "min": min(durations),
            "max": max(durations),
            "mean": mean(durations),
            "median": median(durations),
        },

        "human_participant_count_stats": {
            "min": min(
                human_count_distribution
            ),
            "max": max(
                human_count_distribution
            ),
            "mean": mean(
                human_count_distribution
            ),
            "median": median(
                human_count_distribution
            ),
        },

        "bot_participant_count_stats": {
            "min": min(
                bot_count_distribution
            ),
            "max": max(
                bot_count_distribution
            ),
            "mean": mean(
                bot_count_distribution
            ),
            "median": median(
                bot_count_distribution
            ),
        },

        "matches_by_map": dict(
            sorted(map_match_counts.items())
        ),

        "matches_by_date": dict(
            sorted(date_match_counts.items())
        ),

        "anomaly_counts": dict(
            sorted(anomaly_counter.items())
        ),

        "matches_with_anomalies": (
            matches_with_anomalies
        ),

        "largest_matches": [
            {
                "match_id": match["match_id"],
                "participants": (
                    match[
                        "unique_participant_count"
                    ]
                ),
                "files": (
                    match["raw_file_count"]
                ),
                "rows": match["row_count"],
                "maps": match["maps"],
                "dates": match["dates"],
            }
            for match in largest_matches
        ],

        "longest_matches": [
            {
                "match_id": match["match_id"],
                "duration_seconds": (
                    match["timeline"][
                        "inferred_duration_seconds"
                    ]
                ),
                "participants": (
                    match[
                        "unique_participant_count"
                    ]
                ),
                "maps": match["maps"],
                "dates": match["dates"],
            }
            for match in longest_matches
        ],

        "matches": reconstructed_matches,
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
            summary,
            file,
            indent=2,
        )

    print()
    print("MATCH SUMMARY")
    print("=" * 70)

    print(
        f"Total reconstructed matches: "
        f"{summary['total_matches']}"
    )

    print()
    print("Participant files per match:")
    stats = summary[
        "match_file_count_stats"
    ]

    print(f"  Min: {stats['min']}")
    print(f"  Median: {stats['median']}")
    print(f"  Mean: {stats['mean']:.2f}")
    print(f"  Max: {stats['max']}")

    print()
    print("Unique participants per match:")
    stats = summary[
        "unique_participant_count_stats"
    ]

    print(f"  Min: {stats['min']}")
    print(f"  Median: {stats['median']}")
    print(f"  Mean: {stats['mean']:.2f}")
    print(f"  Max: {stats['max']}")

    print()
    print(
        "Inferred match duration "
        "(seconds):"
    )

    stats = summary[
        "duration_seconds_stats"
    ]

    print(f"  Min: {stats['min']}")
    print(f"  Median: {stats['median']}")
    print(f"  Mean: {stats['mean']:.2f}")
    print(f"  Max: {stats['max']}")

    print()
    print("Matches by map:")

    for map_id, count in summary[
        "matches_by_map"
    ].items():
        print(
            f"  {map_id}: {count}"
        )

    print()
    print("Matches by date:")

    for date, count in summary[
        "matches_by_date"
    ].items():
        print(
            f"  {date}: {count}"
        )

    print()
    print("Match anomaly counts:")

    if summary["anomaly_counts"]:
        for flag, count in summary[
            "anomaly_counts"
        ].items():
            print(
                f"  {flag}: {count}"
            )
    else:
        print("  None")

    print()
    print("Largest reconstructed matches:")

    for match in summary[
        "largest_matches"
    ][:5]:
        print(
            f"  {match['match_id']} | "
            f"{match['participants']} participants | "
            f"{match['rows']} rows | "
            f"{', '.join(match['maps'])}"
        )

    print()
    print("Longest inferred matches:")

    for match in summary[
        "longest_matches"
    ][:5]:
        duration = match[
            "duration_seconds"
        ]

        minutes = duration / 60

        print(
            f"  {match['match_id']} | "
            f"{duration} sec "
            f"({minutes:.2f} min) | "
            f"{match['participants']} participants"
        )

    print()
    print(
        f"Match aggregation written to: "
        f"{OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()