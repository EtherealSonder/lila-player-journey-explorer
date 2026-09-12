import type { TelemetryEvent } from '../telemetry/types'

/**
 * Returns whether an event has been reached by the current playback time.
 *
 * Event visibility is derived directly from normalized event time and current
 * playback time. No persistent "fired" state is stored, so reverse seeking is
 * naturally correct.
 *
 * Existing Phase 5 category/filter visibility should be applied separately by
 * the renderer:
 *
 *     isEventVisibleAtTime(event, currentTime) && existingFilterAllows(event)
 */
export function isEventVisibleAtTime(
    event: TelemetryEvent,
    currentTime: number,
): boolean {
    if (!Number.isFinite(currentTime)) {
        return false
    }

    return event.time_seconds <= currentTime
}
