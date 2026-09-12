import type {
    MatchData,
} from '../../telemetry/types'
import {
    aggregateHeatmapPoints,
} from './heatmapAggregation'
import {
    DEFAULT_HEATMAP_COLUMNS,
    DEFAULT_HEATMAP_ROWS,
} from './heatmapDefinitions'
import {
    getDeathHeatmapPoints,
    getKillHeatmapPoints,
    getTrafficHeatmapPoints,
} from './heatmapSources'
import type {
    HeatmapGrid,
    HeatmapMode,
    HeatmapPoint,
} from './heatmapTypes'

/**
 * Selects the normalized heatmap source for one match and one heatmap mode.
 *
 * This function does not aggregate or normalize. It exists so source semantics
 * remain explicit and testable before grid construction.
 */
export function getHeatmapPointsForMode(
    matchData: MatchData,
    mode: HeatmapMode,
): HeatmapPoint[] {
    switch (mode) {
        case 'traffic':
            return getTrafficHeatmapPoints(
                matchData,
            )

        case 'kills':
            return getKillHeatmapPoints(
                matchData,
            )

        case 'deaths':
            return getDeathHeatmapPoints(
                matchData,
            )

        case 'none':
            return []
    }
}

/**
 * Builds one complete heatmap grid for the currently selected match.
 *
 * Intensity normalization is intentionally match-local. The aggregator derives
 * maxCount only from the selected match and selected mode, then assigns:
 *
 *     intensity = cell.count / grid.maxCount
 *
 * No global dataset maximum, previous match, previous mode, playback time, or
 * renderer state contributes to the result.
 */
export function buildHeatmapGridForMatch(
    matchData: MatchData,
    mode: HeatmapMode,
    columns = DEFAULT_HEATMAP_COLUMNS,
    rows = DEFAULT_HEATMAP_ROWS,
): HeatmapGrid {
    const points =
        getHeatmapPointsForMode(
            matchData,
            mode,
        )

    return aggregateHeatmapPoints(
        points,
        columns,
        rows,
    )
}
