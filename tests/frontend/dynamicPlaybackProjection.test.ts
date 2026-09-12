import { describe, expect, it } from 'vitest'

import { getParticipantPositionAtTime } from '../../src/playback/participantPlayback'
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
        world_x: 99999,
        world_y: -99999,
        world_z: 55555,
        map_u,
        map_v,
    }
}

describe('dynamic playback projection', () => {
    it('projects an interpolated playback point through normalized map coordinates', () => {
        const track: ParticipantTrack = {
            participant_id: 'p1',
            points: [
                point(0, 0.2, 0.25),
                point(10, 0.6, 0.75),
            ],
        }

        const interpolated =
            getParticipantPositionAtTime(
                track,
                5,
            )

        expect(interpolated).not.toBeNull()

        const projected =
            projectTelemetryPoint(
                interpolated!,
                {
                    x: 100,
                    y: 50,
                    width: 1000,
                    height: 500,
                },
            )

        expect(projected.x).toBe(500)
        expect(projected.y).toBe(300)
    })
})
