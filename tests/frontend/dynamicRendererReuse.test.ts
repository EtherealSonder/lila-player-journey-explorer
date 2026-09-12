import {
    Container,
} from 'pixi.js'
import {
    describe,
    expect,
    it,
    vi,
} from 'vitest'

import type {
    MatchData,
    TelemetryEvent,
    TelemetryPoint,
} from '../../src/telemetry/types'
import { EventMarkerRenderer } from '../../src/visualization/events/EventMarkerRenderer'
import { ParticipantMarkerRenderer } from '../../src/visualization/participants/ParticipantMarkerRenderer'
import { TrajectoryRenderer } from '../../src/visualization/trajectories/TrajectoryRenderer'
import {
    DEFAULT_VISUALIZATION_VISIBILITY,
} from '../../src/visualization/visibility'

const mapRect = {
    x: 0,
    y: 0,
    width: 1000,
    height: 500,
}

function point(
    time_seconds: number,
    map_u: number,
    map_v: number,
): TelemetryPoint {
    return {
        time_seconds,
        world_x: map_u * 100,
        world_y: 0,
        world_z: map_v * 100,
        map_u,
        map_v,
    }
}

function event(
    time_seconds: number,
    type: TelemetryEvent['type'],
): TelemetryEvent {
    return {
        time_seconds,
        type,
        participant_id: 'human-1',
        participant_category: 'human',
        owner_role:
            type === 'death'
                ? 'victim'
                : 'participant',
        world_x: 50,
        world_y: 0,
        world_z: 50,
        map_u: 0.5,
        map_v: 0.5,
        source_category: null,
        target_category: null,
        metadata: {},
    }
}

function matchData(): MatchData {
    return {
        match_id: 'match-1',
        date: '2026-02-10',
        map_id: 'AmbroseValley',
        duration_seconds: 30,
        participants: [
            {
                id: 'human-1',
                category: 'human',
            },
            {
                id: 'bot-1',
                category: 'bot',
            },
        ],
        tracks: [
            {
                participant_id: 'human-1',
                points: [
                    point(0, 0.1, 0.1),
                    point(10, 0.4, 0.4),
                    point(20, 0.8, 0.8),
                ],
            },
            {
                participant_id: 'bot-1',
                points: [
                    point(5, 0.2, 0.8),
                    point(15, 0.5, 0.5),
                    point(25, 0.8, 0.2),
                ],
            },
        ],
        events: [
            event(8, 'loot'),
            {
                ...event(18, 'death'),
                owner_role: 'victim',
            },
        ],
    }
}

describe('dynamic Pixi renderer reuse', () => {
    it('retains one trajectory object set per participant while playback changes', () => {
        const container = new Container()
        const renderer =
            new TrajectoryRenderer(container)
        const match = matchData()

        renderer.render(
            match,
            mapRect,
            DEFAULT_VISUALIZATION_VISIBILITY,
            6,
        )

        expect(container.children).toHaveLength(2)

        const firstChildren =
            [...container.children]

        renderer.render(
            match,
            mapRect,
            DEFAULT_VISUALIZATION_VISIBILITY,
            16,
        )

        expect(container.children).toHaveLength(2)
        expect(container.children[0]).toBe(
            firstChildren[0],
        )
        expect(container.children[1]).toBe(
            firstChildren[1],
        )

        renderer.clear()
        container.destroy()
    })

    it('retains participant markers and updates only position or visibility', () => {
        const container = new Container()
        const renderer =
            new ParticipantMarkerRenderer(
                container,
            )
        const match = matchData()

        renderer.render(
            match,
            mapRect,
            DEFAULT_VISUALIZATION_VISIBILITY,
            6,
        )

        const humanMarker =
            container.children[0]
        const botMarker =
            container.children[1]

        expect(humanMarker).toBeDefined()
        expect(botMarker).toBeDefined()
        expect(humanMarker?.visible).toBe(true)
        expect(botMarker?.visible).toBe(true)

        const firstHumanX =
            humanMarker?.position.x

        renderer.render(
            match,
            mapRect,
            DEFAULT_VISUALIZATION_VISIBILITY,
            16,
        )

        expect(container.children[0]).toBe(
            humanMarker,
        )
        expect(container.children[1]).toBe(
            botMarker,
        )
        expect(
            humanMarker?.position.x,
        ).not.toBe(firstHumanX)

        renderer.render(
            match,
            mapRect,
            DEFAULT_VISUALIZATION_VISIBILITY,
            18,
        )

        expect(humanMarker?.visible).toBe(false)

        renderer.clear()
        container.destroy()
    })

    it('creates event markers once and time-gates them with visibility flags', () => {
        const container = new Container()
        const onHover = vi.fn()
        const renderer =
            new EventMarkerRenderer(
                container,
                onHover,
            )
        const match = matchData()

        renderer.render(
            match,
            mapRect,
            DEFAULT_VISUALIZATION_VISIBILITY,
            0,
        )

        expect(container.children).toHaveLength(2)

        const firstChildren =
            [...container.children]

        expect(firstChildren[0]?.visible).toBe(false)
        expect(firstChildren[1]?.visible).toBe(false)

        renderer.render(
            match,
            mapRect,
            DEFAULT_VISUALIZATION_VISIBILITY,
            8,
        )

        expect(container.children[0]).toBe(
            firstChildren[0],
        )
        expect(container.children[1]).toBe(
            firstChildren[1],
        )
        expect(firstChildren[0]?.visible).toBe(true)
        expect(firstChildren[1]?.visible).toBe(false)

        renderer.render(
            match,
            mapRect,
            {
                ...DEFAULT_VISUALIZATION_VISIBILITY,
                loot: false,
            },
            30,
        )

        expect(firstChildren[0]?.visible).toBe(false)
        expect(firstChildren[1]?.visible).toBe(true)

        renderer.render(
            match,
            mapRect,
            DEFAULT_VISUALIZATION_VISIBILITY,
            4,
        )

        expect(firstChildren[0]?.visible).toBe(false)
        expect(firstChildren[1]?.visible).toBe(false)

        renderer.clear()
        container.destroy()
    })

    it('replaces retained objects when the active match object changes', () => {
        const container = new Container()
        const renderer =
            new TrajectoryRenderer(container)
        const firstMatch = matchData()

        renderer.render(
            firstMatch,
            mapRect,
            DEFAULT_VISUALIZATION_VISIBILITY,
            10,
        )

        const firstTrack =
            container.children[0]

        const secondMatch = {
            ...matchData(),
            match_id: 'match-2',
        }

        renderer.render(
            secondMatch,
            mapRect,
            DEFAULT_VISUALIZATION_VISIBILITY,
            10,
        )

        expect(container.children).toHaveLength(2)
        expect(container.children[0]).not.toBe(
            firstTrack,
        )

        renderer.clear()
        container.destroy()
    })
})
