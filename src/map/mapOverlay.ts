import {
    mapUvToRenderedPixels,
    type NormalizedMapPoint,
    type RenderedMapPoint,
} from './mapProjection'
import type { MapRenderRect } from './mapGeometry'

/**
 * Convert normalized map coordinates into coordinates relative to the full
 * visualization viewport.
 *
 * mapUvToRenderedPixels() owns the normalized-map to rendered-map transform,
 * including the single confirmed vertical inversion.
 *
 * This helper only adds the contained minimap rectangle's viewport offset.
 */
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
