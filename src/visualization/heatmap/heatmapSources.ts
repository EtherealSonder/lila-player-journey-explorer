import type {
    MatchData,
    TelemetryEvent,
    TelemetryPoint,
} from '../../telemetry/types'
import type {
    HeatmapPoint,
} from './heatmapTypes'


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
