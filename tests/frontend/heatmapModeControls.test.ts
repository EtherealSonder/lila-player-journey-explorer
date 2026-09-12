import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    HEATMAP_DEFINITIONS,
    HEATMAP_MODES,
} from '../../src/visualization/heatmap/heatmapDefinitions'

describe(
    'heatmap mode controls contract',
    () => {
        it(
            'exposes exactly one ordered option for every supported heatmap mode',
            () => {
                expect(
                    HEATMAP_MODES,
                ).toEqual([
                    'none',
                    'traffic',
                    'kills',
                    'deaths',
                ])
            },
        )

        it(
            'provides a user-facing label for every control option',
            () => {
                expect(
                    HEATMAP_MODES.map(
                        (mode) =>
                            HEATMAP_DEFINITIONS[
                                mode
                            ].label,
                    ),
                ).toEqual([
                    'None',
                    'Traffic',
                    'Kills',
                    'Deaths',
                ])
            },
        )

        it(
            'keeps every definition keyed to its own mode',
            () => {
                for (const mode of HEATMAP_MODES) {
                    expect(
                        HEATMAP_DEFINITIONS[
                            mode
                        ].mode,
                    ).toBe(mode)
                }
            },
        )
    },
)
