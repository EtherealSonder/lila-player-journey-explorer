import { Container } from 'pixi.js'

import {
    VISUALIZATION_LAYER_ORDER,
    type VisualizationLayerName,
} from './layerOrder'

export class VisualizationLayers {
    readonly root = new Container()

    readonly minimap = new Container()
    readonly heatmap = new Container()
    readonly trajectories = new Container()
    readonly participantMarkers = new Container()
    readonly eventMarkers = new Container()
    readonly interaction = new Container()

    private readonly layerMap: Record<
        VisualizationLayerName,
        Container
    >

    constructor() {
        this.root.label = 'visualization-root'

        this.layerMap = {
            minimap: this.minimap,
            heatmap: this.heatmap,
            trajectories: this.trajectories,
            participantMarkers: this.participantMarkers,
            eventMarkers: this.eventMarkers,
            interaction: this.interaction,
        }

        for (const layerName of VISUALIZATION_LAYER_ORDER) {
            const layer = this.layerMap[layerName]

            layer.label = layerName
            this.root.addChild(layer)
        }
    }

    clearTelemetryLayers(): void {
        this.clearContainer(this.heatmap)
        this.clearContainer(this.trajectories)
        this.clearContainer(this.participantMarkers)
        this.clearContainer(this.eventMarkers)
        this.clearContainer(this.interaction)
    }

    clearAll(): void {
        this.clearContainer(this.minimap)
        this.clearTelemetryLayers()
    }

    destroy(): void {
        this.clearAll()
        this.root.destroy()
    }

    private clearContainer(container: Container): void {
        const children = container.removeChildren()

        for (const child of children) {
            child.destroy()
        }
    }
}
