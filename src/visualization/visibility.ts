import type {
    ParticipantCategory,
    TelemetryEventType,
} from '../telemetry/types'

export interface VisualizationVisibility {
    humans: boolean
    bots: boolean
    kills: boolean
    deaths: boolean
    loot: boolean
    stormDeaths: boolean
}

export const DEFAULT_VISUALIZATION_VISIBILITY: VisualizationVisibility = {
    humans: true,
    bots: true,
    kills: true,
    deaths: true,
    loot: true,
    stormDeaths: true,
}

export function isParticipantCategoryVisible(
    category: ParticipantCategory,
    visibility: VisualizationVisibility,
): boolean {
    if (category === 'human') {
        return visibility.humans
    }

    if (category === 'bot') {
        return visibility.bots
    }

    return visibility.humans || visibility.bots
}

export function isEventTypeVisible(
    eventType: TelemetryEventType,
    visibility: VisualizationVisibility,
): boolean {
    if (eventType === 'kill') {
        return visibility.kills
    }

    if (eventType === 'death') {
        return visibility.deaths
    }

    if (eventType === 'loot') {
        return visibility.loot
    }

    return visibility.stormDeaths
}
