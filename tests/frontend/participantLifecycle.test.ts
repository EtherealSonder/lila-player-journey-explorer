import { describe, expect, it } from 'vitest'

import {
    getParticipantDeathTime,
    getParticipantLifecycleAtTime,
} from '../../src/playback/participantLifecycle'
import type {
    ParticipantTrack,
    TelemetryEvent,
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

function track(
    points: TelemetryPoint[],
    participantId = 'participant-1',
): ParticipantTrack {
    return {
        participant_id: participantId,
        points,
    }
}

function event(
    overrides: Partial<TelemetryEvent> = {},
): TelemetryEvent {
    return {
        time_seconds: 50,
        type: 'death',
        participant_id: 'participant-1',
        participant_category: 'human',
        owner_role: 'victim',
        world_x: 0,
        world_y: 0,
        world_z: 0,
        map_u: 0.5,
        map_v: 0.5,
        source_category: 'bot',
        target_category: 'human',
        metadata: {},
        ...overrides,
    }
}

describe('participant lifecycle policy', () => {
    it('hides a participant before its first recorded sample', () => {
        const snapshot = getParticipantLifecycleAtTime(
            track([
                point(42, 0.2, 0.3),
                point(50, 0.4, 0.5),
            ]),
            [],
            20,
        )

        expect(snapshot).toEqual({
            status: 'not_started',
            visible: false,
            position: null,
        })
    })

    it('shows a participant as active at its first sample', () => {
        const first = point(42, 0.2, 0.3)

        const snapshot = getParticipantLifecycleAtTime(
            track([first, point(50, 0.4, 0.5)]),
            [],
            42,
        )

        expect(snapshot.status).toBe('active')
        expect(snapshot.visible).toBe(true)
        expect(snapshot.position).toBe(first)
    })

    it('uses adjacent-sample interpolation while active', () => {
        const snapshot = getParticipantLifecycleAtTime(
            track([
                point(10, 0.2, 0.4),
                point(20, 0.6, 0.8),
            ]),
            [],
            15,
        )

        expect(snapshot.status).toBe('active')
        expect(snapshot.visible).toBe(true)
        expect(snapshot.position?.map_u).toBeCloseTo(0.4)
        expect(snapshot.position?.map_v).toBeCloseTo(0.6)
    })

    it('still interpolates across a sparse sample gap without inventing samples outside it', () => {
        const snapshot = getParticipantLifecycleAtTime(
            track([
                point(10, 0.1, 0.2),
                point(110, 0.9, 0.8),
            ]),
            [],
            60,
        )

        expect(snapshot.status).toBe('active')
        expect(snapshot.position?.time_seconds).toBe(60)
        expect(snapshot.position?.map_u).toBeCloseTo(0.5)
        expect(snapshot.position?.map_v).toBeCloseTo(0.5)
    })

    it('keeps the final known position after a track ends when there is no death', () => {
        const final = point(30, 0.7, 0.8)

        const snapshot = getParticipantLifecycleAtTime(
            track([
                point(10, 0.2, 0.3),
                final,
            ]),
            [],
            80,
        )

        expect(snapshot.status).toBe('last_known')
        expect(snapshot.visible).toBe(true)
        expect(snapshot.position).toBe(final)
        expect(snapshot.position?.time_seconds).toBe(30)
    })

    it('hides a participant exactly when its victim-side death event is reached', () => {
        const snapshot = getParticipantLifecycleAtTime(
            track([
                point(10, 0.2, 0.3),
                point(80, 0.7, 0.8),
            ]),
            [event({ time_seconds: 50 })],
            50,
        )

        expect(snapshot).toEqual({
            status: 'dead',
            visible: false,
            position: null,
        })
    })

    it('hides a participant after death even if later track samples exist', () => {
        const snapshot = getParticipantLifecycleAtTime(
            track([
                point(10, 0.2, 0.3),
                point(80, 0.7, 0.8),
            ]),
            [event({ time_seconds: 50 })],
            70,
        )

        expect(snapshot.status).toBe('dead')
        expect(snapshot.visible).toBe(false)
        expect(snapshot.position).toBeNull()
    })

    it('treats storm death as a lifecycle-ending victim event', () => {
        const snapshot = getParticipantLifecycleAtTime(
            track([
                point(10, 0.2, 0.3),
                point(80, 0.7, 0.8),
            ]),
            [
                event({
                    type: 'storm_death',
                    time_seconds: 45,
                }),
            ],
            45,
        )

        expect(snapshot.status).toBe('dead')
        expect(snapshot.visible).toBe(false)
    })

    it('does not treat killer-side or ordinary participant events as death', () => {
        const final = point(30, 0.7, 0.8)
        const events = [
            event({
                type: 'kill',
                owner_role: 'killer',
                time_seconds: 20,
            }),
            event({
                type: 'loot',
                owner_role: 'participant',
                time_seconds: 25,
            }),
        ]

        const snapshot = getParticipantLifecycleAtTime(
            track([
                point(10, 0.2, 0.3),
                final,
            ]),
            events,
            80,
        )

        expect(snapshot.status).toBe('last_known')
        expect(snapshot.visible).toBe(true)
        expect(snapshot.position).toBe(final)
    })

    it('ignores death events that belong to another participant', () => {
        const final = point(30, 0.7, 0.8)
        const snapshot = getParticipantLifecycleAtTime(
            track([
                point(10, 0.2, 0.3),
                final,
            ]),
            [
                event({
                    participant_id: 'participant-2',
                    time_seconds: 20,
                }),
            ],
            80,
        )

        expect(snapshot.status).toBe('last_known')
        expect(snapshot.position).toBe(final)
    })

    it('uses the earliest valid victim-side death event if more than one exists', () => {
        const deathTime = getParticipantDeathTime(
            'participant-1',
            [
                event({ time_seconds: 70 }),
                event({
                    type: 'storm_death',
                    time_seconds: 55,
                }),
                event({
                    type: 'kill',
                    owner_role: 'killer',
                    time_seconds: 20,
                }),
            ],
        )

        expect(deathTime).toBe(55)
    })

    it('reports no death when no lifecycle-ending event exists', () => {
        expect(
            getParticipantDeathTime(
                'participant-1',
                [
                    event({
                        type: 'kill',
                        owner_role: 'killer',
                    }),
                    event({
                        type: 'loot',
                        owner_role: 'participant',
                    }),
                ],
            ),
        ).toBeNull()
    })

    it('returns unavailable for an empty track', () => {
        expect(
            getParticipantLifecycleAtTime(
                track([]),
                [],
                10,
            ),
        ).toEqual({
            status: 'unavailable',
            visible: false,
            position: null,
        })
    })

    it('returns unavailable for non-finite playback time', () => {
        const participantTrack = track([
            point(10, 0.2, 0.3),
            point(20, 0.4, 0.5),
        ])

        expect(
            getParticipantLifecycleAtTime(
                participantTrack,
                [],
                Number.NaN,
            ).status,
        ).toBe('unavailable')
    })
})
