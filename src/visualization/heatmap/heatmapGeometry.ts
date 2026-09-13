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
