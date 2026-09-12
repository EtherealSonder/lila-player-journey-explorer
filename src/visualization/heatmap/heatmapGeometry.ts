import type { MapRenderRect } from '../../map/mapGeometry'
import type {
    HeatmapCell,
    HeatmapGrid,
} from './heatmapTypes'

export interface HeatmapCellRect {
    x: number
    y: number
    width: number
    height: number
}

/**
 * Projects one normalized heatmap grid cell into the rendered minimap.
 *
 * Aggregation keeps y in normalized map_v grid order. Rendering performs the
 * same vertical inversion used by the existing telemetry projection:
 *
 *     screen_y = (1 - map_v) * rendered_height
 *
 * For a cell, that means row zero is drawn at the bottom of the rendered map.
 */
export function projectHeatmapCell(
    cell: HeatmapCell,
    grid: Pick<
        HeatmapGrid,
        'columns' | 'rows'
    >,
    mapRect: MapRenderRect,
): HeatmapCellRect {
    if (
        grid.columns <= 0 ||
        grid.rows <= 0
    ) {
        throw new RangeError(
            'Heatmap grid dimensions must be positive.',
        )
    }

    const cellWidth =
        mapRect.width / grid.columns
    const cellHeight =
        mapRect.height / grid.rows

    return {
        x:
            mapRect.x +
            cell.x * cellWidth,
        y:
            mapRect.y +
            (
                grid.rows -
                cell.y -
                1
            ) *
            cellHeight,
        width: cellWidth,
        height: cellHeight,
    }
}
