import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    aggregateHeatmapPoints,
    getHeatmapGridPosition,
} from '../../src/visualization/heatmap/heatmapAggregation'

describe('normalized-space heatmap aggregation', () => {
    it('returns an empty default 64 x 64 grid for empty input', () => {
        expect(
            aggregateHeatmapPoints([]),
        ).toEqual({
            columns: 64,
            rows: 64,
            maxCount: 0,
            cells: [],
        })
    })

    it('maps normalized minimum coordinates to the first cell', () => {
        expect(
            getHeatmapGridPosition(
                {
                    map_u: 0,
                    map_v: 0,
                },
            ),
        ).toEqual({
            x: 0,
            y: 0,
        })
    })

    it('maps normalized maximum coordinates to the final cell', () => {
        expect(
            getHeatmapGridPosition(
                {
                    map_u: 1,
                    map_v: 1,
                },
            ),
        ).toEqual({
            x: 63,
            y: 63,
        })
    })

    it('uses normalized cell boundaries deterministically', () => {
        expect(
            getHeatmapGridPosition(
                {
                    map_u: 0.5,
                    map_v: 0.25,
                },
            ),
        ).toEqual({
            x: 32,
            y: 16,
        })
    })

    it('supports custom grid dimensions', () => {
        expect(
            getHeatmapGridPosition(
                {
                    map_u: 0.8,
                    map_v: 0.2,
                },
                4,
                5,
            ),
        ).toEqual({
            x: 3,
            y: 1,
        })
    })

    it('counts repeated points in the same cell', () => {
        const grid =
            aggregateHeatmapPoints(
                [
                    {
                        map_u: 0.1,
                        map_v: 0.1,
                    },
                    {
                        map_u: 0.12,
                        map_v: 0.14,
                    },
                    {
                        map_u: 0.8,
                        map_v: 0.8,
                    },
                ],
                4,
                4,
            )

        expect(grid.maxCount).toBe(2)
        expect(grid.cells).toEqual([
            {
                x: 0,
                y: 0,
                count: 2,
                intensity: 1,
            },
            {
                x: 3,
                y: 3,
                count: 1,
                intensity: 0.5,
            },
        ])
    })

    it('normalizes intensity against the busiest cell', () => {
        const grid =
            aggregateHeatmapPoints(
                [
                    {
                        map_u: 0.1,
                        map_v: 0.1,
                    },
                    {
                        map_u: 0.1,
                        map_v: 0.1,
                    },
                    {
                        map_u: 0.1,
                        map_v: 0.1,
                    },
                    {
                        map_u: 0.6,
                        map_v: 0.6,
                    },
                    {
                        map_u: 0.6,
                        map_v: 0.6,
                    },
                    {
                        map_u: 0.9,
                        map_v: 0.1,
                    },
                ],
                4,
                4,
            )

        expect(grid.maxCount).toBe(3)

        expect(
            grid.cells.map(
                (cell) =>
                    cell.intensity,
            ),
        ).toEqual([
            1,
            1 / 3,
            2 / 3,
        ])
    })

    it('returns only occupied cells in stable row-major order', () => {
        const grid =
            aggregateHeatmapPoints(
                [
                    {
                        map_u: 0.9,
                        map_v: 0.9,
                    },
                    {
                        map_u: 0.1,
                        map_v: 0.6,
                    },
                    {
                        map_u: 0.6,
                        map_v: 0.1,
                    },
                ],
                4,
                4,
            )

        expect(
            grid.cells.map(
                ({ x, y }) => ({
                    x,
                    y,
                }),
            ),
        ).toEqual([
            {
                x: 2,
                y: 0,
            },
            {
                x: 0,
                y: 2,
            },
            {
                x: 3,
                y: 3,
            },
        ])
    })

    it('ignores non-finite and out-of-range normalized points', () => {
        const grid =
            aggregateHeatmapPoints(
                [
                    {
                        map_u: 0.5,
                        map_v: 0.5,
                    },
                    {
                        map_u: -0.1,
                        map_v: 0.5,
                    },
                    {
                        map_u: 1.1,
                        map_v: 0.5,
                    },
                    {
                        map_u:
                            Number.NaN,
                        map_v: 0.5,
                    },
                    {
                        map_u: 0.5,
                        map_v:
                            Number.POSITIVE_INFINITY,
                    },
                ],
                4,
                4,
            )

        expect(grid.maxCount).toBe(1)
        expect(grid.cells).toEqual([
            {
                x: 2,
                y: 2,
                count: 1,
                intensity: 1,
            },
        ])
    })

    it('returns null for an invalid normalized point', () => {
        expect(
            getHeatmapGridPosition(
                {
                    map_u: -1,
                    map_v: 0.5,
                },
            ),
        ).toBeNull()
    })

    it('does not mutate the source point array or point objects', () => {
        const points = [
            {
                map_u: 0.2,
                map_v: 0.3,
            },
            {
                map_u: 0.7,
                map_v: 0.8,
            },
        ]

        const snapshot =
            structuredClone(points)

        aggregateHeatmapPoints(
            points,
            8,
            8,
        )

        expect(points).toEqual(snapshot)
    })

    it.each([
        [0, 64],
        [64, 0],
        [-1, 64],
        [64, -1],
        [64.5, 64],
        [64, Number.NaN],
    ])(
        'rejects invalid grid dimensions %s x %s',
        (columns, rows) => {
            expect(() =>
                aggregateHeatmapPoints(
                    [],
                    columns,
                    rows,
                ),
            ).toThrow(RangeError)
        },
    )
})
