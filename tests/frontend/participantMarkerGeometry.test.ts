import { describe, expect, it } from 'vitest'

import {
    getFinalTrackPoint,
    projectFinalParticipantPoint,
} from '../../src/visualization/participants/participantMarkerGeometry'
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

describe('participant marker geometry', () => {
    it('returns the final telemetry point from a participant track', () => {
        const track: ParticipantTrack = {
            participant_id: 'human-1',
            points: [
                {
                    ...basePoint,
                    time_seconds: 2,
                    map_u: 0.2,
                    map_v: 0.8,
                },
                {
                    ...basePoint,
                    time_seconds: 7,
                    map_u: 0.7,
                    map_v: 0.3,
                },
            ],
        }

        expect(getFinalTrackPoint(track)).toEqual(
            track.points[1],
        )
    })

    it('returns null for an empty track', () => {
        const track: ParticipantTrack = {
            participant_id: 'human-1',
            points: [],
        }

        expect(getFinalTrackPoint(track)).toBeNull()
    })

    it('projects the final point using the shared trajectory transform', () => {
        const track: ParticipantTrack = {
            participant_id: 'bot-1',
            points: [
                {
                    ...basePoint,
                    time_seconds: 3,
                    map_u: 0.1,
                    map_v: 0.9,
                },
                {
                    ...basePoint,
                    time_seconds: 10,
                    map_u: 0.75,
                    map_v: 0.25,
                },
            ],
        }

        const result = projectFinalParticipantPoint(
            track,
            {
                x: 100,
                y: 50,
                width: 800,
                height: 600,
            },
        )

        expect(result).not.toBeNull()
        expect(result?.participantId).toBe('bot-1')
        expect(result?.telemetryPoint.time_seconds).toBe(10)
        expect(result?.viewportPoint.x).toBeCloseTo(700)
        expect(result?.viewportPoint.y).toBeCloseTo(500)
    })

    it('preserves the Phase 3 Flip Y orientation for final markers', () => {
        const track: ParticipantTrack = {
            participant_id: 'human-2',
            points: [
                {
                    ...basePoint,
                    map_u: 0.5,
                    map_v: 1,
                },
            ],
        }

        const result = projectFinalParticipantPoint(
            track,
            {
                x: 20,
                y: 30,
                width: 400,
                height: 300,
            },
        )

        expect(result?.viewportPoint.x).toBeCloseTo(220)
        expect(result?.viewportPoint.y).toBeCloseTo(30)
    })
})
