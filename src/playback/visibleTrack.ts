import type {
    ParticipantTrack,
    TelemetryPoint,
} from '../telemetry/types'
import { getParticipantPositionAtTime } from './participantPlayback'


export function getVisibleTrackAtTime(
    track: ParticipantTrack,
    currentTime: number,
): TelemetryPoint[] {
    const { points } = track

    if (
        points.length === 0 ||
        !Number.isFinite(currentTime)
    ) {
        return []
    }

    const firstPoint = points[0]
    const lastPoint = points[points.length - 1]

    if (currentTime < firstPoint.time_seconds) {
        return []
    }

    if (currentTime >= lastPoint.time_seconds) {
        return points.slice()
    }

    const upperIndex = findFirstPointAfterTime(
        points,
        currentTime,
    )

    if (upperIndex <= 0) {
        return []
    }

    const completedPoints = points.slice(0, upperIndex)
    const lastCompletedPoint =
        completedPoints[completedPoints.length - 1]

    if (lastCompletedPoint.time_seconds === currentTime) {
        return completedPoints
    }

    const interpolatedEndpoint =
        getParticipantPositionAtTime(
            track,
            currentTime,
        )

    if (interpolatedEndpoint === null) {
        return completedPoints
    }

    return [
        ...completedPoints,
        interpolatedEndpoint,
    ]
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
