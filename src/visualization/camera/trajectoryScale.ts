export const MIN_TRAJECTORY_SCREEN_SCALE = 0.65


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
