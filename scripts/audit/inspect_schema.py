from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import polars as pl
import pyarrow.parquet as pq


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_ROOT = PROJECT_ROOT / "raw-data" / "extracted" / "player_data"
REPORTS_DIR = PROJECT_ROOT / "reports"

SAMPLE_LIMIT = 12


def get_data_files() -> list[Path]:
    files = sorted(
        path
        for path in DATASET_ROOT.rglob("*.nakama-0")
        if path.is_file()
    )

    if not files:
        raise FileNotFoundError(
            f"No telemetry files found under {DATASET_ROOT}"
        )

    return files


def decode_event(value: object) -> str | None:
    if value is None:
        return None

    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except UnicodeDecodeError:
            return repr(value)

    return str(value)


def inspect_file(path: Path) -> dict:
    parquet_file = pq.ParquetFile(path)
    arrow_schema = parquet_file.schema_arrow

    df = pl.read_parquet(path)

    relative_path = path.relative_to(DATASET_ROOT)

    filename_without_suffix = path.name.removesuffix(".nakama-0")

    try:
        filename_user_id, filename_match_id = filename_without_suffix.rsplit(
            "_", 1
        )
    except ValueError:
        filename_user_id = None
        filename_match_id = None

    raw_events = df["event"].to_list() if "event" in df.columns else []
    decoded_events = [decode_event(value) for value in raw_events]

    event_counts = Counter(decoded_events)

    unique_values = {}

    for column in ["user_id", "match_id", "map_id"]:
        if column in df.columns:
            unique_values[column] = [
                str(value)
                for value in df[column].drop_nulls().unique().to_list()
            ]

    null_counts = {
        column: int(df[column].null_count())
        for column in df.columns
    }

    sample_rows = []

    for row in df.head(5).to_dicts():
        cleaned_row = {}

        for key, value in row.items():
            if key == "event":
                cleaned_row[key] = decode_event(value)
            elif isinstance(value, bytes):
                cleaned_row[key] = repr(value)
            else:
                cleaned_row[key] = str(value) if value is not None else None

        sample_rows.append(cleaned_row)

    return {
        "path": str(relative_path),
        "filename_user_id": filename_user_id,
        "filename_match_id": filename_match_id,
        "row_count": df.height,
        "columns": df.columns,
        "polars_schema": {
            column: str(dtype)
            for column, dtype in df.schema.items()
        },
        "arrow_schema": str(arrow_schema),
        "null_counts": null_counts,
        "unique_identity_values": unique_values,
        "event_counts": dict(sorted(event_counts.items())),
        "sample_rows": sample_rows,
    }


def choose_representative_samples(files: list[Path]) -> list[Path]:
    selected: list[Path] = []
    seen_dates: set[str] = set()

    for path in files:
        relative = path.relative_to(DATASET_ROOT)
        date_dir = relative.parts[0]

        if date_dir not in seen_dates:
            selected.append(path)
            seen_dates.add(date_dir)

        if len(selected) >= 5:
            break

    numeric_user_samples = []
    uuid_user_samples = []

    for path in files:
        stem = path.name.removesuffix(".nakama-0")

        try:
            user_id, _ = stem.rsplit("_", 1)
        except ValueError:
            continue

        if user_id.isdigit():
            numeric_user_samples.append(path)
        else:
            uuid_user_samples.append(path)

    for group in [numeric_user_samples, uuid_user_samples]:
        for path in group[:3]:
            if path not in selected:
                selected.append(path)

            if len(selected) >= SAMPLE_LIMIT:
                break

    if len(selected) < SAMPLE_LIMIT:
        for path in files:
            if path not in selected:
                selected.append(path)

            if len(selected) >= SAMPLE_LIMIT:
                break

    return selected


def compare_filename_to_records(file_report: dict) -> dict:
    user_values = file_report["unique_identity_values"].get("user_id", [])
    match_values = file_report["unique_identity_values"].get("match_id", [])

    filename_user_id = file_report["filename_user_id"]
    filename_match_id = file_report["filename_match_id"]

    user_matches = (
        len(user_values) == 1
        and user_values[0] == filename_user_id
    )

    normalized_match_values = [
        value.removesuffix(".nakama-0")
        for value in match_values
    ]

    match_matches = (
        len(normalized_match_values) == 1
        and normalized_match_values[0] == filename_match_id
    )

    return {
        "user_id_matches_filename": user_matches,
        "match_id_matches_filename_after_suffix_normalization": match_matches,
        "record_user_ids": user_values,
        "record_match_ids": match_values,
    }


def main() -> None:
    files = get_data_files()
    samples = choose_representative_samples(files)

    reports = []

    print("RAW PARQUET SCHEMA INSPECTION")
    print("=" * 70)
    print(f"Dataset root: {DATASET_ROOT}")
    print(f"Total telemetry files discovered: {len(files)}")
    print(f"Representative files selected: {len(samples)}")
    print()

    for index, path in enumerate(samples, start=1):
        report = inspect_file(path)
        identity_check = compare_filename_to_records(report)

        report["identity_check"] = identity_check
        reports.append(report)

        print(f"[{index}/{len(samples)}] {report['path']}")
        print(f"Rows: {report['row_count']}")

        print("Polars schema:")
        for column, dtype in report["polars_schema"].items():
            print(f"  {column}: {dtype}")

        print("Unique identity values:")
        for column, values in report["unique_identity_values"].items():
            print(f"  {column}: {values}")

        print("Filename consistency:")
        print(
            "  user_id matches filename: "
            f"{identity_check['user_id_matches_filename']}"
        )
        print(
            "  match_id matches filename after suffix normalization: "
            f"{identity_check['match_id_matches_filename_after_suffix_normalization']}"
        )

        print("Event counts:")
        for event, count in report["event_counts"].items():
            print(f"  {event}: {count}")

        print("Null counts:")
        for column, count in report["null_counts"].items():
            print(f"  {column}: {count}")

        print("-" * 70)

    output = {
        "dataset_root": str(DATASET_ROOT),
        "total_files": len(files),
        "sample_count": len(reports),
        "samples": reports,
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    output_path = REPORTS_DIR / "schema_inspection.json"

    with output_path.open("w", encoding="utf-8") as file:
        json.dump(output, file, indent=2)

    print()
    print(f"Schema inspection written to: {output_path}")


if __name__ == "__main__":
    main()