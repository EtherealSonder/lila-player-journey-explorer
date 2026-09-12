import type {
    ParticipantTrack,
    TelemetryPoint,
} from '../telemetry/types'

/**
 * Returns the participant position represented by a chronological track at a
 * specific match time.
 *
 * Policy:
 * - before the first sample: no position
 * - exact sample time: return that exact sample
 * - between samples: linearly interpolate between the adjacent samples
 * - after the final sample: return the final recorded sample without
 *   extrapolating beyond it
 *
 * Lifecycle decisions such as hiding a participant after death are handled by
 * later playback logic. This helper only answers where the recorded track says
 * the participant is at the requested time.
 */
export function getParticipantPositionAtTime(
    track: ParticipantTrack,
    currentTime: number,
): TelemetryPoint | null {
    const { points } = track

    if (points.length === 0 || !Number.isFinite(currentTime)) {
        return null
    }

    const firstPoint = points[0]
    const lastPoint = points[points.length - 1]

    if (currentTime < firstPoint.time_seconds) {
        return null
    }

    if (currentTime >= lastPoint.time_seconds) {
        return lastPoint
    }

    const exactIndex = findExactTimeIndex(points, currentTime)

    if (exactIndex !== -1) {
        return points[exactIndex]
    }

    const upperIndex = findFirstPointAfterTime(points, currentTime)

    if (upperIndex <= 0 || upperIndex >= points.length) {
        return null
    }

    const lowerPoint = points[upperIndex - 1]
    const upperPoint = points[upperIndex]

    return interpolateTelemetryPoint(
        lowerPoint,
        upperPoint,
        currentTime,
    )
}

function findExactTimeIndex(
    points: TelemetryPoint[],
    currentTime: number,
): number {
    let low = 0
    let high = points.length - 1

    while (low <= high) {
        const middle = Math.floor((low + high) / 2)
        const middleTime = points[middle].time_seconds

        if (middleTime === currentTime) {
            return middle
        }

        if (middleTime < currentTime) {
            low = middle + 1
        } else {
            high = middle - 1
        }
    }

    return -1
}

function findFirstPointAfterTime(
    points: TelemetryPoint[],
    currentTime: number,
): number {
    let low = 0
    let high = points.length

    while (low < high) {
        const middle = Math.floor((low + high) / 2)

        if (points[middle].time_seconds <= currentTime) {
            low = middle + 1
        } else {
            high = middle
        }
    }

    return low
}

function interpolateTelemetryPoint(
    start: TelemetryPoint,
    end: TelemetryPoint,
    currentTime: number,
): TelemetryPoint {
    const duration = end.time_seconds - start.time_seconds

    if (duration <= 0) {
        return start
    }

    const alpha =
        (currentTime - start.time_seconds) / duration

    return {
        time_seconds: currentTime,
        world_x: lerp(start.world_x, end.world_x, alpha),
        world_y: lerp(start.world_y, end.world_y, alpha),
        world_z: lerp(start.world_z, end.world_z, alpha),
        map_u: lerp(start.map_u, end.map_u, alpha),
        map_v: lerp(start.map_v, end.map_v, alpha),
    }
}

function lerp(start: number, end: number, alpha: number): number {
    return start + (end - start) * alpha
}
