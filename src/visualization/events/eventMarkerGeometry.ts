import type { MapRenderRect } from '../../map/mapGeometry'
import { mapUvToRenderedPixels } from '../../map/mapProjection'
import type { TelemetryEvent } from '../../telemetry/types'

export interface ProjectedTelemetryEvent {
    event: TelemetryEvent
    x: number
    y: number
}

export function projectTelemetryEvent(
    event: TelemetryEvent,
    mapRect: MapRenderRect,
): ProjectedTelemetryEvent {
    const localPoint = mapUvToRenderedPixels(
        {
            mapU: event.map_u,
            mapV: event.map_v,
        },
        {
            width: mapRect.width,
            height: mapRect.height,
        },
    )

    return {
        event,
        x: mapRect.x + localPoint.x,
        y: mapRect.y + localPoint.y,
    }
}

export function projectTelemetryEvents(
    events: readonly TelemetryEvent[],
    mapRect: MapRenderRect,
): ProjectedTelemetryEvent[] {
    return events.map((event) =>
        projectTelemetryEvent(event, mapRect),
    )
}
