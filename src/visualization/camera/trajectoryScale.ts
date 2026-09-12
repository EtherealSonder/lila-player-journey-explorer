export const MIN_TRAJECTORY_SCREEN_SCALE = 0.65

/**
 * Returns a screen-space thickness multiplier for trajectory strokes.
 *
 * The map itself scales with camera zoom. To keep trajectories from becoming
 * visually dominant, their local stroke widths are reduced as zoom increases.
 *
 * Approximate final screen-space thickness:
 * 1x -> 100%
 * 2x -> 93%
 * 4x -> 79%
 * 6x -> 65%
 */
export function getTrajectoryScreenScale(
    cameraScale: number,
): number {
    const safeScale =
        Number.isFinite(cameraScale) &&
            cameraScale > 0
            ? Math.max(1, cameraScale)
            : 1

    const normalized =
        Math.min(
            1,
            (safeScale - 1) / 5,
        )

    return (
        1 -
        normalized *
        (1 - MIN_TRAJECTORY_SCREEN_SCALE)
    )
}

/**
 * Converts the desired screen-space multiplier into the local stroke-width
 * multiplier required inside the camera-scaled Pixi world container.
 */
export function getCameraAwareTrajectoryLocalScale(
    cameraScale: number,
): number {
    const safeScale =
        Number.isFinite(cameraScale) &&
            cameraScale > 0
            ? Math.max(1, cameraScale)
            : 1

    return (
        getTrajectoryScreenScale(
            safeScale,
        ) / safeScale
    )
}
