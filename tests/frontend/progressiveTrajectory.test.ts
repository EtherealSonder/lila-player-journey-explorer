import { describe, expect, it } from 'vitest'

import { getParticipantPositionAtTime } from '../../src/playback/participantPlayback'
import { getVisibleTrackAtTime } from '../../src/playback/visibleTrack'
import { projectTelemetryPoint } from '../../src/visualization/trajectories/trajectoryGeometry'
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

const track: ParticipantTrack = {
    participant_id: 'p1',
    points: [
        point(10, 0.1, 0.2),
        point(20, 0.5, 0.6),
        point(40, 0.9, 0.8),
    ],
}

const mapRect = {
    x: 50,
    y: 25,
    width: 1000,
    height: 500,
}

describe('progressive trajectory playback', () => {
    it('is empty before the participant starts', () => {
        expect(
            getVisibleTrackAtTime(track, 9.99),
        ).toEqual([])
    })

    it('contains the exact sample at an exact timestamp', () => {
        const visible =
            getVisibleTrackAtTime(track, 20)

        expect(visible).toEqual(
            track.points.slice(0, 2),
        )
    })

    it('uses an interpolated trajectory tip between samples', () => {
        const visible =
            getVisibleTrackAtTime(track, 30)
        const marker =
            getParticipantPositionAtTime(
                track,
                30,
            )

        expect(marker).not.toBeNull()
        expect(visible.at(-1)).toEqual(marker)
    })

    it('keeps the trajectory tip and marker aligned after projection', () => {
        const currentTime = 30
        const visible =
            getVisibleTrackAtTime(
                track,
                currentTime,
            )
        const marker =
            getParticipantPositionAtTime(
                track,
                currentTime,
            )

        expect(marker).not.toBeNull()

        const projectedTip =
            projectTelemetryPoint(
                visible.at(-1)!,
                mapRect,
            )
        const projectedMarker =
            projectTelemetryPoint(
                marker!,
                mapRect,
            )

        expect(projectedTip).toEqual(
            projectedMarker,
        )
    })

    it('returns the complete historical track after the final sample', () => {
        expect(
            getVisibleTrackAtTime(track, 100),
        ).toEqual(track.points)
    })
})
