from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime
import hashlib
from pathlib import Path
from typing import Iterable

import polars as pl

from scripts.adapters.base_adapter import BaseTelemetryAdapter
from scripts.models import (
    GameMap,
    MapProjection,
    MatchData,
    MatchSummary,
    Participant,
    ParticipantCategory,
    ParticipantTrack,
    TelemetryEvent,
    TelemetryPoint,
)


EXPECTED_COLUMNS = {
    "user_id",
    "match_id",
    "map_id",
    "x",
    "y",
    "z",
    "ts",
    "event",
}

PLAYBACK_SECONDS_PER_RAW_UNIT = 1.0
LILA_DATASET_YEAR = 2026

LILA_MAP_REGISTRY: dict[str, GameMap] = {
    "AmbroseValley": GameMap(
        id="AmbroseValley",
        display_name="Ambrose Valley",
        image_path="/assets/maps/AmbroseValley_Minimap.png",
        projection=MapProjection(
            origin_x=-370.0,
            origin_z=-473.0,
            scale=900.0,
        ),
        texture_width=4320,
        texture_height=4320,
    ),
    "GrandRift": GameMap(
        id="GrandRift",
        display_name="Grand Rift",
        image_path="/assets/maps/GrandRift_Minimap.png",
        projection=MapProjection(
            origin_x=-290.0,
            origin_z=-290.0,
            scale=581.0,
        ),
        texture_width=2160,
        texture_height=2158,
    ),
    "Lockdown": GameMap(
        id="Lockdown",
        display_name="Lockdown",
        image_path="/assets/maps/Lockdown_Minimap.jpg",
        projection=MapProjection(
            origin_x=-500.0,
            origin_z=-500.0,
            scale=1000.0,
        ),
        texture_width=9000,
        texture_height=9000,
    ),
}

LILA_MAP_PROJECTIONS: dict[str, MapProjection] = {
    map_id: game_map.projection
    for map_id, game_map in LILA_MAP_REGISTRY.items()
}

MOVEMENT_EVENT_NAMES = {
    "Position",
    "BotPosition",
}

NORMALIZABLE_EVENT_NAMES = {
    "Kill",
    "Killed",
    "BotKill",
    "BotKilled",
    "KilledByStorm",
    "Loot",
}

NORMALIZED_EVENT_TYPES = (
    "kill",
    "death",
    "storm_death",
    "loot",
)


@dataclass(frozen=True)
class ParsedLilaRow:
    """One parsed row from a raw LILA participant telemetry file."""

    timestamp_raw: int
    x: float
    y: float
    z: float
    event_name: str


@dataclass(frozen=True)
class ParsedLilaParticipantFile:
    """Parsed representation of one LILA participant journey file."""

    source_path: Path
    participant_id: str
    match_id: str
    map_id: str
    rows: list[ParsedLilaRow]


class LilaTelemetryAdapter(BaseTelemetryAdapter):
    """Adapter for the LILA BLACK telemetry dataset."""

    def discover_match_ids(self) -> list[str]:
        """
        Discover all unique match IDs from LILA participant filenames.

        Filenames follow:
            {participant_id}_{match_id}.nakama-0

        Match IDs are returned sorted for deterministic preprocessing output.
        """

        match_ids: set[str] = set()

        for file_path in sorted(
            self.dataset_root.glob(
                "February_*/*.nakama-0"
            )
        ):
            filename_without_suffix = (
                file_path.name.removesuffix(
                    ".nakama-0"
                )
            )

            if "_" not in filename_without_suffix:
                raise ValueError(
                    "Unexpected LILA telemetry filename format: "
                    f"{file_path.name}"
                )

            _, match_id = (
                filename_without_suffix.rsplit(
                    "_",
                    1,
                )
            )

            if not match_id:
                raise ValueError(
                    "LILA telemetry filename contains an empty match ID: "
                    f"{file_path.name}"
                )

            match_ids.add(
                match_id
            )

        return sorted(
            match_ids
        )

    def build_map_registry(self) -> list[GameMap]:
        """
        Return the normalized map registry consumed by export/frontend layers.

        LILA-specific asset names, texture dimensions, and projection constants
        stay inside this adapter. The returned objects use the generic GameMap
        contract so later layers do not need to understand LILA-specific files.
        """

        return [
            LILA_MAP_REGISTRY[map_id]
            for map_id in sorted(
                LILA_MAP_REGISTRY
            )
        ]

    def build_match_summary(self, match_id: str) -> MatchSummary:
        """
        Build a lightweight summary from the normalized MatchData contract.
        """

        return self.summarize_match_data(
            self.build_match_data(
                match_id
            )
        )

    @staticmethod
    def summarize_match_data(
        match: MatchData,
    ) -> MatchSummary:
        """
        Derive a MatchSummary from an already-normalized MatchData object.

        The export pipeline uses this helper so one match is parsed and
        reconstructed only once before both its detailed JSON and summary
        record are written.
        """

        participant_counts = Counter(
            participant.category
            for participant in match.participants
        )

        event_counts = {
            event_type: 0
            for event_type in NORMALIZED_EVENT_TYPES
        }

        for event in match.events:
            event_counts[
                event.type
            ] += 1

        return MatchSummary(
            match_id=match.match_id,
            date=match.date,
            map_id=match.map_id,
            duration_seconds=match.duration_seconds,
            participant_count=len(
                match.participants
            ),
            human_count=participant_counts[
                "human"
            ],
            bot_count=participant_counts[
                "bot"
            ],
            event_counts=event_counts,
        )

    def build_match_data(self, match_id: str) -> MatchData:
        """
        Reconstruct one normalized match from all raw participant files.

        The resulting MatchData contains only the generic normalized model.
        LILA-specific event names and raw timestamp semantics remain inside
        this adapter.
        """

        source_files = self._find_match_files(
            match_id
        )

        if not source_files:
            raise ValueError(
                f"No LILA participant files found for match: {match_id}"
            )

        canonical_files = (
            self._deduplicate_exact_files(
                source_files
            )
        )

        parsed_files = [
            self.parse_participant_file(
                file_path
            )
            for file_path in canonical_files
        ]

        self._validate_reconstructed_match(
            expected_match_id=match_id,
            parsed_files=parsed_files,
        )

        match_start_timestamp_raw = (
            self.find_match_start_timestamp(
                parsed_files
            )
        )

        map_id = parsed_files[0].map_id
        projection = (
            self.get_map_projection(
                map_id
            )
        )

        participants: list[Participant] = []
        tracks: list[ParticipantTrack] = []
        events: list[TelemetryEvent] = []

        maximum_time_seconds = 0.0

        for parsed_file in parsed_files:
            participant_category = (
                self.classify_participant(
                    parsed_file
                )
            )

            if participant_category == "unknown":
                raise ValueError(
                    "Cannot reconstruct normalized match with an "
                    f"unknown participant: {parsed_file.source_path}"
                )

            participants.append(
                Participant(
                    id=parsed_file.participant_id,
                    category=participant_category,
                )
            )

            track_points: list[
                TelemetryPoint
            ] = []

            for row in parsed_file.rows:
                time_seconds = (
                    self.normalize_timestamp(
                        timestamp_raw=row.timestamp_raw,
                        match_start_timestamp_raw=match_start_timestamp_raw,
                    )
                )

                maximum_time_seconds = max(
                    maximum_time_seconds,
                    time_seconds,
                )

                if (
                    row.event_name
                    in MOVEMENT_EVENT_NAMES
                ):
                    map_u, map_v = (
                        self.project_world_to_map(
                            world_x=row.x,
                            world_z=row.z,
                            projection=projection,
                        )
                    )

                    track_points.append(
                        TelemetryPoint(
                            time_seconds=time_seconds,
                            world_x=row.x,
                            world_y=row.y,
                            world_z=row.z,
                            map_u=map_u,
                            map_v=map_v,
                        )
                    )
                    continue

                event = self.normalize_event_row(
                    row=row,
                    participant_id=parsed_file.participant_id,
                    participant_category=participant_category,
                    match_start_timestamp_raw=match_start_timestamp_raw,
                    projection=projection,
                )

                if event is not None:
                    events.append(event)

            track_points.sort(
                key=lambda point: (
                    point.time_seconds
                )
            )

            tracks.append(
                ParticipantTrack(
                    participant_id=parsed_file.participant_id,
                    points=track_points,
                )
            )

        participants.sort(
            key=lambda participant: (
                participant.category,
                participant.id,
            )
        )
        tracks.sort(
            key=lambda track: (
                track.participant_id
            )
        )
        events.sort(
            key=lambda event: (
                event.time_seconds,
                event.participant_id,
                event.type,
                event.owner_role,
            )
        )

        return MatchData(
            match_id=match_id,
            date=self._select_match_date(
                canonical_files
            ),
            map_id=map_id,
            duration_seconds=maximum_time_seconds,
            participants=participants,
            tracks=tracks,
            events=events,
        )

    def parse_participant_file(
        self,
        file_path: Path,
    ) -> ParsedLilaParticipantFile:
        """
        Parse one raw LILA participant telemetry file.

        Parsed rows are sorted by raw timestamp before being returned so
        downstream normalization never depends on source row order.
        """

        if not file_path.exists():
            raise FileNotFoundError(
                f"Telemetry file does not exist: {file_path}"
            )

        dataframe = pl.read_parquet(file_path)

        if dataframe.is_empty():
            raise ValueError(
                f"Telemetry file is empty: {file_path}"
            )

        self._validate_columns(
            dataframe=dataframe,
            file_path=file_path,
        )

        participant_id = self._single_unique_value(
            dataframe=dataframe,
            column="user_id",
            file_path=file_path,
        )
        raw_match_id = self._single_unique_value(
            dataframe=dataframe,
            column="match_id",
            file_path=file_path,
        )
        map_id = self._single_unique_value(
            dataframe=dataframe,
            column="map_id",
            file_path=file_path,
        )

        match_id = self._normalize_match_id(
            str(raw_match_id)
        )

        parsed_rows: list[ParsedLilaRow] = []

        raw_rows = dataframe.select(
            [
                pl.col("ts").cast(
                    pl.Int64
                ).alias("timestamp_raw"),
                "x",
                "y",
                "z",
                "event",
            ]
        ).iter_rows(named=True)

        for row in raw_rows:
            parsed_rows.append(
                ParsedLilaRow(
                    timestamp_raw=int(
                        row["timestamp_raw"]
                    ),
                    x=float(row["x"]),
                    y=float(row["y"]),
                    z=float(row["z"]),
                    event_name=self._decode_event(
                        row["event"],
                        file_path=file_path,
                    ),
                )
            )

        parsed_rows.sort(
            key=lambda row: row.timestamp_raw
        )

        return ParsedLilaParticipantFile(
            source_path=file_path,
            participant_id=str(
                participant_id
            ),
            match_id=match_id,
            map_id=str(map_id),
            rows=parsed_rows,
        )

    def classify_participant(
        self,
        parsed_file: ParsedLilaParticipantFile,
    ) -> ParticipantCategory:
        """
        Classify a participant from movement-event semantics.

        Position means human. BotPosition means bot. ID format is not
        used as the authoritative classification signal.
        """

        event_names = {
            row.event_name
            for row in parsed_file.rows
        }

        has_position = (
            "Position" in event_names
        )
        has_bot_position = (
            "BotPosition" in event_names
        )

        if (
            has_position
            and has_bot_position
        ):
            raise ValueError(
                "Participant file contains both Position and "
                f"BotPosition events: {parsed_file.source_path}"
            )

        if has_position:
            return "human"

        if has_bot_position:
            return "bot"

        return "unknown"

    def find_match_start_timestamp(
        self,
        parsed_files: Iterable[
            ParsedLilaParticipantFile
        ],
    ) -> int:
        """
        Return the earliest raw timestamp across participant files.

        All supplied participant files must belong to the same match.
        """

        files = list(parsed_files)

        if not files:
            raise ValueError(
                "Cannot determine match start from an empty participant set."
            )

        match_ids = {
            parsed_file.match_id
            for parsed_file in files
        }

        if len(match_ids) != 1:
            raise ValueError(
                "Participant files must belong to exactly one match "
                "when determining match start."
            )

        timestamps = [
            parsed_file.rows[0].timestamp_raw
            for parsed_file in files
            if parsed_file.rows
        ]

        if not timestamps:
            raise ValueError(
                "Cannot determine match start because participant files "
                "contain no telemetry rows."
            )

        return min(timestamps)

    @staticmethod
    def normalize_timestamp(
        timestamp_raw: int,
        match_start_timestamp_raw: int,
    ) -> float:
        """Convert a stored LILA timestamp into match-relative seconds."""

        raw_delta = (
            timestamp_raw
            - match_start_timestamp_raw
        )

        if raw_delta < 0:
            raise ValueError(
                "Timestamp cannot occur before the supplied match start."
            )

        return (
            raw_delta
            * PLAYBACK_SECONDS_PER_RAW_UNIT
        )

    @staticmethod
    def project_world_to_map(
        world_x: float,
        world_z: float,
        projection: MapProjection,
    ) -> tuple[float, float]:
        """
        Project LILA world x/z coordinates into normalized map coordinates.

        No vertical screen inversion is applied here.
        """

        if projection.scale <= 0:
            raise ValueError(
                "Map projection scale must be greater than zero."
            )

        map_u = (
            world_x
            - projection.origin_x
        ) / projection.scale

        map_v = (
            world_z
            - projection.origin_z
        ) / projection.scale

        return (
            float(map_u),
            float(map_v),
        )

    @staticmethod
    def get_map_projection(
        map_id: str,
    ) -> MapProjection:
        """Return LILA projection metadata for a known map."""

        try:
            return LILA_MAP_PROJECTIONS[
                map_id
            ]
        except KeyError as exc:
            raise ValueError(
                f"Unknown LILA map ID: {map_id}"
            ) from exc

    def normalize_event_row(
        self,
        *,
        row: ParsedLilaRow,
        participant_id: str,
        participant_category: ParticipantCategory,
        match_start_timestamp_raw: int,
        projection: MapProjection,
    ) -> TelemetryEvent | None:
        """Convert one parsed LILA row into a generic normalized event."""

        if row.event_name in MOVEMENT_EVENT_NAMES:
            return None

        if row.event_name not in NORMALIZABLE_EVENT_NAMES:
            raise ValueError(
                f"Unknown LILA event type: {row.event_name}"
            )

        time_seconds = self.normalize_timestamp(
            timestamp_raw=row.timestamp_raw,
            match_start_timestamp_raw=match_start_timestamp_raw,
        )

        map_u, map_v = self.project_world_to_map(
            world_x=row.x,
            world_z=row.z,
            projection=projection,
        )

        if row.event_name == "Kill":
            self._require_participant_category(
                participant_category=participant_category,
                event_name=row.event_name,
            )
            return TelemetryEvent(
                time_seconds=time_seconds,
                type="kill",
                participant_id=participant_id,
                participant_category=participant_category,
                owner_role="killer",
                world_x=row.x,
                world_y=row.y,
                world_z=row.z,
                map_u=map_u,
                map_v=map_v,
                source_category=participant_category,
                target_category="human",
            )

        if row.event_name == "Killed":
            self._require_participant_category(
                participant_category=participant_category,
                event_name=row.event_name,
            )
            return TelemetryEvent(
                time_seconds=time_seconds,
                type="death",
                participant_id=participant_id,
                participant_category=participant_category,
                owner_role="victim",
                world_x=row.x,
                world_y=row.y,
                world_z=row.z,
                map_u=map_u,
                map_v=map_v,
                source_category="human",
                target_category=participant_category,
            )

        if row.event_name == "BotKill":
            opposing_category = self._opposing_category(
                participant_category=participant_category,
                event_name=row.event_name,
            )
            return TelemetryEvent(
                time_seconds=time_seconds,
                type="kill",
                participant_id=participant_id,
                participant_category=participant_category,
                owner_role="killer",
                world_x=row.x,
                world_y=row.y,
                world_z=row.z,
                map_u=map_u,
                map_v=map_v,
                source_category=participant_category,
                target_category=opposing_category,
            )

        if row.event_name == "BotKilled":
            opposing_category = self._opposing_category(
                participant_category=participant_category,
                event_name=row.event_name,
            )
            return TelemetryEvent(
                time_seconds=time_seconds,
                type="death",
                participant_id=participant_id,
                participant_category=participant_category,
                owner_role="victim",
                world_x=row.x,
                world_y=row.y,
                world_z=row.z,
                map_u=map_u,
                map_v=map_v,
                source_category=opposing_category,
                target_category=participant_category,
            )

        if row.event_name == "KilledByStorm":
            self._require_participant_category(
                participant_category=participant_category,
                event_name=row.event_name,
            )
            return TelemetryEvent(
                time_seconds=time_seconds,
                type="storm_death",
                participant_id=participant_id,
                participant_category=participant_category,
                owner_role="victim",
                world_x=row.x,
                world_y=row.y,
                world_z=row.z,
                map_u=map_u,
                map_v=map_v,
                target_category=participant_category,
            )

        if row.event_name == "Loot":
            self._require_participant_category(
                participant_category=participant_category,
                event_name=row.event_name,
            )
            return TelemetryEvent(
                time_seconds=time_seconds,
                type="loot",
                participant_id=participant_id,
                participant_category=participant_category,
                owner_role="participant",
                world_x=row.x,
                world_y=row.y,
                world_z=row.z,
                map_u=map_u,
                map_v=map_v,
            )

        raise AssertionError(
            f"Unhandled LILA event type: {row.event_name}"
        )

    def _find_match_files(
        self,
        match_id: str,
    ) -> list[Path]:
        """Find all raw participant files whose filename belongs to a match."""

        pattern = (
            f"February_*/*_{match_id}.nakama-0"
        )

        return sorted(
            self.dataset_root.glob(
                pattern
            )
        )

    def _deduplicate_exact_files(
        self,
        files: Iterable[Path],
    ) -> list[Path]:
        """
        Remove byte-for-byte duplicate participant files.

        When the same exact file appears in multiple date folders, prefer the
        copy from the date containing more files for that same match. This
        preserves the duplicate participant alongside the rest of its match.
        Ties are resolved deterministically by path.
        """

        file_list = sorted(files)

        if not file_list:
            return []

        files_per_date = Counter(
            path.parent.name
            for path in file_list
        )

        files_by_hash: dict[
            str,
            list[Path],
        ] = {}

        for path in file_list:
            digest = self._sha256_file(
                path
            )
            files_by_hash.setdefault(
                digest,
                [],
            ).append(path)

        canonical_files: list[Path] = []

        for duplicate_group in (
            files_by_hash.values()
        ):
            chosen = sorted(
                duplicate_group,
                key=lambda path: (
                    -files_per_date[
                        path.parent.name
                    ],
                    str(path),
                ),
            )[0]

            canonical_files.append(
                chosen
            )

        return sorted(
            canonical_files
        )

    @classmethod
    def _select_match_date(
        cls,
        canonical_files: Iterable[Path],
    ) -> str:
        """
        Select the canonical source date and expose it as an ISO date.

        LILA stores dates in folder names such as "February_11". That storage
        convention stays inside the adapter. The normalized contract exposes
        a generic YYYY-MM-DD value for frontend filtering and future adapters.
        """

        dates = [
            path.parent.name
            for path in canonical_files
        ]

        if not dates:
            raise ValueError(
                "Cannot select match date from an empty file set."
            )

        counts = Counter(dates)

        canonical_date_folder = sorted(
            counts,
            key=lambda date_folder: (
                -counts[date_folder],
                date_folder,
            ),
        )[0]

        return cls._normalize_date_folder(
            canonical_date_folder
        )

    @staticmethod
    def _normalize_date_folder(
        date_folder: str,
    ) -> str:
        """Convert a LILA folder name such as February_11 into 2026-02-11."""

        try:
            parsed = datetime.strptime(
                f"{date_folder}_{LILA_DATASET_YEAR}",
                "%B_%d_%Y",
            )
        except ValueError as exc:
            raise ValueError(
                f"Unexpected LILA date folder: {date_folder}"
            ) from exc

        return parsed.date().isoformat()

    @staticmethod
    def _validate_reconstructed_match(
        *,
        expected_match_id: str,
        parsed_files: list[
            ParsedLilaParticipantFile
        ],
    ) -> None:
        if not parsed_files:
            raise ValueError(
                "Cannot reconstruct a match from zero participant files."
            )

        match_ids = {
            parsed_file.match_id
            for parsed_file in parsed_files
        }

        if match_ids != {
            expected_match_id
        }:
            raise ValueError(
                "Parsed participant files do not all match the requested "
                f"match ID: {expected_match_id}"
            )

        map_ids = {
            parsed_file.map_id
            for parsed_file in parsed_files
        }

        if len(map_ids) != 1:
            raise ValueError(
                "A reconstructed match must contain exactly one map ID."
            )

        participant_ids = [
            parsed_file.participant_id
            for parsed_file in parsed_files
        ]

        duplicate_participant_ids = [
            participant_id
            for participant_id, count
            in Counter(
                participant_ids
            ).items()
            if count > 1
        ]

        if duplicate_participant_ids:
            duplicate_text = ", ".join(
                sorted(
                    duplicate_participant_ids
                )
            )
            raise ValueError(
                "A reconstructed match contains duplicate participant IDs "
                f"after exact-file deduplication: {duplicate_text}"
            )

    @staticmethod
    def _sha256_file(
        file_path: Path,
    ) -> str:
        digest = hashlib.sha256()

        with file_path.open(
            "rb"
        ) as file_handle:
            for chunk in iter(
                lambda: file_handle.read(
                    1024 * 1024
                ),
                b"",
            ):
                digest.update(
                    chunk
                )

        return digest.hexdigest()

    @staticmethod
    def _require_participant_category(
        *,
        participant_category: ParticipantCategory,
        event_name: str,
    ) -> None:
        if participant_category == "unknown":
            raise ValueError(
                f"Cannot normalize {event_name} for an unknown participant."
            )

    @classmethod
    def _opposing_category(
        cls,
        *,
        participant_category: ParticipantCategory,
        event_name: str,
    ) -> ParticipantCategory:
        cls._require_participant_category(
            participant_category=participant_category,
            event_name=event_name,
        )

        if participant_category == "human":
            return "bot"

        return "human"

    @staticmethod
    def _validate_columns(
        dataframe: pl.DataFrame,
        file_path: Path,
    ) -> None:
        missing_columns = (
            EXPECTED_COLUMNS
            - set(dataframe.columns)
        )

        if missing_columns:
            missing = ", ".join(
                sorted(missing_columns)
            )

            raise ValueError(
                f"Telemetry file {file_path} is missing "
                f"required columns: {missing}"
            )

    @staticmethod
    def _single_unique_value(
        dataframe: pl.DataFrame,
        column: str,
        file_path: Path,
    ) -> object:
        values = (
            dataframe
            .get_column(column)
            .unique()
            .to_list()
        )

        if len(values) != 1:
            raise ValueError(
                f"Telemetry file {file_path} must contain exactly one "
                f"{column}, found {len(values)}."
            )

        return values[0]

    @staticmethod
    def _normalize_match_id(
        raw_match_id: str,
    ) -> str:
        suffix = ".nakama-0"

        if raw_match_id.endswith(
            suffix
        ):
            return raw_match_id[
                :-len(suffix)
            ]

        return raw_match_id

    @staticmethod
    def _decode_event(
        raw_event: object,
        file_path: Path,
    ) -> str:
        if not isinstance(
            raw_event,
            (bytes, bytearray),
        ):
            raise ValueError(
                f"Telemetry file {file_path} contains "
                "a non-binary event value."
            )

        try:
            return bytes(
                raw_event
            ).decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ValueError(
                f"Telemetry file {file_path} contains "
                "an event value that is not valid UTF-8."
            ) from exc
