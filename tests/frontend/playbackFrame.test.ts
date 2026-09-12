import { describe, expect, it } from 'vitest'

import { getFrameDeltaSeconds } from '../../src/playback/playbackFrame'

describe('requestAnimationFrame playback timing', () => {
    it('returns zero for the first frame because there is no previous timestamp', () => {
        expect(
            getFrameDeltaSeconds(null, 1000),
        ).toBe(0)
    })

    it('converts RAF milliseconds to elapsed seconds', () => {
        expect(
            getFrameDeltaSeconds(1000, 1016.6667),
        ).toBeCloseTo(0.0166667)
    })

    it('uses actual timestamps rather than assuming a fixed refresh rate', () => {
        const sixtyHz =
            getFrameDeltaSeconds(
                1000,
                1016.6667,
            )
        const oneTwentyHz =
            getFrameDeltaSeconds(
                1000,
                1008.3333,
            )

        expect(sixtyHz).toBeCloseTo(
            0.0166667,
        )
        expect(oneTwentyHz).toBeCloseTo(
            0.0083333,
        )
        expect(sixtyHz).toBeGreaterThan(
            oneTwentyHz,
        )
    })

    it('supports long frames using their real elapsed duration', () => {
        expect(
            getFrameDeltaSeconds(
                1000,
                1250,
            ),
        ).toBeCloseTo(0.25)
    })

    it('does not advance on equal or backwards timestamps', () => {
        expect(
            getFrameDeltaSeconds(
                1000,
                1000,
            ),
        ).toBe(0)

        expect(
            getFrameDeltaSeconds(
                1000,
                900,
            ),
        ).toBe(0)
    })

    it('does not advance for non-finite timestamps', () => {
        expect(
            getFrameDeltaSeconds(
                Number.NaN,
                1000,
            ),
        ).toBe(0)

        expect(
            getFrameDeltaSeconds(
                1000,
                Number.POSITIVE_INFINITY,
            ),
        ).toBe(0)
    })
})
