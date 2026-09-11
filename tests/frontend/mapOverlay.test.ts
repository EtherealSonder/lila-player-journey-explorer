import { describe, expect, it } from 'vitest'

import { mapUvToViewportPixels } from '../../src/map/mapOverlay'

describe('mapUvToViewportPixels', () => {
    const mapRect = {
        x: 200,
        y: 50,
        width: 800,
        height: 600,
    }

    it('adds the contained map offset after the locked vertical inversion', () => {
        expect(
            mapUvToViewportPixels(
                { mapU: 0.25, mapV: 0.25 },
                mapRect,
            ),
        ).toEqual({
            x: 400,
            y: 500,
        })
    })

    it('maps normalized top-left to the map rectangle top-left', () => {
        expect(
            mapUvToViewportPixels(
                { mapU: 0, mapV: 1 },
                mapRect,
            ),
        ).toEqual({
            x: 200,
            y: 50,
        })
    })

    it('maps normalized bottom-right to the map rectangle bottom-right', () => {
        expect(
            mapUvToViewportPixels(
                { mapU: 1, mapV: 0 },
                mapRect,
            ),
        ).toEqual({
            x: 1000,
            y: 650,
        })
    })

    it('does not clamp out-of-range coordinates', () => {
        expect(
            mapUvToViewportPixels(
                { mapU: 1.1, mapV: -0.1 },
                mapRect,
            ),
        ).toEqual({
            x: 1080,
            y: 710,
        })
    })
})
