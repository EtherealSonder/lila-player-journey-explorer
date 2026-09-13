export interface Size2D {
    width: number;
    height: number;
}

export interface MapRenderRect {
    x: number;
    y: number;
    width: number;
    height: number;
}


export function fitMapToViewport(
    sourceSize: Size2D,
    viewportSize: Size2D,
): MapRenderRect {
    validatePositiveFiniteDimension(sourceSize.width, "source width");
    validatePositiveFiniteDimension(sourceSize.height, "source height");
    validatePositiveFiniteDimension(viewportSize.width, "viewport width");
    validatePositiveFiniteDimension(viewportSize.height, "viewport height");

    const scale = Math.min(
        viewportSize.width / sourceSize.width,
        viewportSize.height / sourceSize.height,
    );

    const width = sourceSize.width * scale;
    const height = sourceSize.height * scale;

    return {
        x: (viewportSize.width - width) / 2,
        y: (viewportSize.height - height) / 2,
        width,
        height,
    };
}

function validatePositiveFiniteDimension(
    value: number,
    name: string,
): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a finite number greater than zero.`);
    }
}
