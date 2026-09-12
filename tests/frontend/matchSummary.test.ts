import { describe, expect, it } from 'vitest'

import {
    formatMatchDuration,
    getTotalEventCount,
} from '../../src/telemetry/matchSummary'

describe('match summary helpers', () => {
    it('formats duration as compact minutes and seconds', () => {
        expect(formatMatchDuration(599)).toBe('9:59')
        expect(formatMatchDuration(252)).toBe('4:12')
    })

    it('rounds fractional duration seconds', () => {
        expect(formatMatchDuration(61.6)).toBe('1:02')
    })

    it('clamps negative duration to zero', () => {
        expect(formatMatchDuration(-10)).toBe('0:00')
    })

    it('totals all normalized event categories', () => {
        expect(
            getTotalEventCount({
                kill: 4,
                death: 6,
                storm_death: 2,
                loot: 15,
            }),
        ).toBe(27)
    })
})
