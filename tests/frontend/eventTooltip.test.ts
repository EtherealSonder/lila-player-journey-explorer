import { describe, expect, it } from 'vitest'

import {
    buildEventTooltipModel,
    formatElapsedTime,
} from '../../src/visualization/events/eventTooltip'
import type { TelemetryEvent } from '../../src/telemetry/types'

function makeEvent(
    overrides: Partial<TelemetryEvent> = {},
): TelemetryEvent {
    return {
        time_seconds: 125,
        type: 'kill',
        participant_id: 'participant-1',
        participant_category: 'human',
        owner_role: 'killer',
        world_x: 0,
        world_y: 0,
        world_z: 0,
        map_u: 0.5,
        map_v: 0.5,
        source_category: 'human',
        target_category: 'bot',
        metadata: {},
        ...overrides,
    }
}

describe('event tooltip model', () => {
    it('formats elapsed time as minutes and seconds', () => {
        expect(formatElapsedTime(125)).toBe('2:05')
    })

    it('uses normalized event fields without reinterpretation', () => {
        expect(
            buildEventTooltipModel(makeEvent()),
        ).toMatchObject({
            title: 'Kill',
            elapsedTime: '2:05',
            participantId: 'participant-1',
            participantCategory: 'human',
            ownerRole: 'killer',
            sourceCategory: 'human',
            targetCategory: 'bot',
        })
    })

    it('maps storm_death to a readable title', () => {
        expect(
            buildEventTooltipModel(
                makeEvent({
                    type: 'storm_death',
                }),
            ).title,
        ).toBe('Storm death')
    })

    it('includes only primitive metadata values', () => {
        const model = buildEventTooltipModel(
            makeEvent({
                metadata: {
                    item: 'rifle',
                    amount: 2,
                    valid: true,
                    nested: {
                        ignored: true,
                    },
                },
            }),
        )

        expect(model.metadata).toEqual([
            { key: 'item', value: 'rifle' },
            { key: 'amount', value: '2' },
            { key: 'valid', value: 'true' },
        ])
    })

    it('limits metadata to three compact entries', () => {
        const model = buildEventTooltipModel(
            makeEvent({
                metadata: {
                    a: 1,
                    b: 2,
                    c: 3,
                    d: 4,
                },
            }),
        )

        expect(model.metadata).toHaveLength(3)
    })
})
