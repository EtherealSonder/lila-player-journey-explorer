import { describe, expect, it } from 'vitest'

import {
    MAX_CAMERA_SCALE,
    MIN_CAMERA_SCALE,
    clampCameraTransform,
    panCamera,
    resetCameraTransform,
    zoomCameraAtPoint,
} from '../../src/visualization/camera/cameraMath'

const mapRect = {
    x: 100,
    y: 50,
    width: 800,
    height: 600,
}

const viewport = {
    width: 1000,
    height: 700,
}

describe('map camera math', () => {
    it('resets to the fit-to-view transform', () => {
        expect(resetCameraTransform()).toEqual({
            scale: 1,
            x: 0,
            y: 0,
        })
    })

    it('clamps zoom to the supported range', () => {
        expect(
            zoomCameraAtPoint(
                resetCameraTransform(),
                10,
                { x: 500, y: 350 },
                mapRect,
                viewport,
            ).scale,
        ).toBe(MAX_CAMERA_SCALE)

        expect(
            zoomCameraAtPoint(
                {
                    scale: 2,
                    x: -500,
                    y: -350,
                },
                0.25,
                { x: 500, y: 350 },
                mapRect,
                viewport,
            ).scale,
        ).toBe(MIN_CAMERA_SCALE)
    })

    it('keeps the zoom anchor stable when constraints allow it', () => {
        const current = {
            scale: 2,
            x: -500,
            y: -350,
        }

        const pointer = {
            x: 500,
            y: 350,
        }

        const beforeLocal = {
            x: (pointer.x - current.x) / current.scale,
            y: (pointer.y - current.y) / current.scale,
        }

        const next = zoomCameraAtPoint(
            current,
            2.5,
            pointer,
            mapRect,
            viewport,
        )

        const afterScreen = {
            x: next.x + beforeLocal.x * next.scale,
            y: next.y + beforeLocal.y * next.scale,
        }

        expect(afterScreen.x).toBeCloseTo(pointer.x)
        expect(afterScreen.y).toBeCloseTo(pointer.y)
    })

    it('prevents panning the zoomed map completely out of view', () => {
        const zoomed = zoomCameraAtPoint(
            resetCameraTransform(),
            2,
            { x: 500, y: 350 },
            mapRect,
            viewport,
        )

        const panned = panCamera(
            zoomed,
            10000,
            10000,
            mapRect,
            viewport,
        )

        const transformedLeft =
            panned.x + mapRect.x * panned.scale
        const transformedTop =
            panned.y + mapRect.y * panned.scale

        expect(transformedLeft).toBeLessThanOrEqual(0)
        expect(transformedTop).toBeLessThanOrEqual(0)
    })

    it('recenters an axis when the scaled map is smaller than the viewport', () => {
        const clamped = clampCameraTransform(
            {
                scale: 1,
                x: 500,
                y: -500,
            },
            mapRect,
            viewport,
        )

        expect(clamped.x).toBeCloseTo(0)
        expect(clamped.y).toBeCloseTo(0)
    })
})
