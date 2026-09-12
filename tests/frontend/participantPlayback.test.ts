import { describe, expect, it } from 'vitest'

import { getParticipantPositionAtTime } from '../../src/playback/participantPlayback'
import type {
    ParticipantTrack,
    TelemetryPoint,
} from '../../src/telemetry/types'

function point(
    time_seconds: number,
    map_u: number,
    map_v: number,
    world_x = map_u * 100,
    world_y = 0,
    world_z = map_v * 100,
): TelemetryPoint {
    return {
        time_seconds,
        world_x,
        world_y,
        world_z,
        map_u,
        map_v,
    }
}

function track(points: TelemetryPoint[]): ParticipantTrack {
    return {
        participant_id: 'participant-1',
        points,
    }
}

describe('participant playback interpolation', () => {
    it('returns no position before the first sample', () => {
        const participantTrack = track([
            point(42, 0.2, 0.3),
            point(50, 0.4, 0.5),
        ])

        expect(
            getParticipantPositionAtTime(
                participantTrack,
                20,
            ),
        ).toBeNull()
    })

    it('returns the exact first sample at its timestamp', () => {
        const first = point(42, 0.2, 0.3)
        const participantTrack = track([
            first,
            point(50, 0.4, 0.5),
        ])

        expect(
            getParticipantPositionAtTime(
                participantTrack,
                42,
            ),
        ).toBe(first)
    })

    it('returns the exact middle sample at its timestamp', () => {
        const middle = point(50, 0.4, 0.5)
        const participantTrack = track([
            point(42, 0.2, 0.3),
            middle,
            point(60, 0.8, 0.9),
        ])

        expect(
            getParticipantPositionAtTime(
                participantTrack,
                50,
            ),
        ).toBe(middle)
    })

    it('interpolates normalized map coordinates between adjacent samples', () => {
        const participantTrack = track([
            point(10, 0.2, 0.4),
            point(20, 0.6, 0.8),
        ])

        const result = getParticipantPositionAtTime(
            participantTrack,
            15,
        )

        expect(result).not.toBeNull()
        expect(result?.time_seconds).toBe(15)
        expect(result?.map_u).toBeCloseTo(0.4)
        expect(result?.map_v).toBeCloseTo(0.6)
    })

    it('interpolates world coordinates consistently with normalized map coordinates', () => {
        const participantTrack = track([
            point(10, 0.2, 0.4, 100, 10, 200),
            point(20, 0.6, 0.8, 300, 30, 600),
        ])

        const result = getParticipantPositionAtTime(
            participantTrack,
            15,
        )

        expect(result?.world_x).toBeCloseTo(200)
        expect(result?.world_y).toBeCloseTo(20)
        expect(result?.world_z).toBeCloseTo(400)
    })

    it('uses the correct interpolation fraction when current time is not halfway', () => {
        const participantTrack = track([
            point(10, 0.2, 0.4),
            point(20, 0.6, 0.8),
        ])

        const result = getParticipantPositionAtTime(
            participantTrack,
            12.5,
        )

        expect(result?.map_u).toBeCloseTo(0.3)
        expect(result?.map_v).toBeCloseTo(0.5)
    })

    it('returns the exact final sample at its timestamp', () => {
        const final = point(130, 0.7, 0.9)
        const participantTrack = track([
            point(100, 0.3, 0.4),
            final,
        ])

        expect(
            getParticipantPositionAtTime(
                participantTrack,
                130,
            ),
        ).toBe(final)
    })

    it('returns the final recorded sample after the track ends without extrapolating', () => {
        const final = point(130, 0.7, 0.9)
        const participantTrack = track([
            point(100, 0.3, 0.4),
            final,
        ])

        const result = getParticipantPositionAtTime(
            participantTrack,
            150,
        )

        expect(result).toBe(final)
        expect(result?.map_u).toBe(0.7)
        expect(result?.map_v).toBe(0.9)
        expect(result?.time_seconds).toBe(130)
    })

    it('handles a single-point track', () => {
        const onlyPoint = point(25, 0.25, 0.75)
        const participantTrack = track([onlyPoint])

        expect(
            getParticipantPositionAtTime(
                participantTrack,
                20,
            ),
        ).toBeNull()

        expect(
            getParticipantPositionAtTime(
                participantTrack,
                25,
            ),
        ).toBe(onlyPoint)

        expect(
            getParticipantPositionAtTime(
                participantTrack,
                50,
            ),
        ).toBe(onlyPoint)
    })

    it('returns no position for an empty track', () => {
        expect(
            getParticipantPositionAtTime(
                track([]),
                20,
            ),
        ).toBeNull()
    })

    it('returns no position for a non-finite current time', () => {
        const participantTrack = track([
            point(10, 0.2, 0.4),
            point(20, 0.6, 0.8),
        ])

        expect(
            getParticipantPositionAtTime(
                participantTrack,
                Number.NaN,
            ),
        ).toBeNull()

        expect(
            getParticipantPositionAtTime(
                participantTrack,
                Number.POSITIVE_INFINITY,
            ),
        ).toBeNull()
    })
})
