export interface NormalizedMapPoint {
    mapU: number;
    mapV: number;
}

export interface RenderedMapSize {
    width: number;
    height: number;
}

export interface RenderedMapPoint {
    x: number;
    y: number;
}

/**
 * Convert normalized map coordinates into pixel coordinates inside a
 * rendered minimap.
 *
 * Normalized map space uses:
 *   u = left -> right
 *   v = bottom -> top
 *
 * Browser/image space uses:
 *   x = left -> right
 *   y = top -> bottom
 *
 * Phase 3 visual validation confirmed that the renderer must invert the
 * normalized vertical axis exactly once:
 *
 *   x = mapU * width
 *   y = (1 - mapV) * height
 *
 * This function is intentionally dataset-independent. It knows nothing about
 * world coordinates, source telemetry schemas, LILA projection origins, map
 * scales, or texture asset names.
 *
 * Normalized coordinates are deliberately not clamped. Out-of-range values
 * remain visible to callers as out-of-range pixel coordinates.
 */
export function mapUvToRenderedPixels(
    point: NormalizedMapPoint,
    renderedSize: RenderedMapSize,
): RenderedMapPoint {
    validateFiniteNumber(point.mapU, "mapU");
    validateFiniteNumber(point.mapV, "mapV");
    validatePositiveFiniteDimension(renderedSize.width, "width");
    validatePositiveFiniteDimension(renderedSize.height, "height");

    return {
        x: point.mapU * renderedSize.width,
        y: (1 - point.mapV) * renderedSize.height,
    };
}

function validateFiniteNumber(value: number, name: string): void {
    if (!Number.isFinite(value)) {
        throw new RangeError(`${name} must be a finite number.`);
    }
}

function validatePositiveFiniteDimension(
    value: number,
    name: string,
): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a finite number greater than zero.`);
    }
}
