import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    getCameraAwareTrajectoryLocalScale,
    getTrajectoryScreenScale,
    MIN_TRAJECTORY_SCREEN_SCALE,
} from '../../src/visualization/camera/trajectoryScale'

describe(
    'camera-aware trajectory width',
    () => {
        it(
            'keeps normal trail thickness at 1x',
            () => {
                expect(
                    getTrajectoryScreenScale(1),
                ).toBe(1)

                expect(
                    getCameraAwareTrajectoryLocalScale(1),
                ).toBe(1)
            },
        )

        it(
            'reduces screen-space thickness as zoom increases',
            () => {
                expect(
                    getTrajectoryScreenScale(2),
                ).toBeLessThan(1)

                expect(
                    getTrajectoryScreenScale(4),
                ).toBeLessThan(
                    getTrajectoryScreenScale(2),
                )

                expect(
                    getTrajectoryScreenScale(6),
                ).toBeLessThan(
                    getTrajectoryScreenScale(4),
                )
            },
        )

        it(
            'uses a readable 65 percent floor at 6x',
            () => {
                expect(
                    getTrajectoryScreenScale(6),
                ).toBe(
                    MIN_TRAJECTORY_SCREEN_SCALE,
                )
            },
        )

        it(
            'compensates for the camera root scale',
            () => {
                const localScale =
                    getCameraAwareTrajectoryLocalScale(6)

                expect(
                    localScale * 6,
                ).toBeCloseTo(
                    MIN_TRAJECTORY_SCREEN_SCALE,
                )
            },
        )

        it(
            'falls back safely for invalid zoom values',
            () => {
                expect(
                    getCameraAwareTrajectoryLocalScale(
                        Number.NaN,
                    ),
                ).toBe(1)

                expect(
                    getCameraAwareTrajectoryLocalScale(0),
                ).toBe(1)
            },
        )
    },
)
