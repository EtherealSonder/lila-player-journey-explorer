import { describe, expect, it } from 'vitest'

import { EVENT_MARKER_DEFINITIONS } from '../../src/visualization/events/eventMarkerDefinitions'

describe('event marker definitions', () => {
    it('defines all four normalized event types', () => {
        expect(Object.keys(EVENT_MARKER_DEFINITIONS).sort()).toEqual([
            'death',
            'kill',
            'loot',
            'storm_death',
        ])
    })

    it('uses a distinct marker shape for every event type', () => {
        const shapes = Object.values(
            EVENT_MARKER_DEFINITIONS,
        ).map((definition) => definition.shape)

        expect(new Set(shapes).size).toBe(4)
    })

    it('keeps all markers compact', () => {
        for (const definition of Object.values(
            EVENT_MARKER_DEFINITIONS,
        )) {
            expect(definition.size).toBeGreaterThanOrEqual(4)
            expect(definition.size).toBeLessThanOrEqual(6)
        }
    })
})
