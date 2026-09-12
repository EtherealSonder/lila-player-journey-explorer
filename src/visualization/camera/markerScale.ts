export const MIN_MARKER_SCREEN_SCALE = 0.68
export const MARKER_ZOOM_EXPONENT = 0.25

/**
 * Returns the marker's local Pixi scale for the current camera zoom.
 *
 * Markers live inside the same root container as the map, so the root camera
 * transform would normally make them grow with zoom. This compensates for the
 * camera scale and also lets the marker become slightly smaller on screen at
 * higher zoom levels, which keeps dense event locations readable.
 *
 * The final on-screen marker size is approximately:
 *
 *     max(MIN_MARKER_SCREEN_SCALE, zoom ^ -MARKER_ZOOM_EXPONENT)
 *
 * At 1x the marker is unchanged. At 2x it is about 84% of its original
 * on-screen size. At 4x it is about 71%.
 */
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
