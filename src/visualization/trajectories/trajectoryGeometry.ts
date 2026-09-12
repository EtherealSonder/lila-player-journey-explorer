import type { MapRenderRect } from '../../map/mapGeometry'
import { mapUvToRenderedPixels } from '../../map/mapProjection'
import type {
    ParticipantTrack,
    TelemetryPoint,
} from '../../telemetry/types'

export interface ViewportPoint {
    x: number
    y: number
}

export function projectTelemetryPoint(
    point: TelemetryPoint,
    mapRect: MapRenderRect,
): ViewportPoint {
    const localPoint = mapUvToRenderedPixels(
        {
            mapU: point.map_u,
            mapV: point.map_v,
        },
        {
            width: mapRect.width,
            height: mapRect.height,
        },
    )

    return {
        x: mapRect.x + localPoint.x,
        y: mapRect.y + localPoint.y,
    }
}

export function projectParticipantTrack(
    track: ParticipantTrack,
    mapRect: MapRenderRect,
): ViewportPoint[] {
    return track.points.map((point) =>
        projectTelemetryPoint(point, mapRect),
    )
}
