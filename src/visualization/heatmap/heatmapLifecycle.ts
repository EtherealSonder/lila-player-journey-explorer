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
