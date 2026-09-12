import {
    DEFAULT_HEATMAP_COLUMNS,
    DEFAULT_HEATMAP_ROWS,
    isValidHeatmapGridSize,
} from './heatmapDefinitions'
import type {
    HeatmapGrid,
    HeatmapPoint,
} from './heatmapTypes'

export interface HeatmapGridPosition {
    x: number
    y: number
}

/**
 * Converts one normalized map-space point into a zero-based heatmap cell.
 *
 * The result remains in normalized map orientation. Phase 3 screen-space
 * Y inversion belongs to the renderer, not the aggregation layer.
 *
 * Invalid or out-of-range points return null rather than being clamped into
 * an edge cell.
 */
export function getHeatmapGridPosition(
    point: HeatmapPoint,
    columns: number = DEFAULT_HEATMAP_COLUMNS,
    rows: number = DEFAULT_HEATMAP_ROWS,
): HeatmapGridPosition | null {
    assertValidHeatmapGridSize(
        columns,
        rows,
    )

    if (!isValidNormalizedCoordinate(point.map_u)) {
        return null
    }

    if (!isValidNormalizedCoordinate(point.map_v)) {
        return null
    }

    return {
        x: normalizedCoordinateToCell(
            point.map_u,
            columns,
        ),
        y: normalizedCoordinateToCell(
            point.map_v,
            rows,
        ),
    }
}

/**
 * Aggregates normalized map-space samples into a sparse heatmap grid.
 *
 * Only occupied cells are returned. Cell counts are normalized against the
 * busiest cell in this aggregation, so intensity always falls within [0, 1].
 * Empty input produces maxCount = 0 and an empty cell list.
 */
export function aggregateHeatmapPoints(
    points: readonly HeatmapPoint[],
    columns: number = DEFAULT_HEATMAP_COLUMNS,
    rows: number = DEFAULT_HEATMAP_ROWS,
): HeatmapGrid {
    assertValidHeatmapGridSize(
        columns,
        rows,
    )

    const counts =
        new Uint32Array(
            columns * rows,
        )

    let maxCount = 0

    for (const point of points) {
        const position =
            getHeatmapGridPosition(
                point,
                columns,
                rows,
            )

        if (!position) {
            continue
        }

        const index =
            position.y * columns +
            position.x

        const nextCount =
            counts[index] + 1

        counts[index] = nextCount

        if (nextCount > maxCount) {
            maxCount = nextCount
        }
    }

    if (maxCount === 0) {
        return {
            columns,
            rows,
            maxCount: 0,
            cells: [],
        }
    }

    const cells = []

    for (
        let y = 0;
        y < rows;
        y += 1
    ) {
        for (
            let x = 0;
            x < columns;
            x += 1
        ) {
            const count =
                counts[
                    y * columns +
                    x
                ]

            if (count === 0) {
                continue
            }

            cells.push({
                x,
                y,
                count,
                intensity:
                    count / maxCount,
            })
        }
    }

    return {
        columns,
        rows,
        maxCount,
        cells,
    }
}

function normalizedCoordinateToCell(
    value: number,
    cellCount: number,
): number {
    return Math.min(
        cellCount - 1,
        Math.floor(
            value * cellCount,
        ),
    )
}

function isValidNormalizedCoordinate(
    value: number,
): boolean {
    return (
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 1
    )
}

function assertValidHeatmapGridSize(
    columns: number,
    rows: number,
): void {
    if (
        !isValidHeatmapGridSize(
            columns,
            rows,
        )
    ) {
        throw new RangeError(
            'Heatmap grid dimensions must be positive integers.',
        )
    }
}
