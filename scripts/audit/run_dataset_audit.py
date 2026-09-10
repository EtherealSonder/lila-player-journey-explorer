from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
REPORTS_DIR = PROJECT_ROOT / "reports"

INPUT_REPORTS = {
    "inventory": REPORTS_DIR / "dataset_inventory.json",
    "schema": REPORTS_DIR / "schema_inspection.json",
    "telemetry": REPORTS_DIR / "telemetry_scan.json",
    "matches": REPORTS_DIR / "match_aggregation.json",
    "minimaps": REPORTS_DIR / "minimap_audit.json",
}

JSON_OUTPUT_PATH = REPORTS_DIR / "dataset_audit.json"
MARKDOWN_OUTPUT_PATH = REPORTS_DIR / "dataset_audit.md"


EXPECTED_COLUMNS = [
    "user_id",
    "match_id",
    "map_id",
    "x",
    "y",
    "z",
    "ts",
    "event",
]

EXPECTED_EVENTS = [
    "Position",
    "BotPosition",
    "Kill",
    "Killed",
    "BotKill",
    "BotKilled",
    "KilledByStorm",
    "Loot",
]


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(
            f"Required Phase 1 report does not exist: {path}"
        )

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def get_schema_summary(schema_report: dict[str, Any]) -> dict[str, Any]:
    samples = schema_report.get("samples", [])

    observed_schemas = Counter()

    for sample in samples:
        schema = sample.get("polars_schema", {})

        fingerprint = tuple(
            (column, str(dtype))
            for column, dtype in schema.items()
        )

        observed_schemas[fingerprint] += 1

    schema_variants = []

    for fingerprint, count in observed_schemas.items():
        schema_variants.append(
            {
                "sample_count": count,
                "columns": [
                    {
                        "name": column,
                        "type": dtype,
                    }
                    for column, dtype in fingerprint
                ],
            }
        )

    return {
        "sampled_file_count": len(samples),
        "expected_columns": EXPECTED_COLUMNS,
        "schema_variant_count_in_samples": len(schema_variants),
        "schema_variants": schema_variants,
        "important_storage_notes": [
            "event is stored as binary and decodes to UTF-8 event names",
            "ts is stored as timestamp[ms]",
            "x, y, and z are Float32",
            "user_id, match_id, and map_id are strings",
            "internal match_id values include the .nakama-0 suffix",
        ],
    }


def get_telemetry_summary(
    telemetry_report: dict[str, Any],
) -> dict[str, Any]:
    total_rows = sum(
        file_report.get("row_count", 0)
        for file_report in telemetry_report.get("files", [])
    )

    return {
        "total_files": telemetry_report.get("total_files", 0),
        "total_rows": total_rows,
        "empty_file_count": len(
            telemetry_report.get("empty_files", [])
        ),
        "participant_categories": telemetry_report.get(
            "participant_categories",
            {},
        ),
        "numeric_user_id_categories": telemetry_report.get(
            "numeric_user_id_categories",
            {},
        ),
        "uuid_user_id_categories": telemetry_report.get(
            "uuid_user_id_categories",
            {},
        ),
        "maps": telemetry_report.get("maps", {}),
        "global_event_counts": telemetry_report.get(
            "global_event_counts",
            {},
        ),
        "unknown_events": telemetry_report.get(
            "unknown_events",
            {},
        ),
        "null_totals": telemetry_report.get(
            "null_totals",
            {},
        ),
        "identity_failures": telemetry_report.get(
            "identity_failures",
            {},
        ),
        "timestamp_order_failure_count": len(
            telemetry_report.get(
                "timestamp_order_failures",
                []
            )
        ),
        "timestamp_order_failure_files": telemetry_report.get(
            "timestamp_order_failures",
            [],
        ),
        "mixed_participant_file_count": len(
            telemetry_report.get(
                "mixed_participant_files",
                []
            )
        ),
        "unknown_participant_file_count": len(
            telemetry_report.get(
                "unknown_participant_files",
                []
            )
        ),
    }


def build_assumptions() -> list[dict[str, str]]:
    return [
        {
            "topic": "Raw file meaning",
            "decision": (
                "One .nakama-0 Parquet file represents one participant "
                "journey within one match."
            ),
            "status": "confirmed",
        },
        {
            "topic": "Match reconstruction",
            "decision": (
                "Participant files are grouped using the normalized "
                "match ID after removing the .nakama-0 suffix."
            ),
            "status": "confirmed",
        },
        {
            "topic": "Human and bot classification",
            "decision": (
                "Use Position versus BotPosition telemetry semantics as "
                "the authoritative participant classification signal. "
                "Do not use numeric versus UUID user ID shape as the "
                "sole classification rule."
            ),
            "status": "confirmed_from_dataset",
        },
        {
            "topic": "Event decoding",
            "decision": (
                "Decode the binary event column as UTF-8 text before "
                "normalization."
            ),
            "status": "confirmed",
        },
        {
            "topic": "2D coordinates",
            "decision": (
                "Use world x and z for minimap projection. Treat y as "
                "elevation rather than the minimap vertical axis."
            ),
            "status": "documented_by_dataset_readme",
        },
        {
            "topic": "Timestamp semantics",
            "decision": (
                "Do not expose ts as a wall-clock datetime. Build "
                "playback from relative timestamp deltas. Observed "
                "duration evidence indicates that one stored millisecond "
                "delta behaves as approximately one gameplay second."
            ),
            "status": "dataset_inference",
        },
        {
            "topic": "Timestamp ordering",
            "decision": (
                "Sort telemetry rows by ts during normalization because "
                "three raw participant files contain non-monotonic row "
                "ordering."
            ),
            "status": "confirmed_from_dataset",
        },
        {
            "topic": "Exact duplicate",
            "decision": (
                "Preserve raw source files, report exact duplicates, "
                "and exclude the redundant duplicate copy from "
                "normalized application output."
            ),
            "status": "normalization_policy",
        },
        {
            "topic": "Minimap projection",
            "decision": (
                "Project world coordinates into normalized UV space. "
                "Do not hardcode the README's nominal 1024 x 1024 "
                "pixel dimensions."
            ),
            "status": "architecture_decision",
        },
        {
            "topic": "Minimap cropping",
            "decision": (
                "Use the complete supplied minimap texture. Non-black "
                "bounding boxes are audit heuristics only and must not "
                "be used as automatic crop bounds."
            ),
            "status": "architecture_decision",
        },
    ]


def build_audit(
    inventory: dict[str, Any],
    schema: dict[str, Any],
    telemetry: dict[str, Any],
    matches: dict[str, Any],
    minimaps: dict[str, Any],
) -> dict[str, Any]:
    telemetry_summary = get_telemetry_summary(telemetry)

    duplicate_groups = inventory.get(
        "duplicate_content_groups",
        [],
    )

    cross_date_matches = inventory.get(
        "matches_across_multiple_dates",
        [],
    )

    return {
        "phase": "Phase 1 - Dataset Investigation and Audit",
        "status": "complete",

        "dataset": {
            "date_directories": inventory.get(
                "date_directories",
                [],
            ),
            "files_by_date": inventory.get(
                "files_by_date",
                {},
            ),
            "total_telemetry_files": inventory.get(
                "total_valid_data_files",
                0,
            ),
            "total_telemetry_rows": telemetry_summary[
                "total_rows"
            ],
            "unique_user_ids": inventory.get(
                "unique_user_ids",
                0,
            ),
            "unique_match_ids": inventory.get(
                "unique_match_ids",
                0,
            ),
            "reconstructed_matches": matches.get(
                "total_matches",
                0,
            ),
        },

        "schema": get_schema_summary(schema),

        "participants": {
            "classification_by_telemetry": (
                telemetry_summary[
                    "participant_categories"
                ]
            ),
            "numeric_user_id_categories": (
                telemetry_summary[
                    "numeric_user_id_categories"
                ]
            ),
            "uuid_user_id_categories": (
                telemetry_summary[
                    "uuid_user_id_categories"
                ]
            ),
            "classification_rule": (
                "Position => human, BotPosition => bot. "
                "ID format is supporting metadata only."
            ),
        },

        "events": {
            "expected_event_types": EXPECTED_EVENTS,
            "observed_event_counts": telemetry_summary[
                "global_event_counts"
            ],
            "unknown_events": telemetry_summary[
                "unknown_events"
            ],
        },

        "data_quality": {
            "empty_files": telemetry_summary[
                "empty_file_count"
            ],
            "null_totals": telemetry_summary[
                "null_totals"
            ],
            "identity_failures": telemetry_summary[
                "identity_failures"
            ],
            "mixed_participant_files": telemetry_summary[
                "mixed_participant_file_count"
            ],
            "unknown_participant_files": telemetry_summary[
                "unknown_participant_file_count"
            ],
            "timestamp_order_failures": telemetry_summary[
                "timestamp_order_failure_count"
            ],
            "timestamp_order_failure_files": (
                telemetry_summary[
                    "timestamp_order_failure_files"
                ]
            ),
            "exact_duplicate_groups": duplicate_groups,
            "matches_across_multiple_dates": cross_date_matches,
        },

        "matches": {
            "total": matches.get(
                "total_matches",
                0,
            ),
            "file_count_stats": matches.get(
                "match_file_count_stats",
                {},
            ),
            "participant_count_stats": matches.get(
                "unique_participant_count_stats",
                {},
            ),
            "human_participant_count_stats": matches.get(
                "human_participant_count_stats",
                {},
            ),
            "bot_participant_count_stats": matches.get(
                "bot_participant_count_stats",
                {},
            ),
            "duration_seconds_stats": matches.get(
                "duration_seconds_stats",
                {},
            ),
            "matches_by_map": matches.get(
                "matches_by_map",
                {},
            ),
            "matches_by_date": matches.get(
                "matches_by_date",
                {},
            ),
            "anomaly_counts": matches.get(
                "anomaly_counts",
                {},
            ),
            "largest_matches": matches.get(
                "largest_matches",
                [],
            ),
            "longest_matches": matches.get(
                "longest_matches",
                [],
            ),
        },

        "minimaps": {
            "unexpected_files": minimaps.get(
                "unexpected_files",
                [],
            ),
            "assets": minimaps.get(
                "minimaps",
                [],
            ),
        },

        "assumptions_and_decisions": build_assumptions(),

        "phase_2_contract": {
            "adapter_input": (
                "Raw LILA participant Parquet files"
            ),
            "adapter_output": (
                "Dataset-independent normalized telemetry"
            ),
            "required_normalizations": [
                "Decode binary event values",
                "Remove .nakama-0 from match IDs",
                "Classify participant from movement event semantics",
                "Sort participant telemetry by ts",
                "Convert timestamps to relative gameplay seconds",
                "Exclude redundant exact duplicate from normalized output",
                "Preserve world x, y, z coordinates",
                "Project x and z through map-specific projection metadata",
            ],
        },
    }


def format_number(value: Any) -> str:
    if isinstance(value, float):
        return f"{value:.2f}"

    return str(value)


def build_markdown(audit: dict[str, Any]) -> str:
    dataset = audit["dataset"]
    participants = audit["participants"]
    events = audit["events"]
    quality = audit["data_quality"]
    matches = audit["matches"]
    minimaps = audit["minimaps"]

    lines: list[str] = []

    lines.append("# LILA Dataset Audit")
    lines.append("")
    lines.append(
        "Phase 1 establishes the raw-data contract used by the "
        "Player Journey Explorer before normalization or visualization."
    )
    lines.append("")

    lines.append("## 1. Dataset Inventory")
    lines.append("")
    lines.append(
        f"- Telemetry files: {dataset['total_telemetry_files']}"
    )
    lines.append(
        f"- Telemetry rows: {dataset['total_telemetry_rows']}"
    )
    lines.append(
        f"- Unique user IDs: {dataset['unique_user_ids']}"
    )
    lines.append(
        f"- Unique match IDs: {dataset['unique_match_ids']}"
    )
    lines.append(
        f"- Reconstructed matches: {dataset['reconstructed_matches']}"
    )
    lines.append("")

    lines.append("### Files by date")
    lines.append("")

    for date, count in dataset["files_by_date"].items():
        lines.append(f"- {date}: {count}")

    lines.append("")

    lines.append("## 2. Raw Telemetry Schema")
    lines.append("")
    lines.append("| Column | Type | Meaning |")
    lines.append("| --- | --- | --- |")
    lines.append("| user_id | String | Participant identifier |")
    lines.append("| match_id | String | Match identifier |")
    lines.append("| map_id | String | Map identifier |")
    lines.append("| x | Float32 | World X coordinate |")
    lines.append("| y | Float32 | Elevation |")
    lines.append("| z | Float32 | World Z coordinate |")
    lines.append("| ts | timestamp[ms] | Raw telemetry timestamp |")
    lines.append("| event | Binary | UTF-8 encoded event name |")
    lines.append("")

    lines.append("## 3. Participant Classification")
    lines.append("")
    lines.append(
        "Movement telemetry is the authoritative classification signal."
    )
    lines.append("")
    lines.append(
        "- `Position` identifies a human-style participant journey."
    )
    lines.append(
        "- `BotPosition` identifies a bot participant journey."
    )
    lines.append(
        "- Numeric user IDs are not sufficient for classification."
    )
    lines.append("")

    lines.append("Observed file classifications:")
    lines.append("")

    for category, count in participants[
        "classification_by_telemetry"
    ].items():
        lines.append(f"- {category}: {count}")

    lines.append("")
    lines.append("Numeric user ID behaviour:")
    lines.append("")

    for category, count in participants[
        "numeric_user_id_categories"
    ].items():
        lines.append(f"- {category}: {count}")

    lines.append("")

    lines.append("## 4. Event Vocabulary")
    lines.append("")
    lines.append("| Event | Count |")
    lines.append("| --- | ---: |")

    for event, count in events[
        "observed_event_counts"
    ].items():
        lines.append(f"| {event} | {count} |")

    lines.append("")
    lines.append(
        f"Unknown event types observed: {len(events['unknown_events'])}"
    )
    lines.append("")

    lines.append("## 5. Match Reconstruction")
    lines.append("")
    lines.append(
        f"Reconstructed {matches['total']} matches by grouping "
        "participant files using normalized match IDs."
    )
    lines.append("")

    participant_stats = matches[
        "participant_count_stats"
    ]

    duration_stats = matches[
        "duration_seconds_stats"
    ]

    lines.append(
        "- Participants per match: "
        f"min {participant_stats.get('min')}, "
        f"median {participant_stats.get('median')}, "
        f"mean {format_number(participant_stats.get('mean'))}, "
        f"max {participant_stats.get('max')}."
    )

    lines.append(
        "- Inferred duration: "
        f"min {duration_stats.get('min')} sec, "
        f"median {duration_stats.get('median')} sec, "
        f"mean {format_number(duration_stats.get('mean'))} sec, "
        f"max {duration_stats.get('max')} sec."
    )

    lines.append("")
    lines.append("### Matches by map")
    lines.append("")

    for map_id, count in matches[
        "matches_by_map"
    ].items():
        lines.append(f"- {map_id}: {count}")

    lines.append("")

    lines.append("## 6. Timestamp Interpretation")
    lines.append("")
    lines.append(
        "The raw `ts` field is physically represented as a "
        "`timestamp[ms]`, but treating it as a normal wall-clock "
        "datetime does not align with the supplied February 2026 "
        "dataset dates."
    )
    lines.append("")
    lines.append(
        "Observed timestamp deltas produce plausible match durations "
        "when one stored millisecond of delta is interpreted as "
        "approximately one gameplay second."
    )
    lines.append("")
    lines.append(
        "The normalized telemetry model will therefore use relative "
        "gameplay time from the earliest timestamp in each match. "
        "It will not expose the raw value as a calendar datetime."
    )
    lines.append("")

    lines.append("## 7. Data Quality and Anomalies")
    lines.append("")
    lines.append(
        f"- Empty telemetry files: {quality['empty_files']}"
    )
    lines.append(
        f"- Timestamp ordering failures: "
        f"{quality['timestamp_order_failures']}"
    )
    lines.append(
        f"- Mixed participant files: "
        f"{quality['mixed_participant_files']}"
    )
    lines.append(
        f"- Unknown participant files: "
        f"{quality['unknown_participant_files']}"
    )
    lines.append(
        f"- Exact duplicate content groups: "
        f"{len(quality['exact_duplicate_groups'])}"
    )
    lines.append(
        f"- Cross-date match groups: "
        f"{len(quality['matches_across_multiple_dates'])}"
    )
    lines.append("")

    lines.append("Match anomaly counts:")
    lines.append("")

    for flag, count in matches[
        "anomaly_counts"
    ].items():
        lines.append(f"- {flag}: {count}")

    lines.append("")

    lines.append("### Duplicate policy")
    lines.append("")
    lines.append(
        "Raw source files remain untouched. Exact duplicate content "
        "is reported by the audit. During normalization, one "
        "deterministic canonical copy will be retained and the "
        "redundant copy will be excluded from application data."
    )
    lines.append("")

    lines.append("## 8. Minimap Assets")
    lines.append("")
    lines.append(
        "The supplied image dimensions differ from the README's "
        "nominal 1024 x 1024 coordinate example."
    )
    lines.append("")
    lines.append("| Map | Format | Dimensions | Alpha |")
    lines.append("| --- | --- | --- | --- |")

    for minimap in minimaps["assets"]:
        alpha = minimap["alpha"][
            "has_alpha_channel"
        ]

        lines.append(
            f"| {minimap['map_id']} "
            f"| {minimap['format']} "
            f"| {minimap['width']} x {minimap['height']} "
            f"| {'Yes' if alpha else 'No'} |"
        )

    lines.append("")
    lines.append(
        "Projection must therefore use normalized UV coordinates "
        "and the full supplied texture dimensions rather than "
        "hardcoded 1024-pixel coordinates."
    )
    lines.append("")
    lines.append(
        "Non-black content bounds are retained only as audit "
        "metadata. They are not automatic crop bounds."
    )
    lines.append("")

    lines.append("## 9. Normalization Decisions")
    lines.append("")

    for assumption in audit[
        "assumptions_and_decisions"
    ]:
        lines.append(
            f"- **{assumption['topic']}**: "
            f"{assumption['decision']} "
            f"Status: `{assumption['status']}`."
        )

    lines.append("")

    lines.append("## 10. Phase 2 Adapter Contract")
    lines.append("")
    lines.append(
        "The visualization layer must consume normalized telemetry "
        "rather than raw LILA Parquet records."
    )
    lines.append("")
    lines.append("Required LILA adapter transformations:")
    lines.append("")

    for item in audit[
        "phase_2_contract"
    ]["required_normalizations"]:
        lines.append(f"- {item}")

    lines.append("")
    lines.append(
        "This keeps dataset-specific parsing and cleanup inside the "
        "adapter while the React and PixiJS application depends on "
        "a stable dataset-independent telemetry model."
    )
    lines.append("")

    return "\n".join(lines)


def validate_audit(audit: dict[str, Any]) -> list[str]:
    errors = []

    dataset = audit["dataset"]

    if (
        dataset["total_telemetry_files"]
        != 1243
    ):
        errors.append(
            "Expected 1243 telemetry files."
        )

    if (
        dataset["unique_match_ids"]
        != dataset["reconstructed_matches"]
    ):
        errors.append(
            "Unique match count does not match reconstructed match count."
        )

    observed_events = set(
        audit["events"][
            "observed_event_counts"
        ].keys()
    )

    if observed_events != set(EXPECTED_EVENTS):
        errors.append(
            "Observed event vocabulary differs from expected event set."
        )

    if audit["events"]["unknown_events"]:
        errors.append(
            "Unknown event types are present."
        )

    if audit["data_quality"]["identity_failures"]:
        errors.append(
            "Filename and record identity failures are present."
        )

    minimap_ids = {
        minimap["map_id"]
        for minimap in audit[
            "minimaps"
        ]["assets"]
        if minimap.get("exists")
    }

    expected_map_ids = {
        "AmbroseValley",
        "GrandRift",
        "Lockdown",
    }

    if minimap_ids != expected_map_ids:
        errors.append(
            "Expected minimap set is incomplete."
        )

    return errors


def main() -> None:
    print("FINAL DATASET AUDIT")
    print("=" * 70)

    loaded = {}

    for name, path in INPUT_REPORTS.items():
        print(f"Loading {path.name}...")
        loaded[name] = load_json(path)

    audit = build_audit(
        inventory=loaded["inventory"],
        schema=loaded["schema"],
        telemetry=loaded["telemetry"],
        matches=loaded["matches"],
        minimaps=loaded["minimaps"],
    )

    validation_errors = validate_audit(audit)

    audit["validation"] = {
        "passed": len(validation_errors) == 0,
        "errors": validation_errors,
    }

    REPORTS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    with JSON_OUTPUT_PATH.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            audit,
            file,
            indent=2,
        )

    markdown = build_markdown(audit)

    with MARKDOWN_OUTPUT_PATH.open(
        "w",
        encoding="utf-8",
    ) as file:
        file.write(markdown)

    print()
    print("FINAL AUDIT SUMMARY")
    print("=" * 70)

    dataset = audit["dataset"]

    print(
        f"Telemetry files: "
        f"{dataset['total_telemetry_files']}"
    )
    print(
        f"Telemetry rows: "
        f"{dataset['total_telemetry_rows']}"
    )
    print(
        f"Unique users: "
        f"{dataset['unique_user_ids']}"
    )
    print(
        f"Unique matches: "
        f"{dataset['unique_match_ids']}"
    )
    print(
        f"Reconstructed matches: "
        f"{dataset['reconstructed_matches']}"
    )

    print()
    print("Events:")

    for event, count in audit[
        "events"
    ]["observed_event_counts"].items():
        print(f"  {event}: {count}")

    print()
    print("Data-quality findings:")
    print(
        "  Empty files: "
        f"{audit['data_quality']['empty_files']}"
    )
    print(
        "  Timestamp ordering failures: "
        f"{audit['data_quality']['timestamp_order_failures']}"
    )
    print(
        "  Exact duplicate groups: "
        f"{len(audit['data_quality']['exact_duplicate_groups'])}"
    )
    print(
        "  Cross-date matches: "
        f"{len(audit['data_quality']['matches_across_multiple_dates'])}"
    )

    print()
    print("Minimaps:")

    for minimap in audit[
        "minimaps"
    ]["assets"]:
        print(
            f"  {minimap['map_id']}: "
            f"{minimap['width']} x "
            f"{minimap['height']} "
            f"{minimap['format']}"
        )

    print()
    print("Validation:")

    if audit["validation"]["passed"]:
        print("  PASS")
    else:
        print("  FAIL")

        for error in validation_errors:
            print(f"  - {error}")

    print()
    print(
        f"JSON audit: {JSON_OUTPUT_PATH}"
    )
    print(
        f"Markdown audit: {MARKDOWN_OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()