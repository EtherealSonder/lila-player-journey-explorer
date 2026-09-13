
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
