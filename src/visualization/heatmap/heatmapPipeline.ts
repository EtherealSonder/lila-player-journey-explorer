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
