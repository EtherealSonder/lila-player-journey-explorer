from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = PROJECT_ROOT / "raw-data"
EXTRACTED_DIR = RAW_DATA_DIR / "extracted"

DATE_DIR_PATTERN = re.compile(r"^February_\d{1,2}$")
DATA_FILE_PATTERN = re.compile(
    r"^(?P<user_id>.+)_(?P<match_id>[0-9a-fA-F-]{36})\.nakama-0$"
)


def sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()

    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            hasher.update(chunk)

    return hasher.hexdigest()


def find_dataset_root() -> Path:
    candidates = []

    for path in EXTRACTED_DIR.rglob("*"):
        if not path.is_dir():
            continue

        children = {child.name for child in path.iterdir()}

        has_readme = "README.md" in children
        has_minimaps = "minimaps" in children
        has_date_dirs = any(DATE_DIR_PATTERN.match(name) for name in children)

        if has_readme and has_minimaps and has_date_dirs:
            candidates.append(path)

    if not candidates:
        raise FileNotFoundError(
            "Could not locate dataset root inside raw-data/extracted."
        )

    if len(candidates) > 1:
        print("Warning: multiple possible dataset roots found:")
        for candidate in candidates:
            print(f"  - {candidate}")

    return candidates[0]


def inventory_dataset() -> dict:
    dataset_root = find_dataset_root()

    date_directories = sorted(
        path
        for path in dataset_root.iterdir()
        if path.is_dir() and DATE_DIR_PATTERN.match(path.name)
    )

    minimap_dir = dataset_root / "minimaps"
    readme_path = dataset_root / "README.md"

    files_by_date: dict[str, int] = {}
    all_data_files: list[Path] = []
    unexpected_files: list[str] = []
    invalid_data_filenames: list[str] = []

    parsed_records = []

    for date_dir in date_directories:
        files = [path for path in date_dir.iterdir() if path.is_file()]

        files_by_date[date_dir.name] = len(files)

        for path in files:
            if path.name == ".DS_Store":
                unexpected_files.append(str(path.relative_to(dataset_root)))
                continue

            match = DATA_FILE_PATTERN.match(path.name)

            if not match:
                invalid_data_filenames.append(
                    str(path.relative_to(dataset_root))
                )
                continue

            user_id = match.group("user_id")
            match_id = match.group("match_id")

            parsed_records.append(
                {
                    "date": date_dir.name,
                    "path": str(path.relative_to(dataset_root)),
                    "filename": path.name,
                    "user_id": user_id,
                    "match_id": match_id,
                }
            )

            all_data_files.append(path)

    minimap_files = []

    if minimap_dir.exists():
        for path in sorted(minimap_dir.iterdir()):
            if path.is_file():
                minimap_files.append(
                    {
                        "filename": path.name,
                        "size_bytes": path.stat().st_size,
                    }
                )

    user_counts = Counter(record["user_id"] for record in parsed_records)
    match_counts = Counter(record["match_id"] for record in parsed_records)

    files_by_match = defaultdict(list)

    for record in parsed_records:
        files_by_match[record["match_id"]].append(record["path"])

    hashes = defaultdict(list)

    print("Hashing data files for exact duplicate detection...")

    for index, path in enumerate(all_data_files, start=1):
        file_hash = sha256_file(path)

        hashes[file_hash].append(
            str(path.relative_to(dataset_root))
        )

        if index % 100 == 0 or index == len(all_data_files):
            print(
                f"  Hashed {index}/{len(all_data_files)} files"
            )

    duplicate_content_groups = [
        {
            "sha256": file_hash,
            "paths": paths,
            "count": len(paths),
        }
        for file_hash, paths in hashes.items()
        if len(paths) > 1
    ]

    matches_across_dates = []

    records_by_match = defaultdict(list)

    for record in parsed_records:
        records_by_match[record["match_id"]].append(record)

    for match_id, records in records_by_match.items():
        dates = sorted({record["date"] for record in records})

        if len(dates) > 1:
            matches_across_dates.append(
                {
                    "match_id": match_id,
                    "dates": dates,
                    "paths": [record["path"] for record in records],
                }
            )

    top_level_entries = []

    for path in sorted(dataset_root.iterdir()):
        top_level_entries.append(
            {
                "name": path.name,
                "type": "directory" if path.is_dir() else "file",
            }
        )

    inventory = {
        "dataset_root": str(dataset_root),
        "top_level_entries": top_level_entries,
        "date_directories": [path.name for path in date_directories],
        "files_by_date": files_by_date,
        "total_valid_data_files": len(all_data_files),
        "unique_user_ids": len(user_counts),
        "unique_match_ids": len(match_counts),
        "minimap_files": minimap_files,
        "readme_present": readme_path.exists(),
        "unexpected_files": unexpected_files,
        "invalid_data_filenames": invalid_data_filenames,
        "duplicate_content_groups": duplicate_content_groups,
        "matches_across_multiple_dates": matches_across_dates,
    }

    return inventory


def print_summary(inventory: dict) -> None:
    print()
    print("DATASET INVENTORY SUMMARY")
    print("=" * 60)

    print(f"Dataset root: {inventory['dataset_root']}")
    print()

    print("Date directories:")
    for date_dir in inventory["date_directories"]:
        count = inventory["files_by_date"][date_dir]
        print(f"  {date_dir}: {count} files")

    print()
    print(
        f"Total valid telemetry files: "
        f"{inventory['total_valid_data_files']}"
    )
    print(f"Unique user IDs: {inventory['unique_user_ids']}")
    print(f"Unique match IDs: {inventory['unique_match_ids']}")

    print()
    print(
        f"README present: "
        f"{inventory['readme_present']}"
    )

    print()
    print("Minimap files:")
    for minimap in inventory["minimap_files"]:
        print(
            f"  {minimap['filename']} "
            f"({minimap['size_bytes']} bytes)"
        )

    print()
    print(
        f"Unexpected files: "
        f"{len(inventory['unexpected_files'])}"
    )

    for path in inventory["unexpected_files"]:
        print(f"  {path}")

    print()
    print(
        f"Invalid telemetry filenames: "
        f"{len(inventory['invalid_data_filenames'])}"
    )

    for path in inventory["invalid_data_filenames"]:
        print(f"  {path}")

    print()
    print(
        f"Exact duplicate content groups: "
        f"{len(inventory['duplicate_content_groups'])}"
    )

    for duplicate in inventory["duplicate_content_groups"]:
        print(
            f"  SHA256: {duplicate['sha256']}"
        )

        for path in duplicate["paths"]:
            print(f"    {path}")

    print()
    print(
        f"Matches appearing across multiple dates: "
        f"{len(inventory['matches_across_multiple_dates'])}"
    )

    for match in inventory["matches_across_multiple_dates"]:
        print(
            f"  {match['match_id']}: "
            f"{', '.join(match['dates'])}"
        )


def main() -> None:
    inventory = inventory_dataset()
    print_summary(inventory)

    output_path = PROJECT_ROOT / "reports" / "dataset_inventory.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8") as file:
        json.dump(inventory, file, indent=2)

    print()
    print(f"Inventory written to: {output_path}")


if __name__ == "__main__":
    main()