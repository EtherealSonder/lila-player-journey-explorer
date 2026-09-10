from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal


ParticipantCategory = Literal[
    "human",
    "bot",
    "unknown",
]

TelemetryEventType = Literal[
    "kill",
    "death",
    "storm_death",
    "loot",
]

EventOwnerRole = Literal[
    "killer",
    "victim",
    "participant",
]


@dataclass(frozen=True)
class MapProjection:
    """
    Describes how world-space coordinates are converted into
    normalized map coordinates.

    The projection itself is dataset-independent. An adapter is
    responsible for supplying the correct values for a particular
    dataset.
    """

    origin_x: float
    origin_z: float
    scale: float


@dataclass(frozen=True)
class GameMap:
    """
    Frontend-facing metadata for a playable map.
    """

    id: str
    display_name: str
    image_path: str
    projection: MapProjection

    texture_width: int | None = None
    texture_height: int | None = None


@dataclass(frozen=True)
class Participant:
    """
    A participant that took part in a match.
    """

    id: str
    category: ParticipantCategory


@dataclass(frozen=True)
class TelemetryPoint:
    """
    One chronological point in a participant journey.

    World coordinates are retained for debugging and future analysis.

    map_u and map_v represent normalized map coordinates rather than
    texture pixels.
    """

    time_seconds: float

    world_x: float
    world_y: float
    world_z: float

    map_u: float
    map_v: float


@dataclass(frozen=True)
class TelemetryEvent:
    """
    A normalized gameplay event.

    Event names are generic frontend concepts such as 'kill' and
    'death'. Dataset-specific event names must not appear here.
    """

    time_seconds: float
    type: TelemetryEventType

    participant_id: str
    participant_category: ParticipantCategory

    owner_role: EventOwnerRole

    world_x: float
    world_y: float
    world_z: float

    map_u: float
    map_v: float

    source_category: ParticipantCategory | None = None
    target_category: ParticipantCategory | None = None

    metadata: dict[str, Any] = field(
        default_factory=dict
    )


@dataclass(frozen=True)
class ParticipantTrack:
    """
    Chronologically ordered movement history for one participant.
    """

    participant_id: str
    points: list[TelemetryPoint]


@dataclass(frozen=True)
class MatchSummary:
    """
    Lightweight match metadata used for filters and match selection.

    This intentionally contains no full trajectory data.
    """

    match_id: str
    date: str
    map_id: str

    duration_seconds: float

    participant_count: int
    human_count: int
    bot_count: int

    event_counts: dict[str, int] = field(
        default_factory=dict
    )


@dataclass(frozen=True)
class MatchData:
    """
    Complete normalized representation of one match.

    This is the primary frontend-facing telemetry object.
    """

    match_id: str
    date: str
    map_id: str

    duration_seconds: float

    participants: list[Participant]
    tracks: list[ParticipantTrack]
    events: list[TelemetryEvent]

    def to_dict(self) -> dict[str, Any]:
        """
        Convert the complete normalized match into JSON-compatible
        Python structures.
        """

        return asdict(self)