import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    projectHeatmapCell,
} from '../../src/visualization/heatmap/heatmapGeometry'
import type {
    HeatmapCell,
} from '../../src/visualization/heatmap/heatmapTypes'

const mapRect = {
    x: 100,
    y: 50,
    width: 640,
    height: 320,
}

function cell(
    x: number,
    y: number,
): HeatmapCell {
    return {
        x,
        y,
        count: 1,
        intensity: 1,
    }
}

describe(
    'heatmap cell projection',
    () => {
        it(
            'projects normalized grid columns into the rendered map width',
            () => {
                expect(
                    projectHeatmapCell(
                        cell(2, 0),
                        {
                            columns: 4,
                            rows: 2,
                        },
                        mapRect,
                    ),
                ).toEqual({
                    x: 420,
                    y: 210,
                    width: 160,
                    height: 160,
                })
            },
        )

        it(
            'inverts grid y so row zero renders at the bottom',
            () => {
                const bottom =
                    projectHeatmapCell(
                        cell(0, 0),
                        {
                            columns: 4,
                            rows: 2,
                        },
                        mapRect,
                    )

                const top =
                    projectHeatmapCell(
                        cell(0, 1),
                        {
                            columns: 4,
                            rows: 2,
                        },
                        mapRect,
                    )

                expect(bottom.y).toBe(210)
                expect(top.y).toBe(50)
            },
        )

        it(
            'keeps the final grid cell inside the rendered map rectangle',
            () => {
                expect(
                    projectHeatmapCell(
                        cell(3, 1),
                        {
                            columns: 4,
                            rows: 2,
                        },
                        mapRect,
                    ),
                ).toEqual({
                    x: 580,
                    y: 50,
                    width: 160,
                    height: 160,
                })
            },
        )

        it(
            'supports non-square grids and non-square rendered maps',
            () => {
                expect(
                    projectHeatmapCell(
                        cell(1, 2),
                        {
                            columns: 2,
                            rows: 4,
                        },
                        mapRect,
                    ),
                ).toEqual({
                    x: 420,
                    y: 130,
                    width: 320,
                    height: 80,
                })
            },
        )

        it(
            'throws for invalid grid dimensions',
            () => {
                expect(() =>
                    projectHeatmapCell(
                        cell(0, 0),
                        {
                            columns: 0,
                            rows: 4,
                        },
                        mapRect,
                    ),
                ).toThrow(
                    RangeError,
                )

                expect(() =>
                    projectHeatmapCell(
                        cell(0, 0),
                        {
                            columns: 4,
                            rows: 0,
                        },
                        mapRect,
                    ),
                ).toThrow(
                    RangeError,
                )
            },
        )
    },
)
