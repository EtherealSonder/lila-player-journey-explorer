import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    DEFAULT_MAP_ALPHA,
    getHeatmapBasemapPresentation,
    HEATMAP_MAP_ALPHA,
} from '../../src/visualization/heatmap/heatmapPresentation'

describe(
    'heatmap basemap presentation',
    () => {
        it(
            'keeps the original basemap presentation when heatmap is inactive',
            () => {
                expect(
                    getHeatmapBasemapPresentation(
                        false,
                    ),
                ).toEqual({
                    muted: false,
                    alpha:
                        DEFAULT_MAP_ALPHA,
                })
            },
        )

        it(
            'mutes the basemap while a heatmap is active',
            () => {
                expect(
                    getHeatmapBasemapPresentation(
                        true,
                    ),
                ).toEqual({
                    muted: true,
                    alpha:
                        HEATMAP_MAP_ALPHA,
                })
            },
        )
    },
)
