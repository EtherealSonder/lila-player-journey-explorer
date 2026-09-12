import type { MatchEventCounts } from './types'

export function formatMatchDuration(
    durationSeconds: number,
): string {
    const totalSeconds = Math.max(
        0,
        Math.round(durationSeconds),
    )
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function getTotalEventCount(
    eventCounts: MatchEventCounts,
): number {
    return (
        eventCounts.kill +
        eventCounts.death +
        eventCounts.storm_death +
        eventCounts.loot
    )
}
