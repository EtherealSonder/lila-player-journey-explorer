import { describe, expect, it } from 'vitest'

import { fitMapToViewport } from '../../src/map/mapGeometry'
import type {
    ParticipantTrack,
    TelemetryEvent,
    TelemetryPoint,
} from '../../src/telemetry/types'
import { projectTelemetryEvent } from '../../src/visualization/events/eventMarkerGeometry'
import { projectFinalParticipantPoint } from '../../src/visualization/participants/participantMarkerGeometry'
import { projectParticipantTrack } from '../../src/visualization/trajectories/trajectoryGeometry'

const basePoint: TelemetryPoint = {
    time_seconds: 0,
    world_x: 0,
    world_y: 0,
    world_z: 0,
    map_u: 0,
    map_v: 0,
}

function makeTrack(): ParticipantTrack {
    return {
        participant_id: 'participant-1',
        points: [
            {
                ...basePoint,
                time_seconds: 1,
                map_u: 0.2,
                map_v: 0.8,
            },
            {
                ...basePoint,
                time_seconds: 2,
                map_u: 0.5,
                map_v: 0.5,
            },
            {
                ...basePoint,
                time_seconds: 3,
                map_u: 0.8,
                map_v: 0.2,
            },
        ],
    }
}

function makeEvent(): TelemetryEvent {
    return {
        time_seconds: 7,
        type: 'kill',
        participant_id: 'participant-1',
        participant_category: 'human',
        owner_role: 'killer',
        world_x: 0,
        world_y: 0,
        world_z: 0,
        map_u: 0.65,
        map_v: 0.35,
        source_category: 'human',
        target_category: 'bot',
        metadata: {},
    }
}

describe('static visualization resize regression', () => {
    it('keeps normalized trajectory positions stable across wide and narrow viewports', () => {
        const sourceSize = {
            width: 4320,
            height: 4320,
        }

        const wideRect = fitMapToViewport(
            sourceSize,
            {
                width: 1400,
                height: 700,
            },
        )

        const narrowRect = fitMapToViewport(
            sourceSize,
            {
                width: 700,
                height: 700,
            },
        )

        const wide = projectParticipantTrack(
            makeTrack(),
            wideRect,
        )

        const narrow = projectParticipantTrack(
            makeTrack(),
            narrowRect,
        )

        for (let index = 0; index < wide.length; index += 1) {
            const widePoint = wide[index]
            const narrowPoint = narrow[index]

            expect(widePoint).toBeDefined()
            expect(narrowPoint).toBeDefined()

            if (!widePoint || !narrowPoint) {
                continue
            }

            const wideLocalU =
                (widePoint.x - wideRect.x) / wideRect.width
            const wideLocalV =
                (widePoint.y - wideRect.y) / wideRect.height

            const narrowLocalU =
                (narrowPoint.x - narrowRect.x) / narrowRect.width
            const narrowLocalV =
                (narrowPoint.y - narrowRect.y) / narrowRect.height

            expect(wideLocalU).toBeCloseTo(narrowLocalU)
            expect(wideLocalV).toBeCloseTo(narrowLocalV)
        }
    })

    it('preserves Grand Rift non-square geometry during resize', () => {
        const mapRect = fitMapToViewport(
            {
                width: 2160,
                height: 2158,
            },
            {
                width: 1200,
                height: 800,
            },
        )

        expect(mapRect.width / mapRect.height).toBeCloseTo(
            2160 / 2158,
        )
        expect(mapRect.x).toBeGreaterThanOrEqual(0)
        expect(mapRect.y).toBeGreaterThanOrEqual(0)
    })

    it('keeps final participant marker exactly on the projected track endpoint after resize', () => {
        const track = makeTrack()

        const mapRects = [
            fitMapToViewport(
                { width: 4320, height: 4320 },
                { width: 1400, height: 700 },
            ),
            fitMapToViewport(
                { width: 4320, height: 4320 },
                { width: 760, height: 900 },
            ),
        ]

        for (const mapRect of mapRects) {
            const projectedTrack =
                projectParticipantTrack(
                    track,
                    mapRect,
                )

            const finalMarker =
                projectFinalParticipantPoint(
                    track,
                    mapRect,
                )

            const projectedEnd =
                projectedTrack[
                    projectedTrack.length - 1
                ]

            expect(finalMarker).not.toBeNull()
            expect(projectedEnd).toBeDefined()

            expect(
                finalMarker?.viewportPoint.x,
            ).toBeCloseTo(projectedEnd?.x ?? 0)
            expect(
                finalMarker?.viewportPoint.y,
            ).toBeCloseTo(projectedEnd?.y ?? 0)
        }
    })

    it('keeps event markers tied to the same normalized event position after resize', () => {
        const event = makeEvent()

        const firstRect = fitMapToViewport(
            {
                width: 9000,
                height: 9000,
            },
            {
                width: 1280,
                height: 720,
            },
        )

        const secondRect = fitMapToViewport(
            {
                width: 9000,
                height: 9000,
            },
            {
                width: 820,
                height: 980,
            },
        )

        const first =
            projectTelemetryEvent(
                event,
                firstRect,
            )
        const second =
            projectTelemetryEvent(
                event,
                secondRect,
            )

        expect(
            (first.x - firstRect.x) /
                firstRect.width,
        ).toBeCloseTo(
            (second.x - secondRect.x) /
                secondRect.width,
        )

        expect(
            (first.y - firstRect.y) /
                firstRect.height,
        ).toBeCloseTo(
            (second.y - secondRect.y) /
                secondRect.height,
        )
    })
})
