import { describe, expect, it } from 'vitest'

import { getParticipantPositionAtTime } from '../../src/playback/participantPlayback'
import { getVisibleTrackAtTime } from '../../src/playback/visibleTrack'
import type {
    ParticipantTrack,
    TelemetryPoint,
} from '../../src/telemetry/types'

function point(
    time_seconds: number,
    map_u: number,
    map_v: number,
): TelemetryPoint {
    return {
        time_seconds,
        world_x: map_u * 100,
        world_y: 0,
        world_z: map_v * 100,
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

describe('progressive trajectory geometry', () => {
    it('returns no visible trajectory before the track starts', () => {
        const participantTrack = track([
            point(10, 0.1, 0.2),
            point(20, 0.3, 0.4),
        ])

        expect(
            getVisibleTrackAtTime(
                participantTrack,
                5,
            ),
        ).toEqual([])
    })

    it('returns exactly the first point at the first sample time', () => {
        const first = point(10, 0.1, 0.2)
        const participantTrack = track([
            first,
            point(20, 0.3, 0.4),
        ])

        expect(
            getVisibleTrackAtTime(
                participantTrack,
                10,
            ),
        ).toEqual([first])
    })

    it('returns all completed samples through an exact middle sample', () => {
        const first = point(10, 0.1, 0.2)
        const middle = point(20, 0.3, 0.4)
        const participantTrack = track([
            first,
            middle,
            point(30, 0.5, 0.6),
        ])

        expect(
            getVisibleTrackAtTime(
                participantTrack,
                20,
            ),
        ).toEqual([
            first,
            middle,
        ])
    })

    it('includes an interpolated endpoint between adjacent samples', () => {
        const first = point(10, 0.1, 0.2)
        const middle = point(20, 0.3, 0.4)
        const participantTrack = track([
            first,
            middle,
            point(30, 0.7, 0.8),
        ])

        const visible = getVisibleTrackAtTime(
            participantTrack,
            25,
        )

        expect(visible).toHaveLength(3)
        expect(visible[0]).toBe(first)
        expect(visible[1]).toBe(middle)
        expect(visible[2].time_seconds).toBe(25)
        expect(visible[2].map_u).toBeCloseTo(0.5)
        expect(visible[2].map_v).toBeCloseTo(0.6)
    })

    it('keeps the trajectory tip aligned with the participant position', () => {
        const participantTrack = track([
            point(10, 0.1, 0.2),
            point(20, 0.3, 0.4),
            point(30, 0.7, 0.8),
        ])

        const visible = getVisibleTrackAtTime(
            participantTrack,
            25,
        )
        const participantPosition =
            getParticipantPositionAtTime(
                participantTrack,
                25,
            )

        expect(participantPosition).not.toBeNull()
        expect(
            visible[visible.length - 1],
        ).toEqual(participantPosition)
    })

    it('returns the complete track at the final sample time', () => {
        const points = [
            point(10, 0.1, 0.2),
            point(20, 0.3, 0.4),
            point(30, 0.5, 0.6),
        ]
        const participantTrack = track(points)

        expect(
            getVisibleTrackAtTime(
                participantTrack,
                30,
            ),
        ).toEqual(points)
    })

    it('returns the complete recorded track after the final sample', () => {
        const points = [
            point(10, 0.1, 0.2),
            point(20, 0.3, 0.4),
            point(30, 0.5, 0.6),
        ]
        const participantTrack = track(points)

        const visible = getVisibleTrackAtTime(
            participantTrack,
            60,
        )

        expect(visible).toEqual(points)
        expect(visible).not.toBe(points)
    })

    it('handles a one-point track', () => {
        const onlyPoint = point(10, 0.25, 0.75)
        const participantTrack = track([onlyPoint])

        expect(
            getVisibleTrackAtTime(
                participantTrack,
                5,
            ),
        ).toEqual([])

        expect(
            getVisibleTrackAtTime(
                participantTrack,
                10,
            ),
        ).toEqual([onlyPoint])

        expect(
            getVisibleTrackAtTime(
                participantTrack,
                50,
            ),
        ).toEqual([onlyPoint])
    })

    it('returns an empty trajectory for an empty track', () => {
        expect(
            getVisibleTrackAtTime(
                track([]),
                20,
            ),
        ).toEqual([])
    })

    it('returns an empty trajectory for non-finite playback time', () => {
        const participantTrack = track([
            point(10, 0.1, 0.2),
            point(20, 0.3, 0.4),
        ])

        expect(
            getVisibleTrackAtTime(
                participantTrack,
                Number.NaN,
            ),
        ).toEqual([])

        expect(
            getVisibleTrackAtTime(
                participantTrack,
                Number.POSITIVE_INFINITY,
            ),
        ).toEqual([])
    })
})
