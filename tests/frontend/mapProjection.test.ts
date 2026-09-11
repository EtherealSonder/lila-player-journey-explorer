import { describe, expect, it } from 'vitest'

import {
    mapUvToRenderedPixels,
    type RenderedMapSize,
} from '../../src/map/mapProjection'

describe('mapUvToRenderedPixels', () => {
    const squareMap: RenderedMapSize = {
        width: 1000,
        height: 1000,
    }

    it('maps normalized bottom-left to rendered bottom-left', () => {
        expect(
            mapUvToRenderedPixels(
                { mapU: 0, mapV: 0 },
                squareMap,
            ),
        ).toEqual({
            x: 0,
            y: 1000,
        })
    })

    it('maps normalized top-right to rendered top-right', () => {
        expect(
            mapUvToRenderedPixels(
                { mapU: 1, mapV: 1 },
                squareMap,
            ),
        ).toEqual({
            x: 1000,
            y: 0,
        })
    })

    it('maps normalized top-left to rendered top-left', () => {
        expect(
            mapUvToRenderedPixels(
                { mapU: 0, mapV: 1 },
                squareMap,
            ),
        ).toEqual({
            x: 0,
            y: 0,
        })
    })

    it('maps normalized bottom-right to rendered bottom-right', () => {
        expect(
            mapUvToRenderedPixels(
                { mapU: 1, mapV: 0 },
                squareMap,
            ),
        ).toEqual({
            x: 1000,
            y: 1000,
        })
    })

    it('maps the midpoint to the midpoint', () => {
        expect(
            mapUvToRenderedPixels(
                { mapU: 0.5, mapV: 0.5 },
                squareMap,
            ),
        ).toEqual({
            x: 500,
            y: 500,
        })
    })

    it('uses width and height independently for a non-square rendered map', () => {
        expect(
            mapUvToRenderedPixels(
                { mapU: 0.25, mapV: 0.75 },
                { width: 1200, height: 800 },
            ),
        ).toEqual({
            x: 300,
            y: 200,
        })
    })

    it('protects the Grand Rift non-square dimension regression', () => {
        expect(
            mapUvToRenderedPixels(
                { mapU: 0.5, mapV: 0.25 },
                { width: 2160, height: 2158 },
            ),
        ).toEqual({
            x: 1080,
            y: 1618.5,
        })
    })

    it('preserves relative map position when rendered dimensions change', () => {
        const point = {
            mapU: 0.25,
            mapV: 0.75,
        }

        expect(
            mapUvToRenderedPixels(
                point,
                { width: 1000, height: 600 },
            ),
        ).toEqual({
            x: 250,
            y: 150,
        })

        expect(
            mapUvToRenderedPixels(
                point,
                { width: 2000, height: 1200 },
            ),
        ).toEqual({
            x: 500,
            y: 300,
        })
    })

    it('does not clamp normalized coordinates outside the 0 to 1 range', () => {
        expect(
            mapUvToRenderedPixels(
                { mapU: 1.1, mapV: -0.2 },
                { width: 1000, height: 500 },
            ),
        ).toEqual({
            x: 1100,
            y: 600,
        })
    })

    it('rejects zero or negative rendered dimensions', () => {
        expect(() =>
            mapUvToRenderedPixels(
                { mapU: 0.5, mapV: 0.5 },
                { width: 0, height: 1000 },
            ),
        ).toThrow(RangeError)

        expect(() =>
            mapUvToRenderedPixels(
                { mapU: 0.5, mapV: 0.5 },
                { width: 1000, height: -1 },
            ),
        ).toThrow(RangeError)
    })

    it('rejects non-finite coordinates and dimensions', () => {
        expect(() =>
            mapUvToRenderedPixels(
                { mapU: Number.NaN, mapV: 0.5 },
                squareMap,
            ),
        ).toThrow(RangeError)

        expect(() =>
            mapUvToRenderedPixels(
                { mapU: 0.5, mapV: Number.POSITIVE_INFINITY },
                squareMap,
            ),
        ).toThrow(RangeError)

        expect(() =>
            mapUvToRenderedPixels(
                { mapU: 0.5, mapV: 0.5 },
                { width: Number.POSITIVE_INFINITY, height: 1000 },
            ),
        ).toThrow(RangeError)
    })
})
