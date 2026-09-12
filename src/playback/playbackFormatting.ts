/**
 * Formats playback time using whole elapsed seconds.
 *
 * Subsecond precision remains in playback state. Display formatting floors the
 * value so 65.8 seconds is shown as 1:05 rather than rounding forward to 1:06.
 */
export function formatPlaybackTime(
    seconds: number,
): string {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return '0:00'
    }

    const wholeSeconds = Math.floor(seconds)
    const minutes = Math.floor(
        wholeSeconds / 60,
    )
    const remainingSeconds =
        wholeSeconds % 60

    return `${minutes}:${remainingSeconds
        .toString()
        .padStart(2, '0')}`
}
