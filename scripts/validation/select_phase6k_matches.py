from __future__ import annotations

import json
from pathlib import Path
from typing import Any

MATCH_DIR = Path("public/data/matches")


def load_matches() -> list[dict[str, Any]]:
    if not MATCH_DIR.exists():
        raise SystemExit(
            f"Could not find {MATCH_DIR}. "
            "Run this script from the project root after Phase 2 export."
        )

    matches: list[dict[str, Any]] = []

    for path in sorted(MATCH_DIR.glob("*.json")):
        with path.open("r", encoding="utf-8") as handle:
            matches.append(json.load(handle))

    if not matches:
        raise SystemExit(f"No match JSON files found under {MATCH_DIR}.")

    return matches


def participant_first_times(match: dict[str, Any]) -> list[float]:
    first_times: list[float] = []

    for track in match.get("tracks", []):
        points = track.get("points", [])
        if points:
            first_times.append(float(points[0]["time_seconds"]))

    return first_times


def total_points(match: dict[str, Any]) -> int:
    return sum(
        len(track.get("points", []))
        for track in match.get("tracks", [])
    )


def event_count(match: dict[str, Any], event_type: str) -> int:
    return sum(
        1
        for event in match.get("events", [])
        if event.get("type") == event_type
    )


def summary(match: dict[str, Any]) -> str:
    first_times = participant_first_times(match)
    latest_start = max(first_times, default=0.0)

    return (
        f"{match['match_id']} | "
        f"{match['map_id']} | "
        f"duration={match['duration_seconds']:.0f}s | "
        f"participants={len(match.get('participants', []))} | "
        f"points={total_points(match)} | "
        f"events={len(match.get('events', []))} | "
        f"death={event_count(match, 'death')} | "
        f"storm={event_count(match, 'storm_death')} | "
        f"latest_start={latest_start:.0f}s"
    )


def pick_dense_ambrose(matches: list[dict[str, Any]]) -> dict[str, Any]:
    candidates = [
        match
        for match in matches
        if match.get("map_id") == "AmbroseValley"
    ]
    return max(
        candidates,
        key=lambda match: (
            len(match.get("participants", [])),
            total_points(match),
        ),
    )


def pick_grand_rift(matches: list[dict[str, Any]]) -> dict[str, Any]:
    candidates = [
        match
        for match in matches
        if match.get("map_id") == "GrandRift"
    ]
    return max(
        candidates,
        key=lambda match: (
            len(match.get("participants", [])),
            total_points(match),
        ),
    )


def pick_longest(matches: list[dict[str, Any]]) -> dict[str, Any]:
    return max(
        matches,
        key=lambda match: float(match.get("duration_seconds", 0)),
    )


def pick_late_start(matches: list[dict[str, Any]]) -> dict[str, Any]:
    candidates = [
        match
        for match in matches
        if len(match.get("tracks", [])) > 1
    ]
    return max(
        candidates,
        key=lambda match: max(
            participant_first_times(match),
            default=0.0,
        ),
    )


def pick_death_or_storm(matches: list[dict[str, Any]]) -> dict[str, Any]:
    storm = [
        match
        for match in matches
        if event_count(match, "storm_death") > 0
    ]

    if storm:
        return max(
            storm,
            key=lambda match: (
                event_count(match, "storm_death"),
                event_count(match, "death"),
                len(match.get("events", [])),
            ),
        )

    death = [
        match
        for match in matches
        if event_count(match, "death") > 0
    ]
    return max(
        death,
        key=lambda match: (
            event_count(match, "death"),
            len(match.get("events", [])),
        ),
    )


def main() -> None:
    matches = load_matches()

    selected = {
        "Dense Ambrose Valley": pick_dense_ambrose(matches),
        "Grand Rift projection case": pick_grand_rift(matches),
        "Longest duration": pick_longest(matches),
        "Sparse / late-start case": pick_late_start(matches),
        "Death / storm-death case": pick_death_or_storm(matches),
    }

    print("Phase 6K manual validation match candidates")
    print("=" * 72)

    for label, match in selected.items():
        print(f"\n{label}")
        print(summary(match))


if __name__ == "__main__":
    main()
