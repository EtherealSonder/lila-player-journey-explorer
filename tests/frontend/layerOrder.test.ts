import { describe, expect, it } from 'vitest'

import { VISUALIZATION_LAYER_ORDER } from '../../src/visualization/layers/layerOrder'

describe('visualization layer order', () => {
    it('keeps the production PixiJS layers in the required draw order', () => {
        expect(VISUALIZATION_LAYER_ORDER).toEqual([
            'minimap',
            'heatmap',
            'trajectories',
            'participantMarkers',
            'eventMarkers',
            'interaction',
        ])
    })

    it('keeps the minimap below all telemetry layers', () => {
        expect(VISUALIZATION_LAYER_ORDER[0]).toBe('minimap')
    })

    it('keeps interaction above every visual telemetry layer', () => {
        expect(
            VISUALIZATION_LAYER_ORDER[
            VISUALIZATION_LAYER_ORDER.length - 1
            ],
        ).toBe('interaction')
    })
})
