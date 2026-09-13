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
