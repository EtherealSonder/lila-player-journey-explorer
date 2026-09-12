/**
 * Converts two requestAnimationFrame timestamps from milliseconds to elapsed
 * real seconds.
 *
 * Invalid, missing, or non-forward deltas intentionally produce zero so a
 * stalled or reset frame clock cannot move playback backwards.
 */
export function getFrameDeltaSeconds(
    previousTimestampMs: number | null,
    currentTimestampMs: number,
): number {
    if (
        previousTimestampMs === null ||
        !Number.isFinite(previousTimestampMs) ||
        !Number.isFinite(currentTimestampMs) ||
        currentTimestampMs <= previousTimestampMs
    ) {
        return 0
    }

    return (currentTimestampMs - previousTimestampMs) / 1000
}
