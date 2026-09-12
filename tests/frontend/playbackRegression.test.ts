import {
    Container,
} from 'pixi.js'
import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    advancePlayback,
    seekPlayback,
    setPlaybackSpeed,
} from '../../src/playback/playbackMath'
import {
    createPlaybackState,
} from '../../src/playback/playbackState'
import {
    createPlaybackSession,
    resolvePlaybackSessionState,
} from '../../src/playback/playbackSession'
import {
    getParticipantLifecycleAtTime,
} from '../../src/playback/participantLifecycle'
import {
    isEventVisibleAtTime,
} from '../../src/playback/eventPlayback'
import type {
    MatchData,
    ParticipantTrack,
    TelemetryEvent,
    TelemetryPoint,
} from '../../src/telemetry/types'
import { TrajectoryRenderer } from '../../src/visualization/trajectories/TrajectoryRenderer'
import { ParticipantMarkerRenderer } from '../../src/visualization/participants/ParticipantMarkerRenderer'
import { EventMarkerRenderer } from '../../src/visualization/events/EventMarkerRenderer'
import {
    DEFAULT_VISUALIZATION_VISIBILITY,
} from '../../src/visualization/visibility'
import { VisualizationLayers } from '../../src/visualization/layers/VisualizationLayers'

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

const track: ParticipantTrack = {
    participant_id: 'human-1',
    points: [
        point(5, 0.1, 0.1),
        point(10, 0.5, 0.5),
        point(20, 0.9, 0.9),
    ],
}

const deathEvent: TelemetryEvent = {
    time_seconds: 15,
    type: 'death',
    participant_id: 'human-1',
    participant_category: 'human',
    owner_role: 'victim',
    world_x: 50,
    world_y: 0,
    world_z: 50,
    map_u: 0.5,
    map_v: 0.5,
    source_category: null,
    target_category: null,
    metadata: {},
}

const lootEvent: TelemetryEvent = {
    ...deathEvent,
    time_seconds: 12,
    type: 'loot',
    owner_role: 'participant',
}

const match: MatchData = {
    match_id: 'match-a',
    date: '2026-02-10',
    map_id: 'AmbroseValley',
    duration_seconds: 20,
    participants: [
        {
            id: 'human-1',
            category: 'human',
        },
    ],
    tracks: [track],
    events: [
        lootEvent,
        deathEvent,
    ],
}

const mapRect = {
    x: 0,
    y: 0,
    width: 1000,
    height: 500,
}

describe('playback regression', () => {
    it.each([
        [0.5, 0.5],
        [1, 1],
        [2, 2],
        [4, 4],
    ] as const)(
        'advances one real second by %sx at %sx speed',
        (speed, expected) => {
            let state =
                createPlaybackState(20)
            state = {
                ...state,
                isPlaying: true,
            }
            state =
                setPlaybackSpeed(
                    state,
                    speed,
                )

            expect(
                advancePlayback(
                    state,
                    1,
                ).currentTime,
            ).toBe(expected)
        },
    )

    it('stops exactly at duration without overshooting', () => {
        const state = {
            ...createPlaybackState(20),
            currentTime: 19.75,
            isPlaying: true,
            playbackSpeed: 4 as const,
        }

        expect(
            advancePlayback(
                state,
                1,
            ),
        ).toEqual({
            currentTime: 20,
            duration: 20,
            isPlaying: false,
            playbackSpeed: 4,
        })
    })

    it('reverse seeking does not change the playing state', () => {
        const playing = {
            ...createPlaybackState(20),
            currentTime: 14,
            isPlaying: true,
        }
        const paused = {
            ...playing,
            isPlaying: false,
        }

        expect(
            seekPlayback(
                playing,
                6,
            ).isPlaying,
        ).toBe(true)

        expect(
            seekPlayback(
                paused,
                6,
            ).isPlaying,
        ).toBe(false)
    })

    it('keeps a late participant hidden until the first sample', () => {
        expect(
            getParticipantLifecycleAtTime(
                track,
                [],
                4.99,
            ),
        ).toMatchObject({
            status: 'not_started',
            visible: false,
            position: null,
        })

        expect(
            getParticipantLifecycleAtTime(
                track,
                [],
                5,
            ).visible,
        ).toBe(true)
    })

    it('hides a participant at the lifecycle-ending death time', () => {
        expect(
            getParticipantLifecycleAtTime(
                track,
                [deathEvent],
                14.99,
            ).visible,
        ).toBe(true)

        expect(
            getParticipantLifecycleAtTime(
                track,
                [deathEvent],
                15,
            ),
        ).toMatchObject({
            status: 'dead',
            visible: false,
            position: null,
        })
    })

    it('does not extrapolate beyond the final sample', () => {
        const snapshot =
            getParticipantLifecycleAtTime(
                track,
                [],
                100,
            )

        expect(snapshot.status).toBe(
            'last_known',
        )
        expect(snapshot.position).toBe(
            track.points.at(-1),
        )
    })

    it('makes an event visible at its timestamp and hides it again after reverse seek', () => {
        expect(
            isEventVisibleAtTime(
                lootEvent,
                11.99,
            ),
        ).toBe(false)

        expect(
            isEventVisibleAtTime(
                lootEvent,
                12,
            ),
        ).toBe(true)

        expect(
            isEventVisibleAtTime(
                lootEvent,
                18,
            ),
        ).toBe(true)

        expect(
            isEventVisibleAtTime(
                lootEvent,
                6,
            ),
        ).toBe(false)
    })

    it('keeps Phase 5 event category visibility active during playback', () => {
        const container = new Container()
        const renderer =
            new EventMarkerRenderer(
                container,
                () => {},
            )

        renderer.render(
            match,
            mapRect,
            {
                ...DEFAULT_VISUALIZATION_VISIBILITY,
                loot: false,
            },
            20,
        )

        const lootMarker =
            container.children[0]
        const deathMarker =
            container.children[1]

        expect(lootMarker?.visible).toBe(false)
        expect(deathMarker?.visible).toBe(true)

        renderer.clear()
        container.destroy()
    })

    it('keeps Phase 5 participant category visibility active during playback', () => {
        const container = new Container()
        const renderer =
            new ParticipantMarkerRenderer(
                container,
            )

        renderer.render(
            match,
            mapRect,
            {
                ...DEFAULT_VISUALIZATION_VISIBILITY,
                humans: false,
            },
            10,
        )

        expect(
            container.children[0]?.visible,
        ).toBe(false)

        renderer.clear()
        container.destroy()
    })

    it('resets a changed match session to zero, paused, and 1x', () => {
        const stored =
            createPlaybackSession(
                'match-a',
                20,
            )

        stored.state = {
            currentTime: 10,
            duration: 20,
            isPlaying: true,
            playbackSpeed: 4,
        }

        expect(
            resolvePlaybackSessionState(
                stored,
                'match-b',
                30,
            ),
        ).toEqual({
            currentTime: 0,
            duration: 30,
            isPlaying: false,
            playbackSpeed: 1,
        })
    })

    it('keeps dynamic playback graphics under the shared world root', () => {
        const layers =
            new VisualizationLayers()

        expect(
            layers.trajectories.parent,
        ).toBe(layers.root)
        expect(
            layers.participantMarkers.parent,
        ).toBe(layers.root)
        expect(
            layers.eventMarkers.parent,
        ).toBe(layers.root)

        layers.destroy()
    })

    it('retains playback renderer objects instead of recreating them on a time update', () => {
        const container = new Container()
        const renderer =
            new TrajectoryRenderer(container)

        renderer.render(
            match,
            mapRect,
            DEFAULT_VISUALIZATION_VISIBILITY,
            8,
        )

        const retained =
            container.children[0]

        renderer.render(
            match,
            mapRect,
            DEFAULT_VISUALIZATION_VISIBILITY,
            14,
        )

        expect(
            container.children[0],
        ).toBe(retained)

        renderer.clear()
        container.destroy()
    })
})
