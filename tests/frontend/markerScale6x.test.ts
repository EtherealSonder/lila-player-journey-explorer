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
    'camera-aware marker sizing through 6x',
    () => {
        it(
            'keeps normal presentation at 1x',
            () => {
                expect(
                    getCameraAwareMarkerLocalScale(
                        1,
                    ),
                ).toBe(1)
            },
        )

        it(
            'keeps the final 6x screen marker bounded and readable',
            () => {
                const localScale =
                    getCameraAwareMarkerLocalScale(
                        6,
                    )
                const screenScale =
                    localScale * 6

                expect(screenScale).toBeLessThan(1)
                expect(screenScale).toBeGreaterThanOrEqual(
                    MIN_MARKER_SCREEN_SCALE,
                )
            },
        )

        it(
            'shrinks local marker scale as camera zoom increases',
            () => {
                expect(
                    getCameraAwareMarkerLocalScale(
                        6,
                    ),
                ).toBeLessThan(
                    getCameraAwareMarkerLocalScale(
                        4,
                    ),
                )
            },
        )
    },
)
