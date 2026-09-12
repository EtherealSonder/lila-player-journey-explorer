import { describe, expect, it } from 'vitest'

import {
    projectParticipantTrack,
    projectTelemetryPoint,
} from '../../src/visualization/trajectories/trajectoryGeometry'
import type {
    ParticipantTrack,
    TelemetryPoint,
} from '../../src/telemetry/types'

const basePoint: TelemetryPoint = {
    time_seconds: 0,
    world_x: 0,
    world_y: 0,
    world_z: 0,
    map_u: 0,
    map_v: 0,
}

describe('trajectory geometry', () => {
    it('projects normalized telemetry into the rendered minimap rectangle', () => {
        expect(
            projectTelemetryPoint(
                {
                    ...basePoint,
                    map_u: 0.25,
                    map_v: 0.75,
                },
                {
                    x: 100,
                    y: 50,
                    width: 800,
                    height: 600,
                },
            ),
        ).toEqual({
            x: 300,
            y: 200,
        })
    })

    it('uses the locked Phase 3 Flip Y transform', () => {
        expect(
            projectTelemetryPoint(
                {
                    ...basePoint,
                    map_u: 0,
                    map_v: 0,
                },
                {
                    x: 25,
                    y: 40,
                    width: 400,
                    height: 300,
                },
            ),
        ).toEqual({
            x: 25,
            y: 340,
        })

        expect(
            projectTelemetryPoint(
                {
                    ...basePoint,
                    map_u: 1,
                    map_v: 1,
                },
                {
                    x: 25,
                    y: 40,
                    width: 400,
                    height: 300,
                },
            ),
        ).toEqual({
            x: 425,
            y: 40,
        })
    })

    it('preserves track point order during projection', () => {
        const track: ParticipantTrack = {
            participant_id: 'human-1',
            points: [
                {
                    ...basePoint,
                    time_seconds: 1,
                    map_u: 0.1,
                    map_v: 0.9,
                },
                {
                    ...basePoint,
                    time_seconds: 2,
                    map_u: 0.5,
                    map_v: 0.5,
                },
                {
                    ...basePoint,
                    time_seconds: 3,
                    map_u: 0.9,
                    map_v: 0.1,
                },
            ],
        }

        const projected = projectParticipantTrack(
            track,
            {
                x: 0,
                y: 0,
                width: 1000,
                height: 500,
            },
        )

        expect(projected).toHaveLength(3)

        expect(projected[0]?.x).toBeCloseTo(100)
        expect(projected[0]?.y).toBeCloseTo(50)

        expect(projected[1]?.x).toBeCloseTo(500)
        expect(projected[1]?.y).toBeCloseTo(250)

        expect(projected[2]?.x).toBeCloseTo(900)
        expect(projected[2]?.y).toBeCloseTo(450)
    })

    it('keeps Grand Rift width and height independent', () => {
        expect(
            projectTelemetryPoint(
                {
                    ...basePoint,
                    map_u: 0.5,
                    map_v: 0.25,
                },
                {
                    x: 10,
                    y: 20,
                    width: 2160,
                    height: 2158,
                },
            ),
        ).toEqual({
            x: 1090,
            y: 1638.5,
        })
    })
})