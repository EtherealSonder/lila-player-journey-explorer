import type {
    ParticipantCategory,
    TelemetryEvent,
    TelemetryEventType,
} from '../../telemetry/types'

export interface EventTooltipModel {
    title: string
    elapsedTime: string
    participantId: string
    participantCategory: ParticipantCategory
    ownerRole: string
    sourceCategory: ParticipantCategory | null
    targetCategory: ParticipantCategory | null
    metadata: Array<{
        key: string
        value: string
    }>
}

export function buildEventTooltipModel(
    event: TelemetryEvent,
): EventTooltipModel {
    return {
        title: getEventTitle(event.type),
        elapsedTime: formatElapsedTime(event.time_seconds),
        participantId: event.participant_id,
        participantCategory: event.participant_category,
        ownerRole: event.owner_role,
        sourceCategory: event.source_category,
        targetCategory: event.target_category,
        metadata: getDisplayMetadata(event.metadata),
    }
}

export function formatElapsedTime(
    timeSeconds: number,
): string {
    const totalSeconds = Math.max(
        0,
        Math.round(timeSeconds),
    )
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getEventTitle(
    eventType: TelemetryEventType,
): string {
    if (eventType === 'kill') {
        return 'Kill'
    }

    if (eventType === 'death') {
        return 'Death'
    }

    if (eventType === 'loot') {
        return 'Loot'
    }

    return 'Storm death'
}

function getDisplayMetadata(
    metadata: Record<string, unknown>,
): Array<{ key: string; value: string }> {
    return Object.entries(metadata)
        .flatMap(([key, value]) => {
            if (
                typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean'
            ) {
                return [{
                    key,
                    value: String(value),
                }]
            }

            return []
        })
        .slice(0, 3)
}
