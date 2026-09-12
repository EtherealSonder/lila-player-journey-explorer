import { describe, expect, it } from 'vitest'

import { formatPlaybackTime } from '../../src/playback/playbackFormatting'

describe('playback time formatting', () => {
    it('formats zero as 0:00', () => {
        expect(formatPlaybackTime(0)).toBe('0:00')
    })

    it('floors subsecond playback time for display', () => {
        expect(
            formatPlaybackTime(65.8),
        ).toBe('1:05')
    })

    it('formats values below one minute', () => {
        expect(formatPlaybackTime(9.99)).toBe('0:09')
        expect(formatPlaybackTime(59.99)).toBe('0:59')
    })

    it('formats exact minute boundaries', () => {
        expect(formatPlaybackTime(60)).toBe('1:00')
        expect(formatPlaybackTime(600)).toBe('10:00')
    })

    it('supports long match durations', () => {
        expect(formatPlaybackTime(890)).toBe('14:50')
    })

    it('treats invalid and negative values as zero', () => {
        expect(formatPlaybackTime(-1)).toBe('0:00')
        expect(formatPlaybackTime(Number.NaN)).toBe('0:00')
        expect(
            formatPlaybackTime(
                Number.POSITIVE_INFINITY,
            ),
        ).toBe('0:00')
    })
})
