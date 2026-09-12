import type {
    MatchData,
} from '../../telemetry/types'
import type {
    HeatmapMode,
} from './heatmapTypes'

export interface HeatmapCalculationState {
    matchData: MatchData | null
    mode: HeatmapMode
}

/**
 * Heatmap calculation is match-local and mode-local.
 *
 * Playback time, visibility filters, camera state, and renderer state are
 * intentionally absent from this contract. Those values must never trigger
 * source extraction, aggregation, or normalization.
 */
export function shouldRecalculateHeatmap(
    previous: HeatmapCalculationState,
    next: HeatmapCalculationState,
): boolean {
    return (
        previous.matchData !==
            next.matchData ||
        previous.mode !== next.mode
    )
}
