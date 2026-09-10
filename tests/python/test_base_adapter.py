from pathlib import Path

import pytest

from scripts.adapters import BaseTelemetryAdapter
from scripts.models import MatchData, MatchSummary


def test_base_adapter_cannot_be_instantiated() -> None:
    with pytest.raises(TypeError):
        BaseTelemetryAdapter(Path("example-dataset"))


class ExampleTelemetryAdapter(BaseTelemetryAdapter):
    def discover_match_ids(self) -> list[str]:
        return ["match-1"]

    def build_match_summary(self, match_id: str) -> MatchSummary:
        return MatchSummary(
            match_id=match_id,
            date="2026-02-10",
            map_id="example-map",
            duration_seconds=30.0,
            participant_count=1,
            human_count=1,
            bot_count=0,
        )

    def build_match_data(self, match_id: str) -> MatchData:
        return MatchData(
            match_id=match_id,
            date="2026-02-10",
            map_id="example-map",
            duration_seconds=30.0,
            participants=[],
            tracks=[],
            events=[],
        )


def test_concrete_adapter_can_implement_contract() -> None:
    adapter = ExampleTelemetryAdapter(
        Path("example-dataset")
    )

    assert adapter.dataset_root == Path("example-dataset")

    assert adapter.discover_match_ids() == [
        "match-1"
    ]

    summary = adapter.build_match_summary(
        "match-1"
    )

    assert summary.match_id == "match-1"
    assert summary.map_id == "example-map"

    match = adapter.build_match_data(
        "match-1"
    )

    assert match.match_id == "match-1"