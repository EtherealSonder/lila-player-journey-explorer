from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
from typing import Any


KNOWN_DUPLICATE_MATCH_ID = (
    "ac049b28-8116-4ff1-9e60-4be0537b8cc9"
)


def inspect_generated_matches(
    public_root: Path,
) -> dict[str, Any]:
    """
    Build a compact manual-inspection packet from generated static data.

    The packet deliberately selects several different kinds of matches:
    - known exact-duplicate reconstruction
    - largest participant-count match
    - longest-duration match
    - most event-rich match
    - one representative match from each map

    It also summarizes generated file sizes and checks that the selected
    detailed match files reconcile with their manifest summaries.
    """

    public_root = public_root.resolve()
    data_root = public_root / "data"
    matches_root = data_root / "matches"

    manifest = _load_json(
        data_root / "manifest.json"
    )
    maps_payload = _load_json(
        data_root / "maps.json"
    )

    summaries = manifest.get(
        "matches",
        [],
    )

    if not summaries:
        raise ValueError(
            "manifest.json contains no match summaries."
        )

    summary_by_id = {
        summary["match_id"]: summary
        for summary in summaries
    }

    selected_ids: list[str] = []

    if KNOWN_DUPLICATE_MATCH_ID in summary_by_id:
        selected_ids.append(
            KNOWN_DUPLICATE_MATCH_ID
        )

    largest_participant = max(
        summaries,
        key=lambda summary: (
            summary["participant_count"],
            summary["match_id"],
        ),
    )
    selected_ids.append(
        largest_participant[
            "match_id"
        ]
    )

    longest_match = max(
        summaries,
        key=lambda summary: (
            summary["duration_seconds"],
            summary["match_id"],
        ),
    )
    selected_ids.append(
        longest_match[
            "match_id"
        ]
    )

    most_event_rich = max(
        summaries,
        key=lambda summary: (
            sum(
                summary[
                    "event_counts"
                ].values()
            ),
            summary["match_id"],
        ),
    )
    selected_ids.append(
        most_event_rich[
            "match_id"
        ]
    )

    for map_id in sorted(
        {
            summary["map_id"]
            for summary in summaries
        }
    ):
        candidates = [
            summary
            for summary in summaries
            if summary[
                "map_id"
            ] == map_id
        ]

        representative = max(
            candidates,
            key=lambda summary: (
                summary[
                    "participant_count"
                ],
                sum(
                    summary[
                        "event_counts"
                    ].values()
                ),
                summary[
                    "duration_seconds"
                ],
                summary[
                    "match_id"
                ],
            ),
        )

        selected_ids.append(
            representative[
                "match_id"
            ]
        )

    selected_ids = _deduplicate_preserving_order(
        selected_ids
    )

    selected_matches = []

    for match_id in selected_ids:
        match_path = (
            matches_root
            / f"{match_id}.json"
        )

        match = _load_json(
            match_path
        )
        summary = summary_by_id[
            match_id
        ]

        selected_matches.append(
            _summarize_selected_match(
                match_path=match_path,
                match=match,
                summary=summary,
            )
        )

    map_files = []

    for game_map in maps_payload.get(
        "maps",
        [],
    ):
        image_path = (
            public_root
            / game_map[
                "image_path"
            ].lstrip(
                "/"
            )
        )

        map_files.append(
            {
                "map_id": game_map[
                    "id"
                ],
                "image_path": game_map[
                    "image_path"
                ],
                "texture_width": game_map[
                    "texture_width"
                ],
                "texture_height": game_map[
                    "texture_height"
                ],
                "file_size_bytes": (
                    image_path.stat().st_size
                    if image_path.exists()
                    else None
                ),
            }
        )

    match_json_files = sorted(
        matches_root.glob(
            "*.json"
        )
    )

    match_file_sizes = [
        path.stat().st_size
        for path in match_json_files
    ]

    report = {
        "manifest_match_count": manifest.get(
            "match_count"
        ),
        "actual_match_file_count": len(
            match_json_files
        ),
        "selected_match_count": len(
            selected_matches
        ),
        "selected_matches": (
            selected_matches
        ),
        "map_assets": map_files,
        "match_file_sizes": {
            "smallest_bytes": min(
                match_file_sizes
            ),
            "largest_bytes": max(
                match_file_sizes
            ),
            "average_bytes": round(
                sum(
                    match_file_sizes
                )
                / len(
                    match_file_sizes
                ),
                2,
            ),
            "total_bytes": sum(
                match_file_sizes
            ),
        },
    }

    return report


def _summarize_selected_match(
    *,
    match_path: Path,
    match: dict[str, Any],
    summary: dict[str, Any],
) -> dict[str, Any]:
    participants = match[
        "participants"
    ]
    tracks = match[
        "tracks"
    ]
    events = match[
        "events"
    ]

    participant_categories = Counter(
        participant[
            "category"
        ]
        for participant in participants
    )

    event_counts = Counter(
        event[
            "type"
        ]
        for event in events
    )

    point_counts = {
        track[
            "participant_id"
        ]: len(
            track[
                "points"
            ]
        )
        for track in tracks
    }

    all_points = [
        point
        for track in tracks
        for point in track[
            "points"
        ]
    ]

    all_spatial_records = (
        all_points
        + events
    )

    map_u_values = [
        record[
            "map_u"
        ]
        for record in all_spatial_records
    ]
    map_v_values = [
        record[
            "map_v"
        ]
        for record in all_spatial_records
    ]

    first_event = (
        events[0]
        if events
        else None
    )
    last_event = (
        events[-1]
        if events
        else None
    )

    summary_reconciles = (
        summary[
            "participant_count"
        ] == len(
            participants
        )
        and summary[
            "human_count"
        ] == participant_categories[
            "human"
        ]
        and summary[
            "bot_count"
        ] == participant_categories[
            "bot"
        ]
        and summary[
            "event_counts"
        ] == {
            event_type: event_counts[
                event_type
            ]
            for event_type in (
                "kill",
                "death",
                "storm_death",
                "loot",
            )
        }
    )

    return {
        "match_id": match[
            "match_id"
        ],
        "date": match[
            "date"
        ],
        "map_id": match[
            "map_id"
        ],
        "duration_seconds": match[
            "duration_seconds"
        ],
        "file_size_bytes": (
            match_path.stat().st_size
        ),
        "participant_count": len(
            participants
        ),
        "human_count": participant_categories[
            "human"
        ],
        "bot_count": participant_categories[
            "bot"
        ],
        "track_count": len(
            tracks
        ),
        "trajectory_point_count": len(
            all_points
        ),
        "event_count": len(
            events
        ),
        "event_counts": {
            event_type: event_counts[
                event_type
            ]
            for event_type in (
                "kill",
                "death",
                "storm_death",
                "loot",
            )
        },
        "smallest_track_point_count": min(
            point_counts.values()
        ),
        "largest_track_point_count": max(
            point_counts.values()
        ),
        "map_u_range": [
            min(
                map_u_values
            ),
            max(
                map_u_values
            ),
        ],
        "map_v_range": [
            min(
                map_v_values
            ),
            max(
                map_v_values
            ),
        ],
        "first_event": _compact_event(
            first_event
        ),
        "last_event": _compact_event(
            last_event
        ),
        "summary_reconciles": (
            summary_reconciles
        ),
    }


def _compact_event(
    event: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if event is None:
        return None

    return {
        "time_seconds": event[
            "time_seconds"
        ],
        "type": event[
            "type"
        ],
        "participant_id": event[
            "participant_id"
        ],
        "participant_category": event[
            "participant_category"
        ],
        "owner_role": event[
            "owner_role"
        ],
        "map_u": event[
            "map_u"
        ],
        "map_v": event[
            "map_v"
        ],
    }


def _deduplicate_preserving_order(
    values: list[str],
) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []

    for value in values:
        if value in seen:
            continue

        seen.add(
            value
        )
        result.append(
            value
        )

    return result


def _load_json(
    path: Path,
) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(
            f"Required generated file is missing: {path}"
        )

    with path.open(
        "r",
        encoding="utf-8",
    ) as file_handle:
        payload = json.load(
            file_handle
        )

    if not isinstance(
        payload,
        dict,
    ):
        raise ValueError(
            f"Expected top-level JSON object: {path}"
        )

    return payload


def _format_bytes(
    size_bytes: int | float | None,
) -> str:
    if size_bytes is None:
        return "missing"

    size = float(
        size_bytes
    )

    for unit in (
        "B",
        "KB",
        "MB",
        "GB",
    ):
        if size < 1024.0:
            return (
                f"{size:.2f} {unit}"
            )

        size /= 1024.0

    return (
        f"{size:.2f} TB"
    )


def print_report(
    report: dict[str, Any],
) -> None:
    print(
        "Phase 2M generated-data sanity review"
    )
    print(
        "=" * 44
    )
    print(
        "Manifest matches: "
        f"{report['manifest_match_count']}"
    )
    print(
        "Actual match files: "
        f"{report['actual_match_file_count']}"
    )
    print(
        "Selected matches: "
        f"{report['selected_match_count']}"
    )
    print()

    print(
        "Match JSON file sizes"
    )
    print(
        "  Smallest: "
        + _format_bytes(
            report[
                "match_file_sizes"
            ][
                "smallest_bytes"
            ]
        )
    )
    print(
        "  Largest: "
        + _format_bytes(
            report[
                "match_file_sizes"
            ][
                "largest_bytes"
            ]
        )
    )
    print(
        "  Average: "
        + _format_bytes(
            report[
                "match_file_sizes"
            ][
                "average_bytes"
            ]
        )
    )
    print(
        "  Total: "
        + _format_bytes(
            report[
                "match_file_sizes"
            ][
                "total_bytes"
            ]
        )
    )
    print()

    print(
        "Map assets"
    )

    for game_map in report[
        "map_assets"
    ]:
        print(
            "  "
            f"{game_map['map_id']}: "
            f"{game_map['texture_width']}x"
            f"{game_map['texture_height']}, "
            + _format_bytes(
                game_map[
                    "file_size_bytes"
                ]
            )
        )

    print()

    for index, match in enumerate(
        report[
            "selected_matches"
        ],
        start=1,
    ):
        print(
            f"[{index}] {match['match_id']}"
        )
        print(
            f"  Date: {match['date']}"
        )
        print(
            f"  Map: {match['map_id']}"
        )
        print(
            "  Duration: "
            f"{match['duration_seconds']:.2f}s"
        )
        print(
            "  File size: "
            + _format_bytes(
                match[
                    "file_size_bytes"
                ]
            )
        )
        print(
            "  Participants: "
            f"{match['participant_count']} "
            f"(human={match['human_count']}, "
            f"bot={match['bot_count']})"
        )
        print(
            "  Tracks: "
            f"{match['track_count']}"
        )
        print(
            "  Trajectory points: "
            f"{match['trajectory_point_count']}"
        )
        print(
            "  Track point range: "
            f"{match['smallest_track_point_count']}.."
            f"{match['largest_track_point_count']}"
        )
        print(
            "  Events: "
            f"{match['event_count']} "
            f"{match['event_counts']}"
        )
        print(
            "  map_u range: "
            f"{match['map_u_range'][0]:.4f}.."
            f"{match['map_u_range'][1]:.4f}"
        )
        print(
            "  map_v range: "
            f"{match['map_v_range'][0]:.4f}.."
            f"{match['map_v_range'][1]:.4f}"
        )
        print(
            "  Summary reconciles: "
            f"{match['summary_reconciles']}"
        )

        if match[
            "first_event"
        ] is not None:
            print(
                "  First event: "
                f"{match['first_event']}"
            )

        if match[
            "last_event"
        ] is not None:
            print(
                "  Last event: "
                f"{match['last_event']}"
            )

        print()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Inspect representative generated match JSON files for Phase 2M."
        )
    )

    parser.add_argument(
        "--public-root",
        type=Path,
        default=Path(
            "public"
        ),
        help=(
            "Frontend public directory containing generated static data."
        ),
    )

    parser.add_argument(
        "--report-json",
        type=Path,
        default=None,
        help=(
            "Optional path to write the inspection packet as JSON."
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    report = inspect_generated_matches(
        args.public_root
    )

    print_report(
        report
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
                report,
                file_handle,
                indent=2,
                ensure_ascii=False,
            )
            file_handle.write(
                "\n"
            )

        print(
            "Inspection packet written: "
            f"{args.report_json.resolve()}"
        )


if __name__ == "__main__":
    main()
