import {
    mapUvToRenderedPixels,
    type NormalizedMapPoint,
    type RenderedMapPoint,
} from './mapProjection'
import type { MapRenderRect } from './mapGeometry'


export function mapUvToViewportPixels(
    point: NormalizedMapPoint,
    mapRect: MapRenderRect,
): RenderedMapPoint {
    const mapLocalPoint = mapUvToRenderedPixels(
        point,
        {
            width: mapRect.width,
            height: mapRect.height,
        },
    )

    return {
        x: mapRect.x + mapLocalPoint.x,
        y: mapRect.y + mapLocalPoint.y,
    }
}
