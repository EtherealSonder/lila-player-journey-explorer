import { describe, expect, it } from 'vitest'

import {
    projectTelemetryEvent,
    projectTelemetryEvents,
} from '../../src/visualization/events/eventMarkerGeometry'
import type { TelemetryEvent } from '../../src/telemetry/types'

function makeEvent(
    overrides: Partial<TelemetryEvent> = {},
): TelemetryEvent {
    return {
        time_seconds: 10,
        type: 'kill',
        participant_id: 'human-1',
        participant_category: 'human',
        owner_role: 'killer',
        world_x: 0,
        world_y: 0,
        world_z: 0,
        map_u: 0.25,
        map_v: 0.75,
        source_category: 'human',
        target_category: 'bot',
        metadata: {},
        ...overrides,
    }
}

describe('event marker geometry', () => {
    it('projects a normalized event into the rendered minimap rectangle', () => {
        const projected = projectTelemetryEvent(
            makeEvent(),
            {
                x: 100,
                y: 50,
                width: 800,
                height: 600,
            },
        )

        expect(projected.x).toBeCloseTo(300)
        expect(projected.y).toBeCloseTo(200)
    })

    it('uses the locked Phase 3 Flip Y transform', () => {
        const projected = projectTelemetryEvent(
            makeEvent({
                map_u: 1,
                map_v: 1,
            }),
            {
                x: 25,
                y: 40,
                width: 400,
                height: 300,
            },
        )

        expect(projected.x).toBeCloseTo(425)
        expect(projected.y).toBeCloseTo(40)
    })

    it('preserves the original event record', () => {
        const event = makeEvent({
            type: 'loot',
            participant_id: 'participant-2',
        })

        const projected = projectTelemetryEvent(
            event,
            {
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            },
        )

        expect(projected.event).toBe(event)
    })

    it('preserves event order when projecting a full event list', () => {
        const events = [
            makeEvent({ type: 'kill', time_seconds: 3 }),
            makeEvent({ type: 'death', time_seconds: 7 }),
            makeEvent({ type: 'loot', time_seconds: 9 }),
            makeEvent({
                type: 'storm_death',
                time_seconds: 12,
            }),
        ]

        const projected = projectTelemetryEvents(
            events,
            {
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            },
        )

        expect(
            projected.map((item) => item.event.type),
        ).toEqual([
            'kill',
            'death',
            'loot',
            'storm_death',
        ])
    })
})
