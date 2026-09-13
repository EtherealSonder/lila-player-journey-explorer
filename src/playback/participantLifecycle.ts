import type {
    ParticipantTrack,
    TelemetryEvent,
    TelemetryPoint,
} from '../telemetry/types'
import { getParticipantPositionAtTime } from './participantPlayback'

export type ParticipantPlaybackStatus =
    | 'not_started'
    | 'active'
    | 'last_known'
    | 'dead'
    | 'unavailable'

export interface ParticipantLifecycleSnapshot {
    status: ParticipantPlaybackStatus
    visible: boolean
    position: TelemetryPoint | null
}


export function getParticipantDeathTime(
    participantId: string,
    events: TelemetryEvent[],
): number | null {
    let earliestDeathTime: number | null = null

    for (const event of events) {
        if (
            event.participant_id !== participantId ||
            event.owner_role !== 'victim' ||
            (event.type !== 'death' &&
                event.type !== 'storm_death')
        ) {
            continue
        }

        if (
            earliestDeathTime === null ||
            event.time_seconds < earliestDeathTime
        ) {
            earliestDeathTime = event.time_seconds
        }
    }

    return earliestDeathTime
}


export function getParticipantLifecycleAtTime(
    track: ParticipantTrack,
    events: TelemetryEvent[],
    currentTime: number,
): ParticipantLifecycleSnapshot {
    if (
        track.points.length === 0 ||
        !Number.isFinite(currentTime)
    ) {
        return hiddenSnapshot('unavailable')
    }

    const firstPoint = track.points[0]
    const lastPoint = track.points[track.points.length - 1]

    if (currentTime < firstPoint.time_seconds) {
        return hiddenSnapshot('not_started')
    }

    const deathTime = getParticipantDeathTime(
        track.participant_id,
        events,
    )

    if (deathTime !== null && currentTime >= deathTime) {
        return hiddenSnapshot('dead')
    }

    const position = getParticipantPositionAtTime(
        track,
        currentTime,
    )

    if (position === null) {
        return hiddenSnapshot('unavailable')
    }

    if (currentTime > lastPoint.time_seconds) {
        return {
            status: 'last_known',
            visible: true,
            position,
        }
    }

    return {
        status: 'active',
        visible: true,
        position,
    }
}

function hiddenSnapshot(
    status: Extract<
        ParticipantPlaybackStatus,
        'not_started' | 'dead' | 'unavailable'
    >,
): ParticipantLifecycleSnapshot {
    return {
        status,
        visible: false,
        position: null,
    }
}
