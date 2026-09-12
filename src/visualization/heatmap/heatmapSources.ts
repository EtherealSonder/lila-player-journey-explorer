import type {
    MatchData,
    TelemetryEvent,
    TelemetryPoint,
} from '../../telemetry/types'
import type {
    HeatmapPoint,
} from './heatmapTypes'

/**
 * Extracts traffic-density samples from participant movement tracks.
 *
 * Every valid normalized trajectory sample contributes one heatmap point.
 * No downsampling is applied because selected-match payloads are small enough
 * for direct aggregation and downsampling would change the analytical meaning
 * of sample density.
 */
export function getTrafficHeatmapPoints(
    matchData: MatchData,
): HeatmapPoint[] {
    const points: HeatmapPoint[] = []

    for (const track of matchData.tracks) {
        for (const point of track.points) {
            if (!isValidTrafficPoint(point)) {
                continue
            }

            points.push({
                map_u: point.map_u,
                map_v: point.map_v,
            })
        }
    }

    return points
}

/**
 * Extracts kill-location samples using one explicit normalized semantic.
 *
 * Kill heatmap policy:
 *     type === 'kill' && owner_role === 'killer'
 *
 * Death-side records are deliberately not merged into this source.
 */
export function getKillHeatmapPoints(
    matchData: MatchData,
): HeatmapPoint[] {
    const points: HeatmapPoint[] = []

    for (const event of matchData.events) {
        if (!isKillHeatmapEvent(event)) {
            continue
        }

        if (!isValidHeatmapEventPoint(event)) {
            continue
        }

        points.push({
            map_u: event.map_u,
            map_v: event.map_v,
        })
    }

    return points
}

/**
 * Extracts general death-location samples using the victim-side death record.
 *
 * Death heatmap policy:
 *     type === 'death' && owner_role === 'victim'
 *
 * Storm deaths are explicitly excluded from the general Death heatmap.
 * They remain a distinct telemetry category so a future storm-specific layer
 * can be added without changing the meaning of the existing Death mode.
 */
export function getDeathHeatmapPoints(
    matchData: MatchData,
): HeatmapPoint[] {
    const points: HeatmapPoint[] = []

    for (const event of matchData.events) {
        if (!isDeathHeatmapEvent(event)) {
            continue
        }

        if (!isValidHeatmapEventPoint(event)) {
            continue
        }

        points.push({
            map_u: event.map_u,
            map_v: event.map_v,
        })
    }

    return points
}

function isKillHeatmapEvent(
    event: TelemetryEvent,
): boolean {
    return (
        event.type === 'kill' &&
        event.owner_role === 'killer'
    )
}

function isDeathHeatmapEvent(
    event: TelemetryEvent,
): boolean {
    return (
        event.type === 'death' &&
        event.owner_role === 'victim'
    )
}

function isValidTrafficPoint(
    point: TelemetryPoint,
): boolean {
    return (
        Number.isFinite(point.map_u) &&
        Number.isFinite(point.map_v) &&
        point.map_u >= 0 &&
        point.map_u <= 1 &&
        point.map_v >= 0 &&
        point.map_v <= 1
    )
}

function isValidHeatmapEventPoint(
    event: TelemetryEvent,
): boolean {
    return (
        Number.isFinite(event.map_u) &&
        Number.isFinite(event.map_v) &&
        event.map_u >= 0 &&
        event.map_u <= 1 &&
        event.map_v >= 0 &&
        event.map_v <= 1
    )
}
