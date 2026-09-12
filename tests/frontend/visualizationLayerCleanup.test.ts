import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'

import { VisualizationLayers } from '../../src/visualization/layers/VisualizationLayers'

function addLabeledChild(
    parent: Container,
    label: string,
): void {
    const child = new Container()
    child.label = label
    parent.addChild(child)
}

describe('visualization layer cleanup regression', () => {
    it('clears telemetry layers without removing the minimap', () => {
        const layers = new VisualizationLayers()

        addLabeledChild(layers.minimap, 'map')
        addLabeledChild(layers.heatmap, 'heatmap-a')
        addLabeledChild(layers.trajectories, 'track-a')
        addLabeledChild(
            layers.participantMarkers,
            'participant-a',
        )
        addLabeledChild(
            layers.eventMarkers,
            'event-a',
        )
        addLabeledChild(
            layers.interaction,
            'interaction-a',
        )

        layers.clearTelemetryLayers()

        expect(layers.minimap.children).toHaveLength(1)
        expect(layers.heatmap.children).toHaveLength(0)
        expect(layers.trajectories.children).toHaveLength(0)
        expect(
            layers.participantMarkers.children,
        ).toHaveLength(0)
        expect(layers.eventMarkers.children).toHaveLength(0)
        expect(layers.interaction.children).toHaveLength(0)

        layers.destroy()
    })

    it('supports clean match replacement without stale telemetry objects', () => {
        const layers = new VisualizationLayers()

        addLabeledChild(
            layers.trajectories,
            'match-a-track',
        )
        addLabeledChild(
            layers.participantMarkers,
            'match-a-participant',
        )
        addLabeledChild(
            layers.eventMarkers,
            'match-a-event',
        )

        layers.clearTelemetryLayers()

        addLabeledChild(
            layers.trajectories,
            'match-b-track',
        )
        addLabeledChild(
            layers.participantMarkers,
            'match-b-participant',
        )
        addLabeledChild(
            layers.eventMarkers,
            'match-b-event',
        )

        expect(
            layers.trajectories.children.map(
                (child) => child.label,
            ),
        ).toEqual(['match-b-track'])

        expect(
            layers.participantMarkers.children.map(
                (child) => child.label,
            ),
        ).toEqual(['match-b-participant'])

        expect(
            layers.eventMarkers.children.map(
                (child) => child.label,
            ),
        ).toEqual(['match-b-event'])

        layers.destroy()
    })

    it('clearAll also removes the minimap when the whole viewport is reset', () => {
        const layers = new VisualizationLayers()

        addLabeledChild(layers.minimap, 'map')
        addLabeledChild(
            layers.trajectories,
            'track',
        )

        layers.clearAll()

        expect(layers.minimap.children).toHaveLength(0)
        expect(layers.trajectories.children).toHaveLength(0)

        layers.destroy()
    })
})
