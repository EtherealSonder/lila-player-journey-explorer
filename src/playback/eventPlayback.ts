import type { TelemetryEvent } from '../telemetry/types'

export function isEventVisibleAtTime(
    event: TelemetryEvent,
    currentTime: number,
): boolean {
    if (!Number.isFinite(currentTime)) {
        return false
    }

    return event.time_seconds <= currentTime
}
