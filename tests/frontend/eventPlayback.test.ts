import { describe, expect, it } from 'vitest'

import { isEventVisibleAtTime } from '../../src/playback/eventPlayback'
import type { TelemetryEvent } from '../../src/telemetry/types'

function eventAt(time_seconds: number): TelemetryEvent {
    return {
        time_seconds,
    } as TelemetryEvent
}

describe('time-gated event playback', () => {
    it('hides an event before its timestamp', () => {
        const event = eventAt(100)

        expect(
            isEventVisibleAtTime(event, 99.999),
        ).toBe(false)
    })

    it('shows an event exactly at its timestamp', () => {
        const event = eventAt(100)

        expect(
            isEventVisibleAtTime(event, 100),
        ).toBe(true)
    })

    it('keeps an event visible after its timestamp', () => {
        const event = eventAt(100)

        expect(
            isEventVisibleAtTime(event, 120),
        ).toBe(true)
    })

    it('naturally hides a future event again after reverse seeking', () => {
        const event = eventAt(100)

        expect(
            isEventVisibleAtTime(event, 120),
        ).toBe(true)

        expect(
            isEventVisibleAtTime(event, 80),
        ).toBe(false)
    })

    it('handles an event at match time zero', () => {
        const event = eventAt(0)

        expect(
            isEventVisibleAtTime(event, -0.001),
        ).toBe(false)

        expect(
            isEventVisibleAtTime(event, 0),
        ).toBe(true)
    })

    it('returns false for non-finite playback time', () => {
        const event = eventAt(100)

        expect(
            isEventVisibleAtTime(event, Number.NaN),
        ).toBe(false)

        expect(
            isEventVisibleAtTime(
                event,
                Number.POSITIVE_INFINITY,
            ),
        ).toBe(false)

        expect(
            isEventVisibleAtTime(
                event,
                Number.NEGATIVE_INFINITY,
            ),
        ).toBe(false)
    })

    it('does not mutate the event while checking visibility', () => {
        const event = eventAt(100)
        const originalTime = event.time_seconds

        isEventVisibleAtTime(event, 120)

        expect(event.time_seconds).toBe(originalTime)
    })
})
