export const MIN_MARKER_SCREEN_SCALE = 0.68
export const MARKER_ZOOM_EXPONENT = 0.25


export function getCameraAwareMarkerLocalScale(
    cameraScale: number,
): number {
    const zoom =
        Number.isFinite(cameraScale) &&
            cameraScale > 0
            ? Math.max(1, cameraScale)
            : 1

    const targetScreenScale =
        Math.max(
            MIN_MARKER_SCREEN_SCALE,
            Math.pow(
                zoom,
                -MARKER_ZOOM_EXPONENT,
            ),
        )

    return targetScreenScale / zoom
}
