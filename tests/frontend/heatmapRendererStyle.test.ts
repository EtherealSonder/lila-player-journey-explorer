import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    getHeatmapCellAlpha,
    getHeatmapCellRadius,
    getHeatmapColor,
    HEATMAP_MAX_ALPHA,
    HEATMAP_MIN_ALPHA,
    HEATMAP_RADIUS_MULTIPLIER,
} from '../../src/visualization/heatmap/HeatmapRenderer'

describe(
    'semantic single-hue heatmap presentation',
    () => {
        it(
            'keeps traffic within a blue palette',
            () => {
                expect(
                    getHeatmapColor(
                        'traffic',
                        0,
                    ),
                ).toBe(0x93c5fd)

                expect(
                    getHeatmapColor(
                        'traffic',
                        1,
                    ),
                ).toBe(0x2563eb)
            },
        )

        it(
            'keeps kills within a red palette',
            () => {
                expect(
                    getHeatmapColor(
                        'kills',
                        0,
                    ),
                ).toBe(0xfca5a5)

                expect(
                    getHeatmapColor(
                        'kills',
                        1,
                    ),
                ).toBe(0xdc2626)
            },
        )

        it(
            'keeps deaths within a muted purple palette',
            () => {
                expect(
                    getHeatmapColor(
                        'deaths',
                        0,
                    ),
                ).toBe(0xc4b5fd)

                expect(
                    getHeatmapColor(
                        'deaths',
                        1,
                    ),
                ).toBe(0x6d5aa8)
            },
        )

        it(
            'changes strength within the selected hue rather than crossing modes',
            () => {
                const low =
                    getHeatmapColor(
                        'kills',
                        0.25,
                    )
                const high =
                    getHeatmapColor(
                        'kills',
                        0.75,
                    )

                expect(low).not.toBe(high)
                expect(low).not.toBe(
                    getHeatmapColor(
                        'traffic',
                        0.25,
                    ),
                )
            },
        )

        it(
            'keeps intensity encoded through controlled alpha',
            () => {
                expect(
                    getHeatmapCellAlpha(
                        0,
                    ),
                ).toBe(
                    HEATMAP_MIN_ALPHA,
                )

                expect(
                    getHeatmapCellAlpha(
                        1,
                    ),
                ).toBe(
                    HEATMAP_MAX_ALPHA,
                )
            },
        )

        it(
            'preserves the soft overlap radius from 7H-B',
            () => {
                expect(
                    getHeatmapCellRadius(
                        10,
                        8,
                    ),
                ).toBe(
                    10 *
                    HEATMAP_RADIUS_MULTIPLIER,
                )
            },
        )
    },
)
