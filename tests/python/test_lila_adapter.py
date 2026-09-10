from pathlib import Path
import shutil

import pytest

from scripts.adapters import (
    LilaTelemetryAdapter,
    ParsedLilaParticipantFile,
    ParsedLilaRow,
)
from scripts.models import MapProjection


DATASET_ROOT = Path(
    "raw-data/extracted/player_data"
)

DUPLICATE_MATCH_ID = (
    "ac049b28-8116-4ff1-9e60-4be0537b8cc9"
)

TIMESTAMP_ORDER_FAILURE_FILES = [
    (
        "February_10/"
        "688cb2e4-2215-4b3b-9af1-a6ee71d17636_"
        "0954f788-ba35-4227-b6d4-a1172dd87d71.nakama-0"
    ),
    (
        "February_10/"
        "94d042cb-a0f2-45f3-bdca-42fab73cfef5_"
        "d3a3297e-2cdf-4a49-8450-09119b91a779.nakama-0"
    ),
    (
        "February_11/"
        "db454a35-d216-4379-b140-2931160c7d8a_"
        "fc797a67-e443-4f70-8813-5d2f30317e79.nakama-0"
    ),
]


def find_first_telemetry_file() -> Path:
    files = sorted(
        DATASET_ROOT.glob(
            "February_*/*.nakama-0"
        )
    )

    if not files:
        pytest.skip(
            "Raw LILA telemetry dataset is not available."
        )

    return files[0]


def participant_file(
    relative_path: str,
) -> Path:
    file_path = (
        DATASET_ROOT
        / relative_path
    )

    if not file_path.exists():
        pytest.skip(
            f"Expected LILA test file is unavailable: {file_path}"
        )

    return file_path


def find_first_bot_file(
    adapter: LilaTelemetryAdapter,
) -> Path:
    files = sorted(
        DATASET_ROOT.glob(
            "February_*/*.nakama-0"
        )
    )

    if not files:
        pytest.skip(
            "Raw LILA telemetry dataset is not available."
        )

    for file_path in files:
        parsed = (
            adapter.parse_participant_file(
                file_path
            )
        )

        event_names = {
            row.event_name
            for row in parsed.rows
        }

        if (
            "BotPosition" in event_names
            and "Position" not in event_names
        ):
            return file_path

    pytest.fail(
        "No bot participant file was found."
    )


def make_synthetic_file(
    *,
    match_id: str,
    participant_id: str,
    timestamps: list[int],
) -> ParsedLilaParticipantFile:
    return ParsedLilaParticipantFile(
        source_path=Path(
            f"{participant_id}.nakama-0"
        ),
        participant_id=participant_id,
        match_id=match_id,
        map_id="example-map",
        rows=[
            ParsedLilaRow(
                timestamp_raw=timestamp,
                x=0.0,
                y=0.0,
                z=0.0,
                event_name="Position",
            )
            for timestamp in timestamps
        ],
    )


def make_event_row(
    event_name: str,
    *,
    timestamp_raw: int = 110,
    x: float = 0.0,
    y: float = 12.0,
    z: float = 0.0,
) -> ParsedLilaRow:
    return ParsedLilaRow(
        timestamp_raw=timestamp_raw,
        x=x,
        y=y,
        z=z,
        event_name=event_name,
    )


def normalize_synthetic_event(
    adapter: LilaTelemetryAdapter,
    *,
    event_name: str,
    participant_category: str,
):
    return adapter.normalize_event_row(
        row=make_event_row(
            event_name
        ),
        participant_id="participant-1",
        participant_category=participant_category,
        match_start_timestamp_raw=100,
        projection=MapProjection(
            origin_x=-50.0,
            origin_z=-50.0,
            scale=100.0,
        ),
    )


def test_parse_real_lila_participant_file() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )
    file_path = find_first_telemetry_file()
    parsed = (
        adapter.parse_participant_file(
            file_path
        )
    )

    assert parsed.source_path == file_path
    assert parsed.participant_id
    assert parsed.match_id
    assert parsed.map_id
    assert not parsed.match_id.endswith(
        ".nakama-0"
    )
    assert len(parsed.rows) > 0


def test_parser_preserves_known_lila_event_names() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    parsed = (
        adapter.parse_participant_file(
            find_first_telemetry_file()
        )
    )

    event_names = {
        row.event_name
        for row in parsed.rows
    }

    known_events = {
        "Position",
        "BotPosition",
        "Kill",
        "Killed",
        "BotKill",
        "BotKilled",
        "KilledByStorm",
        "Loot",
    }

    assert event_names
    assert event_names <= known_events


def test_missing_file_raises_file_not_found() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    with pytest.raises(
        FileNotFoundError
    ):
        adapter.parse_participant_file(
            DATASET_ROOT
            / "does-not-exist.nakama-0"
        )


def test_discover_match_ids_returns_sorted_unique_real_matches() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    match_ids = adapter.discover_match_ids()

    if not match_ids:
        pytest.skip(
            "Raw LILA telemetry dataset is not available."
        )

    assert match_ids == sorted(
        match_ids
    )
    assert len(match_ids) == len(
        set(match_ids)
    )
    assert len(match_ids) == 796
    assert DUPLICATE_MATCH_ID in match_ids


def test_classifies_human_from_position_events() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    parsed = (
        adapter.parse_participant_file(
            participant_file(
                "February_10/"
                "0019c582-574d-4a53-9f77-554519b75b4c_"
                "1298e3e2-2776-4038-ba9b-72808b041561.nakama-0"
            )
        )
    )

    assert (
        adapter.classify_participant(
            parsed
        )
        == "human"
    )


def test_numeric_id_can_still_be_human() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    parsed = (
        adapter.parse_participant_file(
            participant_file(
                "February_12/"
                "1429_ec57f6ca-1f6d-407c-bb6d-9d92f0927caf.nakama-0"
            )
        )
    )

    assert parsed.participant_id == "1429"
    assert (
        adapter.classify_participant(
            parsed
        )
        == "human"
    )


def test_classifies_bot_from_bot_position_events() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    parsed = (
        adapter.parse_participant_file(
            find_first_bot_file(
                adapter
            )
        )
    )

    assert (
        adapter.classify_participant(
            parsed
        )
        == "bot"
    )


def test_classifies_unknown_without_movement_events() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    parsed = ParsedLilaParticipantFile(
        source_path=Path(
            "synthetic-unknown.nakama-0"
        ),
        participant_id="example",
        match_id="example-match",
        map_id="example-map",
        rows=[
            make_event_row(
                "Loot"
            )
        ],
    )

    assert (
        adapter.classify_participant(
            parsed
        )
        == "unknown"
    )


def test_mixed_movement_events_raise_error() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    parsed = ParsedLilaParticipantFile(
        source_path=Path(
            "synthetic-mixed.nakama-0"
        ),
        participant_id="example",
        match_id="example-match",
        map_id="example-map",
        rows=[
            make_event_row(
                "Position"
            ),
            make_event_row(
                "BotPosition",
                timestamp_raw=111,
            ),
        ],
    )

    with pytest.raises(
        ValueError,
        match="both Position and BotPosition",
    ):
        adapter.classify_participant(
            parsed
        )


def test_known_timestamp_anomaly_files_are_sorted_after_parsing() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    for relative_path in (
        TIMESTAMP_ORDER_FAILURE_FILES
    ):
        parsed = (
            adapter.parse_participant_file(
                participant_file(
                    relative_path
                )
            )
        )

        timestamps = [
            row.timestamp_raw
            for row in parsed.rows
        ]

        assert timestamps == sorted(
            timestamps
        )


def test_match_start_uses_earliest_participant_timestamp() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    first = make_synthetic_file(
        match_id="match-1",
        participant_id="player-1",
        timestamps=[120, 150, 180],
    )
    second = make_synthetic_file(
        match_id="match-1",
        participant_id="player-2",
        timestamps=[100, 140, 200],
    )

    assert (
        adapter.find_match_start_timestamp(
            [first, second]
        )
        == 100
    )


def test_match_start_rejects_multiple_match_ids() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    first = make_synthetic_file(
        match_id="match-1",
        participant_id="player-1",
        timestamps=[100],
    )
    second = make_synthetic_file(
        match_id="match-2",
        participant_id="player-2",
        timestamps=[200],
    )

    with pytest.raises(
        ValueError,
        match="exactly one match",
    ):
        adapter.find_match_start_timestamp(
            [first, second]
        )


def test_timestamp_normalizes_to_match_relative_seconds() -> None:
    assert (
        LilaTelemetryAdapter.normalize_timestamp(
            timestamp_raw=1770754919,
            match_start_timestamp_raw=1770754537,
        )
        == 382.0
    )


def test_timestamp_before_match_start_is_rejected() -> None:
    with pytest.raises(
        ValueError,
        match="before the supplied match start",
    ):
        LilaTelemetryAdapter.normalize_timestamp(
            timestamp_raw=99,
            match_start_timestamp_raw=100,
        )


def test_known_map_projection_metadata() -> None:
    ambrose = (
        LilaTelemetryAdapter.get_map_projection(
            "AmbroseValley"
        )
    )

    assert ambrose == MapProjection(
        origin_x=-370.0,
        origin_z=-473.0,
        scale=900.0,
    )


@pytest.mark.parametrize(
    (
        "map_id",
        "world_x",
        "world_z",
        "expected_u",
        "expected_v",
    ),
    [
        ("AmbroseValley", -370.0, -473.0, 0.0, 0.0),
        ("AmbroseValley", 530.0, 427.0, 1.0, 1.0),
        ("GrandRift", -290.0, -290.0, 0.0, 0.0),
        ("GrandRift", 291.0, 291.0, 1.0, 1.0),
        ("Lockdown", -500.0, -500.0, 0.0, 0.0),
        ("Lockdown", 500.0, 500.0, 1.0, 1.0),
    ],
)
def test_world_to_map_projection_corners(
    map_id: str,
    world_x: float,
    world_z: float,
    expected_u: float,
    expected_v: float,
) -> None:
    projection = (
        LilaTelemetryAdapter.get_map_projection(
            map_id
        )
    )

    map_u, map_v = (
        LilaTelemetryAdapter.project_world_to_map(
            world_x=world_x,
            world_z=world_z,
            projection=projection,
        )
    )

    assert map_u == pytest.approx(
        expected_u
    )
    assert map_v == pytest.approx(
        expected_v
    )


def test_world_to_map_projection_midpoint() -> None:
    projection = MapProjection(
        origin_x=-500.0,
        origin_z=-500.0,
        scale=1000.0,
    )

    map_u, map_v = (
        LilaTelemetryAdapter.project_world_to_map(
            world_x=0.0,
            world_z=0.0,
            projection=projection,
        )
    )

    assert map_u == pytest.approx(
        0.5
    )
    assert map_v == pytest.approx(
        0.5
    )


def test_projection_does_not_flip_vertical_axis() -> None:
    projection = MapProjection(
        origin_x=0.0,
        origin_z=0.0,
        scale=100.0,
    )

    _, map_v = (
        LilaTelemetryAdapter.project_world_to_map(
            world_x=0.0,
            world_z=25.0,
            projection=projection,
        )
    )

    assert map_v == pytest.approx(
        0.25
    )


def test_projection_allows_out_of_bounds_coordinates() -> None:
    projection = MapProjection(
        origin_x=0.0,
        origin_z=0.0,
        scale=100.0,
    )

    map_u, map_v = (
        LilaTelemetryAdapter.project_world_to_map(
            world_x=125.0,
            world_z=-25.0,
            projection=projection,
        )
    )

    assert map_u == pytest.approx(
        1.25
    )
    assert map_v == pytest.approx(
        -0.25
    )


def test_projection_rejects_non_positive_scale() -> None:
    projection = MapProjection(
        origin_x=0.0,
        origin_z=0.0,
        scale=0.0,
    )

    with pytest.raises(
        ValueError,
        match="greater than zero",
    ):
        LilaTelemetryAdapter.project_world_to_map(
            world_x=0.0,
            world_z=0.0,
            projection=projection,
        )


def test_unknown_map_id_is_rejected() -> None:
    with pytest.raises(
        ValueError,
        match="Unknown LILA map ID",
    ):
        LilaTelemetryAdapter.get_map_projection(
            "UnknownMap"
        )


def test_movement_rows_do_not_become_normalized_events() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    result = adapter.normalize_event_row(
        row=make_event_row(
            "Position"
        ),
        participant_id="player-1",
        participant_category="human",
        match_start_timestamp_raw=100,
        projection=MapProjection(
            origin_x=-50.0,
            origin_z=-50.0,
            scale=100.0,
        ),
    )

    assert result is None


@pytest.mark.parametrize(
    (
        "event_name",
        "participant_category",
        "expected_type",
        "expected_owner_role",
        "expected_source",
        "expected_target",
    ),
    [
        ("Kill", "human", "kill", "killer", "human", "human"),
        ("Killed", "human", "death", "victim", "human", "human"),
        ("BotKill", "human", "kill", "killer", "human", "bot"),
        ("BotKilled", "human", "death", "victim", "bot", "human"),
        ("BotKill", "bot", "kill", "killer", "bot", "human"),
        ("BotKilled", "bot", "death", "victim", "human", "bot"),
    ],
)
def test_combat_event_mapping_and_ownership(
    event_name: str,
    participant_category: str,
    expected_type: str,
    expected_owner_role: str,
    expected_source: str,
    expected_target: str,
) -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    event = normalize_synthetic_event(
        adapter,
        event_name=event_name,
        participant_category=participant_category,
    )

    assert event is not None
    assert event.type == expected_type
    assert event.owner_role == expected_owner_role
    assert event.source_category == expected_source
    assert event.target_category == expected_target


def test_storm_death_mapping_and_ownership() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    event = normalize_synthetic_event(
        adapter,
        event_name="KilledByStorm",
        participant_category="human",
    )

    assert event is not None
    assert event.type == "storm_death"
    assert event.owner_role == "victim"


def test_loot_mapping_and_ownership() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    event = normalize_synthetic_event(
        adapter,
        event_name="Loot",
        participant_category="human",
    )

    assert event is not None
    assert event.type == "loot"
    assert event.owner_role == "participant"


def test_normalized_event_contains_time_coordinates_and_projection() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    event = adapter.normalize_event_row(
        row=make_event_row(
            "Loot",
            timestamp_raw=125,
            x=0.0,
            y=17.5,
            z=25.0,
        ),
        participant_id="player-1",
        participant_category="human",
        match_start_timestamp_raw=100,
        projection=MapProjection(
            origin_x=-50.0,
            origin_z=-50.0,
            scale=100.0,
        ),
    )

    assert event is not None
    assert event.time_seconds == 25.0
    assert event.map_u == pytest.approx(
        0.5
    )
    assert event.map_v == pytest.approx(
        0.75
    )


def test_unknown_event_name_is_rejected() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    with pytest.raises(
        ValueError,
        match="Unknown LILA event type",
    ):
        normalize_synthetic_event(
            adapter,
            event_name="UnexpectedEvent",
            participant_category="human",
        )


def test_event_with_unknown_participant_is_rejected() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    with pytest.raises(
        ValueError,
        match="unknown participant",
    ):
        normalize_synthetic_event(
            adapter,
            event_name="Loot",
            participant_category="unknown",
        )


def test_build_match_data_reconstructs_real_match() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    first_file = (
        find_first_telemetry_file()
    )
    parsed = (
        adapter.parse_participant_file(
            first_file
        )
    )

    match = adapter.build_match_data(
        parsed.match_id
    )

    assert match.match_id == parsed.match_id
    assert match.map_id == parsed.map_id
    assert match.date.startswith(
        "2026-02-"
    )
    assert match.duration_seconds >= 0.0
    assert len(match.participants) >= 1
    assert len(match.tracks) == len(
        match.participants
    )

    participant_ids = {
        participant.id
        for participant in match.participants
    }
    track_ids = {
        track.participant_id
        for track in match.tracks
    }

    assert track_ids == participant_ids


def test_reconstructed_tracks_and_events_are_chronological() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    first_file = (
        find_first_telemetry_file()
    )
    parsed = (
        adapter.parse_participant_file(
            first_file
        )
    )

    match = adapter.build_match_data(
        parsed.match_id
    )

    for track in match.tracks:
        times = [
            point.time_seconds
            for point in track.points
        ]

        assert times == sorted(
            times
        )

    event_times = [
        event.time_seconds
        for event in match.events
    ]

    assert event_times == sorted(
        event_times
    )


def test_exact_duplicate_match_is_deduplicated() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    raw_files = (
        adapter._find_match_files(
            DUPLICATE_MATCH_ID
        )
    )

    if not raw_files:
        pytest.skip(
            "Known duplicate match is unavailable."
        )

    match = adapter.build_match_data(
        DUPLICATE_MATCH_ID
    )

    assert len(raw_files) == 8
    assert len(match.participants) == 7
    assert len(match.tracks) == 7
    assert match.date == "2026-02-11"


def test_exact_duplicate_file_selection_prefers_match_context(
    tmp_path: Path,
) -> None:
    adapter = LilaTelemetryAdapter(
        tmp_path
    )

    day_10 = (
        tmp_path
        / "February_10"
    )
    day_11 = (
        tmp_path
        / "February_11"
    )

    day_10.mkdir()
    day_11.mkdir()

    duplicate_10 = (
        day_10
        / "player_match.nakama-0"
    )
    duplicate_11 = (
        day_11
        / "player_match.nakama-0"
    )
    companion_11 = (
        day_11
        / "bot_match.nakama-0"
    )

    duplicate_10.write_bytes(
        b"same participant content"
    )
    shutil.copyfile(
        duplicate_10,
        duplicate_11,
    )
    companion_11.write_bytes(
        b"different participant content"
    )

    canonical = (
        adapter._deduplicate_exact_files(
            [
                duplicate_10,
                duplicate_11,
                companion_11,
            ]
        )
    )

    assert duplicate_10 not in canonical
    assert duplicate_11 in canonical
    assert companion_11 in canonical


def test_build_match_data_rejects_unknown_match() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    with pytest.raises(
        ValueError,
        match="No LILA participant files found",
    ):
        adapter.build_match_data(
            "definitely-not-a-real-match"
        )


def test_reconstructed_match_contains_only_normalized_event_types() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    match = adapter.build_match_data(
        DUPLICATE_MATCH_ID
    )

    assert {
        event.type
        for event in match.events
    } <= {
        "kill",
        "death",
        "storm_death",
        "loot",
    }


def test_build_match_summary_matches_normalized_match_data() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    parsed = adapter.parse_participant_file(
        find_first_telemetry_file()
    )

    match = adapter.build_match_data(
        parsed.match_id
    )
    summary = adapter.build_match_summary(
        parsed.match_id
    )

    assert summary.match_id == match.match_id
    assert summary.date == match.date
    assert summary.map_id == match.map_id
    assert (
        summary.duration_seconds
        == match.duration_seconds
    )
    assert (
        summary.participant_count
        == len(match.participants)
    )

    assert summary.human_count == sum(
        participant.category == "human"
        for participant in match.participants
    )
    assert summary.bot_count == sum(
        participant.category == "bot"
        for participant in match.participants
    )


def test_match_summary_event_counts_match_normalized_events() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    match = adapter.build_match_data(
        DUPLICATE_MATCH_ID
    )
    summary = adapter.build_match_summary(
        DUPLICATE_MATCH_ID
    )

    assert set(
        summary.event_counts
    ) == {
        "kill",
        "death",
        "storm_death",
        "loot",
    }

    assert summary.event_counts == {
        "kill": sum(
            event.type == "kill"
            for event in match.events
        ),
        "death": sum(
            event.type == "death"
            for event in match.events
        ),
        "storm_death": sum(
            event.type == "storm_death"
            for event in match.events
        ),
        "loot": sum(
            event.type == "loot"
            for event in match.events
        ),
    }


def test_match_summary_keeps_zero_event_categories() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    parsed = adapter.parse_participant_file(
        find_first_telemetry_file()
    )
    summary = adapter.build_match_summary(
        parsed.match_id
    )

    assert set(
        summary.event_counts
    ) == {
        "kill",
        "death",
        "storm_death",
        "loot",
    }

    assert all(
        count >= 0
        for count in summary.event_counts.values()
    )


def test_duplicate_match_summary_uses_deduplicated_participant_count() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    summary = adapter.build_match_summary(
        DUPLICATE_MATCH_ID
    )

    assert summary.participant_count == 7
    assert (
        summary.human_count
        + summary.bot_count
        == summary.participant_count
    )
    assert summary.date == "2026-02-11"


def test_build_match_summary_rejects_unknown_match() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    with pytest.raises(
        ValueError,
        match="No LILA participant files found",
    ):
        adapter.build_match_summary(
            "definitely-not-a-real-match"
        )


def test_build_map_registry_contains_all_expected_maps() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    maps = adapter.build_map_registry()

    assert [
        game_map.id
        for game_map in maps
    ] == [
        "AmbroseValley",
        "GrandRift",
        "Lockdown",
    ]


def test_map_registry_contains_expected_display_names_and_asset_paths() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    maps_by_id = {
        game_map.id: game_map
        for game_map in adapter.build_map_registry()
    }

    assert (
        maps_by_id["AmbroseValley"].display_name
        == "Ambrose Valley"
    )
    assert (
        maps_by_id["AmbroseValley"].image_path
        == "/assets/maps/AmbroseValley_Minimap.png"
    )

    assert (
        maps_by_id["GrandRift"].display_name
        == "Grand Rift"
    )
    assert (
        maps_by_id["GrandRift"].image_path
        == "/assets/maps/GrandRift_Minimap.png"
    )

    assert (
        maps_by_id["Lockdown"].display_name
        == "Lockdown"
    )
    assert (
        maps_by_id["Lockdown"].image_path
        == "/assets/maps/Lockdown_Minimap.jpg"
    )


def test_map_registry_preserves_real_texture_dimensions() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    maps_by_id = {
        game_map.id: game_map
        for game_map in adapter.build_map_registry()
    }

    assert (
        maps_by_id["AmbroseValley"].texture_width,
        maps_by_id["AmbroseValley"].texture_height,
    ) == (
        4320,
        4320,
    )

    assert (
        maps_by_id["GrandRift"].texture_width,
        maps_by_id["GrandRift"].texture_height,
    ) == (
        2160,
        2158,
    )

    assert (
        maps_by_id["Lockdown"].texture_width,
        maps_by_id["Lockdown"].texture_height,
    ) == (
        9000,
        9000,
    )


def test_map_registry_projection_matches_adapter_projection_lookup() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    for game_map in adapter.build_map_registry():
        assert (
            game_map.projection
            == adapter.get_map_projection(
                game_map.id
            )
        )


def test_map_registry_ids_and_asset_paths_are_unique() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    maps = adapter.build_map_registry()

    map_ids = [
        game_map.id
        for game_map in maps
    ]
    asset_paths = [
        game_map.image_path
        for game_map in maps
    ]

    assert len(map_ids) == len(
        set(map_ids)
    )
    assert len(asset_paths) == len(
        set(asset_paths)
    )


def test_grand_rift_dimensions_are_not_forced_square() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    grand_rift = next(
        game_map
        for game_map in adapter.build_map_registry()
        if game_map.id == "GrandRift"
    )

    assert (
        grand_rift.texture_width
        != grand_rift.texture_height
    )
    assert grand_rift.texture_width == 2160
    assert grand_rift.texture_height == 2158


def test_summary_can_be_derived_from_existing_match_without_rebuild() -> None:
    adapter = LilaTelemetryAdapter(
        DATASET_ROOT
    )

    parsed = adapter.parse_participant_file(
        find_first_telemetry_file()
    )
    match = adapter.build_match_data(
        parsed.match_id
    )

    summary = adapter.summarize_match_data(
        match
    )

    assert summary.match_id == match.match_id
    assert summary.map_id == match.map_id
    assert summary.date == match.date
    assert summary.duration_seconds == match.duration_seconds
    assert summary.participant_count == len(
        match.participants
    )


def test_lila_date_folder_is_normalized_to_iso_date() -> None:
    assert (
        LilaTelemetryAdapter._normalize_date_folder(
            "February_10"
        )
        == "2026-02-10"
    )


def test_invalid_lila_date_folder_is_rejected() -> None:
    with pytest.raises(
        ValueError,
        match="Unexpected LILA date folder",
    ):
        LilaTelemetryAdapter._normalize_date_folder(
            "not-a-date"
        )
