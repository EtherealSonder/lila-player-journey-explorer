from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
import json
from pathlib import Path
import shutil
from typing import Iterable

from scripts.adapters import LilaTelemetryAdapter


SCHEMA_VERSION = 1


@dataclass(frozen=True)
class ExportResult:
    """Summary of one completed static dataset export."""

    match_count: int
    map_count: int
    manifest_path: Path
    maps_path: Path
    matches_directory: Path
    map_assets_directory: Path


def export_dataset(
    dataset_root: Path,
    output_root: Path,
    *,
    match_ids: Iterable[str] | None = None,
) -> ExportResult:
    """
    Export normalized LILA telemetry into browser-consumable static files.

    Output structure:

        public/
        ├── assets/
        │   └── maps/
        └── data/
            ├── manifest.json
            ├── maps.json
            └── matches/
                └── <match-id>.json

    When match_ids is omitted, every discovered match is exported.
    """

    dataset_root = dataset_root.resolve()
    output_root = output_root.resolve()

    if not dataset_root.exists():
        raise FileNotFoundError(
            f"Dataset root does not exist: {dataset_root}"
        )

    adapter = LilaTelemetryAdapter(
        dataset_root
    )

    discovered_match_ids = (
        adapter.discover_match_ids()
    )

    if match_ids is None:
        selected_match_ids = (
            discovered_match_ids
        )
    else:
        requested_match_ids = sorted(
            set(match_ids)
        )
        discovered_set = set(
            discovered_match_ids
        )

        unknown_match_ids = [
            match_id
            for match_id in requested_match_ids
            if match_id not in discovered_set
        ]

        if unknown_match_ids:
            raise ValueError(
                "Cannot export unknown match IDs: "
                + ", ".join(
                    unknown_match_ids
                )
            )

        selected_match_ids = (
            requested_match_ids
        )

    data_directory = (
        output_root
        / "data"
    )
    matches_directory = (
        data_directory
        / "matches"
    )
    map_assets_directory = (
        output_root
        / "assets"
        / "maps"
    )

    data_directory.mkdir(
        parents=True,
        exist_ok=True,
    )
    map_assets_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    _recreate_directory(
        matches_directory
    )

    maps = adapter.build_map_registry()

    _copy_map_assets(
        dataset_root=dataset_root,
        map_assets_directory=map_assets_directory,
        maps=maps,
    )

    summaries = []

    for match_id in selected_match_ids:
        match = adapter.build_match_data(
            match_id
        )

        summary = (
            adapter.summarize_match_data(
                match
            )
        )

        summaries.append(
            summary
        )

        match_path = (
            matches_directory
            / f"{match_id}.json"
        )

        _write_json(
            match_path,
            match.to_dict(),
            pretty=False,
        )

    summaries.sort(
        key=lambda summary: (
            summary.date,
            summary.map_id,
            summary.match_id,
        )
    )

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "match_count": len(
            summaries
        ),
        "map_ids": sorted(
            {
                summary.map_id
                for summary in summaries
            }
        ),
        "dates": sorted(
            {
                summary.date
                for summary in summaries
            }
        ),
        "matches": [
            asdict(
                summary
            )
            for summary in summaries
        ],
    }

    maps_payload = {
        "schema_version": SCHEMA_VERSION,
        "map_count": len(
            maps
        ),
        "maps": [
            asdict(
                game_map
            )
            for game_map in maps
        ],
    }

    manifest_path = (
        data_directory
        / "manifest.json"
    )
    maps_path = (
        data_directory
        / "maps.json"
    )

    _write_json(
        manifest_path,
        manifest,
        pretty=True,
    )
    _write_json(
        maps_path,
        maps_payload,
        pretty=True,
    )

    return ExportResult(
        match_count=len(
            summaries
        ),
        map_count=len(
            maps
        ),
        manifest_path=manifest_path,
        maps_path=maps_path,
        matches_directory=matches_directory,
        map_assets_directory=map_assets_directory,
    )


def _copy_map_assets(
    *,
    dataset_root: Path,
    map_assets_directory: Path,
    maps: list,
) -> None:
    source_directory = (
        dataset_root
        / "minimaps"
    )

    if not source_directory.exists():
        raise FileNotFoundError(
            f"Minimap directory does not exist: {source_directory}"
        )

    expected_target_names: set[str] = set()

    for game_map in maps:
        target_name = Path(
            game_map.image_path
        ).name

        expected_target_names.add(
            target_name
        )

        source_path = (
            source_directory
            / target_name
        )
        target_path = (
            map_assets_directory
            / target_name
        )

        if not source_path.exists():
            raise FileNotFoundError(
                "Expected minimap asset is missing: "
                f"{source_path}"
            )

        shutil.copy2(
            source_path,
            target_path,
        )

    for existing_path in (
        map_assets_directory.iterdir()
    ):
        if (
            existing_path.is_file()
            and existing_path.name
            not in expected_target_names
        ):
            existing_path.unlink()


def _recreate_directory(
    directory: Path,
) -> None:
    if directory.exists():
        shutil.rmtree(
            directory
        )

    directory.mkdir(
        parents=True,
        exist_ok=True,
    )


def _write_json(
    file_path: Path,
    payload: object,
    *,
    pretty: bool,
) -> None:
    file_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with file_path.open(
        "w",
        encoding="utf-8",
        newline="\n",
    ) as file_handle:
        if pretty:
            json.dump(
                payload,
                file_handle,
                indent=2,
                ensure_ascii=False,
            )
        else:
            json.dump(
                payload,
                file_handle,
                ensure_ascii=False,
                separators=(
                    ",",
                    ":",
                ),
            )

        file_handle.write(
            "\n"
        )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Export LILA telemetry into normalized static browser data."
        )
    )

    parser.add_argument(
        "--dataset-root",
        type=Path,
        default=Path(
            "raw-data/extracted/player_data"
        ),
        help=(
            "Root containing February_* telemetry folders and minimaps."
        ),
    )

    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path(
            "public"
        ),
        help=(
            "Frontend public directory that will receive data and map assets."
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    result = export_dataset(
        dataset_root=args.dataset_root,
        output_root=args.output_root,
    )

    print(
        "Static dataset export complete."
    )
    print(
        f"Matches exported: {result.match_count}"
    )
    print(
        f"Maps exported: {result.map_count}"
    )
    print(
        f"Manifest: {result.manifest_path}"
    )
    print(
        f"Maps: {result.maps_path}"
    )
    print(
        f"Match files: {result.matches_directory}"
    )
    print(
        f"Map assets: {result.map_assets_directory}"
    )


if __name__ == "__main__":
    main()
