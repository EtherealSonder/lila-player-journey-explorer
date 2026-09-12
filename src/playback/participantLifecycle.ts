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

/**
 * Returns the earliest normalized victim-side death time for a participant.
 *
 * Both standard deaths and storm deaths end the moving marker. Killer-side
 * combat events and unrelated participant events do not affect lifecycle.
 */
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

/**
 * Resolves whether a participant marker should exist at a playback time and,
 * when visible, which normalized telemetry position it should use.
 *
 * Policy:
 * - no samples: unavailable and hidden
 * - before first sample: not_started and hidden
 * - at/after victim-side death: dead and hidden
 * - from first through final sample: active and positioned from track samples
 * - after final sample without death: last_known and held at the final sample
 *
 * Sparse samples are handled by getParticipantPositionAtTime(), which
 * interpolates only between adjacent real samples. This lifecycle helper does
 * not extrapolate beyond the final recorded sample.
 */
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
