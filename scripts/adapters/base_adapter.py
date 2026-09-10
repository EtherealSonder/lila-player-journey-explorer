from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from scripts.models import MatchData, MatchSummary


class BaseTelemetryAdapter(ABC):
    """
    Abstract contract for converting a raw telemetry dataset into
    normalized telemetry models.

    Dataset-specific adapters are responsible for understanding raw
    files, event names, participant semantics, timestamps, and other
    source-specific details.

    Consumers of this adapter should only work with normalized models.
    """

    def __init__(self, dataset_root: Path) -> None:
        self.dataset_root = dataset_root

    @abstractmethod
    def discover_match_ids(self) -> list[str]:
        """
        Return all normalized match identifiers available in the dataset.

        Match IDs returned here must use the normalized identifier format
        expected by the rest of the application.
        """
        raise NotImplementedError

    @abstractmethod
    def build_match_summary(self, match_id: str) -> MatchSummary:
        """
        Build lightweight normalized metadata for one match.

        This is intended for manifest generation and frontend filtering.
        """
        raise NotImplementedError

    @abstractmethod
    def build_match_data(self, match_id: str) -> MatchData:
        """
        Build the complete normalized representation of one match.

        The returned object must contain no raw dataset-specific schema
        assumptions.
        """
        raise NotImplementedError