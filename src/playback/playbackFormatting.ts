
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
