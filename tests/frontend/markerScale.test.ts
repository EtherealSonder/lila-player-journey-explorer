import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    getCameraAwareMarkerLocalScale,
    MIN_MARKER_SCREEN_SCALE,
} from '../../src/visualization/camera/markerScale'

describe(
    'camera-aware marker sizing',
    () => {
        it(
            'keeps normal marker size at 1x zoom',
            () => {
                expect(
                    getCameraAwareMarkerLocalScale(
                        1,
                    ),
                ).toBe(1)
            },
        )

        it(
            'compensates for camera zoom so markers do not grow with the map',
            () => {
                const localScale =
                    getCameraAwareMarkerLocalScale(
                        2,
                    )

                expect(localScale).toBeLessThan(
                    0.5,
                )
            },
        )

        it(
            'makes the final on-screen marker slightly smaller at 4x zoom',
            () => {
                const localScale =
                    getCameraAwareMarkerLocalScale(
                        4,
                    )
                const screenScale =
                    localScale * 4

                expect(screenScale).toBeLessThan(1)
                expect(screenScale).toBeGreaterThanOrEqual(
                    MIN_MARKER_SCREEN_SCALE,
                )
            },
        )

        it(
            'handles invalid scale safely as 1x',
            () => {
                expect(
                    getCameraAwareMarkerLocalScale(
                        Number.NaN,
                    ),
                ).toBe(1)

                expect(
                    getCameraAwareMarkerLocalScale(
                        0,
                    ),
                ).toBe(1)
            },
        )
    },
)
