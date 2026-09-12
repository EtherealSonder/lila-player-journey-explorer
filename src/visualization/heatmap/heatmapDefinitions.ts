import type {
    HeatmapDefinition,
    HeatmapMode,
} from './heatmapTypes'

export const DEFAULT_HEATMAP_COLUMNS = 64
export const DEFAULT_HEATMAP_ROWS = 64

export const DEFAULT_HEATMAP_CELL_COUNT =
    DEFAULT_HEATMAP_COLUMNS *
    DEFAULT_HEATMAP_ROWS

export const HEATMAP_MODES = [
    'none',
    'traffic',
    'kills',
    'deaths',
] as const satisfies readonly HeatmapMode[]

export const HEATMAP_DEFINITIONS = {
    none: {
        mode: 'none',
        label: 'None',
        description:
            'Hide the heatmap overlay.',
    },
    traffic: {
        mode: 'traffic',
        label: 'Traffic',
        description:
            'Show participant movement-sample density.',
    },
    kills: {
        mode: 'kills',
        label: 'Kills',
        description:
            'Show normalized kill-location density.',
    },
    deaths: {
        mode: 'deaths',
        label: 'Deaths',
        description:
            'Show normalized death-location density.',
    },
} as const satisfies Record<
    HeatmapMode,
    HeatmapDefinition
>

export function isValidHeatmapGridSize(
    columns: number,
    rows: number,
): boolean {
    return (
        Number.isInteger(columns) &&
        Number.isInteger(rows) &&
        columns > 0 &&
        rows > 0
    )
}
