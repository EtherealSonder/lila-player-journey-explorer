import type { TelemetryEventType } from '../../telemetry/types'

export type EventMarkerShape =
    | 'diamond'
    | 'cross'
    | 'square'
    | 'triangle'

export interface EventMarkerDefinition {
    shape: EventMarkerShape
    fillColor: number
    strokeColor: number
    size: number
    strokeWidth: number
    alpha: number
}

export const EVENT_MARKER_DEFINITIONS: Record<
    TelemetryEventType,
    EventMarkerDefinition
> = {
    kill: {
        shape: 'diamond',
        fillColor: 0xe55252,
        strokeColor: 0xffffff,
        size: 5.4,
        strokeWidth: 1.3,
        alpha: 0.98,
    },
    death: {
        shape: 'cross',
        fillColor: 0x252b33,
        strokeColor: 0xffffff,
        size: 5.6,
        strokeWidth: 1.5,
        alpha: 0.98,
    },
    loot: {
        shape: 'square',
        fillColor: 0xd7a72c,
        strokeColor: 0x2d2613,
        size: 4.8,
        strokeWidth: 1.2,
        alpha: 0.96,
    },
    storm_death: {
        shape: 'triangle',
        fillColor: 0x8d68d8,
        strokeColor: 0xffffff,
        size: 5.8,
        strokeWidth: 1.3,
        alpha: 0.98,
    },
}
