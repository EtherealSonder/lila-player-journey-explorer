import type { MapRenderRect } from '../../map/mapGeometry'
import type {
    ParticipantTrack,
    TelemetryPoint,
} from '../../telemetry/types'
import {
    projectTelemetryPoint,
    type ViewportPoint,
} from '../trajectories/trajectoryGeometry'

export interface FinalParticipantPoint {
    participantId: string
    telemetryPoint: TelemetryPoint
    viewportPoint: ViewportPoint
}

export function getFinalTrackPoint(
    track: ParticipantTrack,
): TelemetryPoint | null {
    if (track.points.length === 0) {
        return null
    }

    return track.points[track.points.length - 1] ?? null
}

export function projectFinalParticipantPoint(
    track: ParticipantTrack,
    mapRect: MapRenderRect,
): FinalParticipantPoint | null {
    const telemetryPoint = getFinalTrackPoint(track)

    if (!telemetryPoint) {
        return null
    }

    return {
        participantId: track.participant_id,
        telemetryPoint,
        viewportPoint: projectTelemetryPoint(
            telemetryPoint,
            mapRect,
        ),
    }
}
