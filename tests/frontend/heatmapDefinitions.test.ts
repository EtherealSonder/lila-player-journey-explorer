import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    DEFAULT_HEATMAP_CELL_COUNT,
    DEFAULT_HEATMAP_COLUMNS,
    DEFAULT_HEATMAP_ROWS,
    HEATMAP_DEFINITIONS,
    HEATMAP_MODES,
    isValidHeatmapGridSize,
} from '../../src/visualization/heatmap/heatmapDefinitions'

describe('heatmap data contract', () => {
    it('defines the four mutually exclusive heatmap modes', () => {
        expect(HEATMAP_MODES).toEqual([
            'none',
            'traffic',
            'kills',
            'deaths',
        ])

        expect(
            new Set(HEATMAP_MODES).size,
        ).toBe(4)
    })

    it('provides one definition for every heatmap mode', () => {
        expect(
            Object.keys(
                HEATMAP_DEFINITIONS,
            ).sort(),
        ).toEqual(
            [...HEATMAP_MODES].sort(),
        )
    })

    it('locks the initial grid to 64 x 64 cells', () => {
        expect(
            DEFAULT_HEATMAP_COLUMNS,
        ).toBe(64)

        expect(
            DEFAULT_HEATMAP_ROWS,
        ).toBe(64)

        expect(
            DEFAULT_HEATMAP_CELL_COUNT,
        ).toBe(4096)
    })

    it('accepts positive integer grid dimensions', () => {
        expect(
            isValidHeatmapGridSize(
                64,
                64,
            ),
        ).toBe(true)

        expect(
            isValidHeatmapGridSize(
                1,
                1,
            ),
        ).toBe(true)
    })

    it.each([
        [0, 64],
        [64, 0],
        [-1, 64],
        [64, -1],
        [64.5, 64],
        [64, 64.5],
        [Number.NaN, 64],
        [64, Number.POSITIVE_INFINITY],
    ])(
        'rejects invalid grid size %s x %s',
        (columns, rows) => {
            expect(
                isValidHeatmapGridSize(
                    columns,
                    rows,
                ),
            ).toBe(false)
        },
    )
})
