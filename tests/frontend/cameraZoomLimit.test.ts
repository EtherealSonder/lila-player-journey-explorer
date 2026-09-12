import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    CAMERA_MAX_SCALE,
    clampCameraTransform,
    resetCameraTransform,
    zoomCameraAtPoint,
} from '../../src/visualization/camera/cameraMath'

const mapRect = {
    x: 100,
    y: 0,
    width: 800,
    height: 800,
}

const viewport = {
    width: 1000,
    height: 800,
}

describe(
    'Phase 8 camera zoom refinement',
    () => {
        it(
            'raises the maximum camera zoom to 6x',
            () => {
                expect(
                    CAMERA_MAX_SCALE,
                ).toBe(6)

                const zoomed =
                    zoomCameraAtPoint(
                        resetCameraTransform(),
                        12,
                        {
                            x: 500,
                            y: 400,
                        },
                        mapRect,
                        viewport,
                    )

                expect(zoomed.scale).toBe(6)
            },
        )

        it(
            'keeps reset at exactly 1x',
            () => {
                expect(
                    resetCameraTransform(),
                ).toEqual({
                    scale: 1,
                    x: 0,
                    y: 0,
                })
            },
        )

        it(
            'clamps an existing transform back inside the 6x camera contract',
            () => {
                const clamped =
                    clampCameraTransform(
                        {
                            scale: 99,
                            x: 0,
                            y: 0,
                        },
                        mapRect,
                        viewport,
                    )

                expect(clamped.scale).toBe(6)
            },
        )
    },
)
