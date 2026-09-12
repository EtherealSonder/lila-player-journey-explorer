import {
    Container,
    Graphics,
    type FederatedPointerEvent,
} from 'pixi.js'

import type { MapRenderRect } from '../../map/mapGeometry'
import { isEventVisibleAtTime } from '../../playback/eventPlayback'
import type {
    MatchData,
    TelemetryEvent,
} from '../../telemetry/types'
import {
    EVENT_MARKER_DEFINITIONS,
    type EventMarkerDefinition,
} from './eventMarkerDefinitions'
import {
    isEventTypeVisible,
    type VisualizationVisibility,
} from '../visibility'
import { projectTelemetryEvent } from './eventMarkerGeometry'

export interface EventMarkerHover {
    matchId: string
    event: TelemetryEvent
    x: number
    y: number
}

export type EventMarkerHoverHandler = (
    hover: EventMarkerHover | null,
) => void

interface EventMarkerEntry {
    event: TelemetryEvent
    marker: Container
}

/**
 * Playback-aware retained event renderer.
 *
 * Every normalized event marker is created once for the active match. Playback
 * and sidebar filters only change marker.visible and eventMode.
 */
export class EventMarkerRenderer {
    private readonly container: Container
    private readonly onHover: EventMarkerHoverHandler
    private matchData: MatchData | null = null
    private entries: EventMarkerEntry[] = []
    private hoveredEvent: TelemetryEvent | null = null

    constructor(
        container: Container,
        onHover: EventMarkerHoverHandler,
    ) {
        this.container = container
        this.onHover = onHover
    }

    render(
        matchData: MatchData,
        mapRect: MapRenderRect,
        visibility: VisualizationVisibility,
        currentTimeSeconds: number,
    ): void {
        this.ensureMatch(matchData)

        for (const entry of this.entries) {
            const projected =
                projectTelemetryEvent(
                    entry.event,
                    mapRect,
                )

            entry.marker.position.set(
                projected.x,
                projected.y,
            )

            const visible =
                isEventVisibleAtTime(
                    entry.event,
                    currentTimeSeconds,
                ) &&
                isEventTypeVisible(
                    entry.event.type,
                    visibility,
                )

            if (
                !visible &&
                this.hoveredEvent === entry.event
            ) {
                this.hoveredEvent = null
                this.onHover(null)
            }

            entry.marker.visible = visible
            entry.marker.eventMode =
                visible ? 'static' : 'none'
        }
    }

    clear(): void {
        this.matchData = null
        this.entries = []
        this.hoveredEvent = null
        this.onHover(null)

        const children = this.container.removeChildren()

        for (const child of children) {
            child.destroy({
                children: true,
            })
        }
    }

    private ensureMatch(
        matchData: MatchData,
    ): void {
        if (this.matchData === matchData) {
            return
        }

        this.clear()
        this.matchData = matchData

        matchData.events.forEach(
            (event, index) => {
                const marker =
                    this.createEventMarker(
                        event,
                        matchData.match_id,
                    )

                marker.label = [
                    'event-marker',
                    event.type,
                    event.participant_id,
                    event.time_seconds.toString(),
                    index.toString(),
                ].join(':')
                marker.visible = false
                marker.eventMode = 'none'

                this.entries.push({
                    event,
                    marker,
                })
                this.container.addChild(marker)
            },
        )
    }

    private createEventMarker(
        event: TelemetryEvent,
        matchId: string,
    ): Container {
        const definition =
            EVENT_MARKER_DEFINITIONS[event.type]

        const marker = new Container()

        const contrast = new Graphics()
        drawMarkerShape(
            contrast,
            definition,
            definition.size + 1.8,
        )
        contrast.fill({
            color: 0x11151b,
            alpha: 0.82,
        })

        const symbol = new Graphics()
        drawMarkerShape(
            symbol,
            definition,
            definition.size,
        )

        if (definition.shape === 'cross') {
            symbol.stroke({
                color:
                    definition.strokeColor,
                width:
                    definition.strokeWidth +
                    1.2,
                alpha: definition.alpha,
                cap: 'round',
            })
        } else {
            symbol.fill({
                color: definition.fillColor,
                alpha: definition.alpha,
            })
            symbol.stroke({
                color:
                    definition.strokeColor,
                width:
                    definition.strokeWidth,
                alpha: 0.98,
                join: 'round',
            })
        }

        marker.addChild(
            contrast,
            symbol,
        )
        marker.cursor = 'pointer'

        const updateHover = (
            pointerEvent: FederatedPointerEvent,
        ): void => {
            if (!marker.visible) {
                return
            }

            this.hoveredEvent = event

            this.onHover({
                matchId,
                event,
                x: pointerEvent.global.x,
                y: pointerEvent.global.y,
            })
        }

        marker.on(
            'pointerover',
            updateHover,
        )
        marker.on(
            'pointermove',
            updateHover,
        )
        marker.on(
            'pointerout',
            () => {
                if (
                    this.hoveredEvent === event
                ) {
                    this.hoveredEvent = null
                    this.onHover(null)
                }
            },
        )

        return marker
    }
}

function drawMarkerShape(
    graphics: Graphics,
    definition: EventMarkerDefinition,
    size: number,
): void {
    if (definition.shape === 'diamond') {
        graphics.poly([
            0,
            -size,
            size,
            0,
            0,
            size,
            -size,
            0,
        ])
        return
    }

    if (definition.shape === 'square') {
        graphics.rect(
            -size,
            -size,
            size * 2,
            size * 2,
        )
        return
    }

    if (definition.shape === 'triangle') {
        graphics.poly([
            0,
            -size,
            size,
            size,
            -size,
            size,
        ])
        return
    }

    graphics.moveTo(-size, -size)
    graphics.lineTo(size, size)
    graphics.moveTo(size, -size)
    graphics.lineTo(-size, size)
}
