from scripts.models import (
    MatchData,
    Participant,
    ParticipantTrack,
    TelemetryEvent,
    TelemetryPoint,
)


def test_match_data_can_be_serialized() -> None:
    participant = Participant(
        id="player-1",
        category="human",
    )

    point = TelemetryPoint(
        time_seconds=12.0,
        world_x=100.0,
        world_y=5.0,
        world_z=200.0,
        map_u=0.25,
        map_v=0.75,
    )

    track = ParticipantTrack(
        participant_id="player-1",
        points=[point],
    )

    event = TelemetryEvent(
        time_seconds=12.0,
        type="kill",
        participant_id="player-1",
        participant_category="human",
        owner_role="killer",
        world_x=100.0,
        world_y=5.0,
        world_z=200.0,
        map_u=0.25,
        map_v=0.75,
        target_category="bot",
    )

    match = MatchData(
        match_id="example-match",
        date="2026-02-10",
        map_id="example-map",
        duration_seconds=30.0,
        participants=[participant],
        tracks=[track],
        events=[event],
    )

    result = match.to_dict()

    assert result["match_id"] == "example-match"
    assert result["participants"][0]["category"] == "human"

    assert (
        result["tracks"][0]["points"][0]["time_seconds"]
        == 12.0
    )

    assert result["events"][0]["type"] == "kill"
    assert result["events"][0]["owner_role"] == "killer"
    assert result["events"][0]["target_category"] == "bot"


def test_normalized_model_contains_no_lila_event_names() -> None:
    participant = Participant(
        id="player-1",
        category="human",
    )

    point = TelemetryPoint(
        time_seconds=0.0,
        world_x=0.0,
        world_y=0.0,
        world_z=0.0,
        map_u=0.5,
        map_v=0.5,
    )

    match = MatchData(
        match_id="example-match",
        date="2026-02-10",
        map_id="example-map",
        duration_seconds=0.0,
        participants=[participant],
        tracks=[
            ParticipantTrack(
                participant_id="player-1",
                points=[point],
            )
        ],
        events=[],
    )

    serialized = str(match.to_dict())

    forbidden_terms = [
        "BotPosition",
        "Position",
        "BotKill",
        "BotKilled",
        ".nakama-0",
    ]

    for term in forbidden_terms:
        assert term not in serialized