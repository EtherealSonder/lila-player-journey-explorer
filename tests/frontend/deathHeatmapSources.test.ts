import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    getDeathHeatmapPoints,
} from '../../src/visualization/heatmap/heatmapSources'
import type {
    MatchData,
    TelemetryEvent,
} from '../../src/telemetry/types'

function event(
    overrides: Partial<TelemetryEvent> = {},
): TelemetryEvent {
    return {
        time_seconds: 10,
        type: 'death',
        participant_id: 'p2',
        participant_category: 'human',
        owner_role: 'victim',
        world_x: 10,
        world_y: 0,
        world_z: 20,
        map_u: 0.25,
        map_v: 0.5,
        source_category: 'human',
        target_category: 'bot',
        metadata: {},
        ...overrides,
    }
}

function createMatch(
    events: TelemetryEvent[],
): MatchData {
    return {
        match_id: 'match-deaths',
        date: '2026-02-10',
        map_id: 'AmbroseValley',
        duration_seconds: 120,
        participants: [],
        tracks: [],
        events,
    }
}

describe('death heatmap source extraction', () => {
    it('extracts victim-side death locations', () => {
        const match =
            createMatch([
                event({
                    map_u: 0.1,
                    map_v: 0.2,
                }),
                event({
                    time_seconds: 20,
                    map_u: 0.7,
                    map_v: 0.8,
                }),
            ])

        expect(
            getDeathHeatmapPoints(
                match,
            ),
        ).toEqual([
            {
                map_u: 0.1,
                map_v: 0.2,
            },
            {
                map_u: 0.7,
                map_v: 0.8,
            },
        ])
    })

    it('explicitly excludes storm deaths from the general death heatmap', () => {
        const match =
            createMatch([
                event({
                    type: 'death',
                    owner_role: 'victim',
                    map_u: 0.2,
                    map_v: 0.3,
                }),
                event({
                    type: 'storm_death',
                    owner_role: 'victim',
                    map_u: 0.4,
                    map_v: 0.5,
                }),
            ])

        expect(
            getDeathHeatmapPoints(
                match,
            ),
        ).toEqual([
            {
                map_u: 0.2,
                map_v: 0.3,
            },
        ])
    })

    it('requires both death type and victim owner role', () => {
        const match =
            createMatch([
                event({
                    type: 'death',
                    owner_role: 'victim',
                    map_u: 0.1,
                    map_v: 0.1,
                }),
                event({
                    type: 'death',
                    owner_role: 'killer',
                    map_u: 0.2,
                    map_v: 0.2,
                }),
                event({
                    type: 'kill',
                    owner_role: 'victim',
                    map_u: 0.3,
                    map_v: 0.3,
                }),
                event({
                    type: 'storm_death',
                    owner_role: 'victim',
                    map_u: 0.4,
                    map_v: 0.4,
                }),
                event({
                    type: 'loot',
                    owner_role: 'participant',
                    map_u: 0.5,
                    map_v: 0.5,
                }),
            ])

        expect(
            getDeathHeatmapPoints(
                match,
            ),
        ).toEqual([
            {
                map_u: 0.1,
                map_v: 0.1,
            },
        ])
    })

    it('keeps normalized edge coordinates at zero and one', () => {
        const match =
            createMatch([
                event({
                    map_u: 0,
                    map_v: 0,
                }),
                event({
                    map_u: 1,
                    map_v: 1,
                }),
            ])

        expect(
            getDeathHeatmapPoints(
                match,
            ),
        ).toEqual([
            {
                map_u: 0,
                map_v: 0,
            },
            {
                map_u: 1,
                map_v: 1,
            },
        ])
    })

    it('ignores invalid normalized death coordinates', () => {
        const match =
            createMatch([
                event({
                    map_u: 0.5,
                    map_v: 0.5,
                }),
                event({
                    map_u: -0.1,
                }),
                event({
                    map_u: 1.1,
                }),
                event({
                    map_u: Number.NaN,
                }),
                event({
                    map_v:
                        Number.POSITIVE_INFINITY,
                }),
            ])

        expect(
            getDeathHeatmapPoints(
                match,
            ),
        ).toEqual([
            {
                map_u: 0.5,
                map_v: 0.5,
            },
        ])
    })

    it('returns an empty list when no victim-side deaths exist', () => {
        const match =
            createMatch([
                event({
                    type: 'kill',
                    owner_role: 'killer',
                }),
                event({
                    type: 'storm_death',
                    owner_role: 'victim',
                }),
                event({
                    type: 'loot',
                    owner_role: 'participant',
                }),
            ])

        expect(
            getDeathHeatmapPoints(
                match,
            ),
        ).toEqual([])
    })

    it('does not inspect participant tracks', () => {
        const match =
            createMatch([
                event({
                    map_u: 0.6,
                    map_v: 0.7,
                }),
            ])

        match.tracks = [
            {
                participant_id: 'p1',
                points: [
                    {
                        time_seconds: 0,
                        world_x: 0,
                        world_y: 0,
                        world_z: 0,
                        map_u: 0.9,
                        map_v: 0.9,
                    },
                ],
            },
        ]

        expect(
            getDeathHeatmapPoints(
                match,
            ),
        ).toEqual([
            {
                map_u: 0.6,
                map_v: 0.7,
            },
        ])
    })

    it('does not mutate MatchData or its event records', () => {
        const match =
            createMatch([
                event({
                    map_u: 0.15,
                    map_v: 0.25,
                }),
            ])

        const snapshot =
            structuredClone(match)

        getDeathHeatmapPoints(
            match,
        )

        expect(match).toEqual(
            snapshot,
        )
    })

    it('returns detached HeatmapPoint objects', () => {
        const sourceEvent =
            event({
                map_u: 0.4,
                map_v: 0.6,
            })

        const match =
            createMatch([
                sourceEvent,
            ])

        const result =
            getDeathHeatmapPoints(
                match,
            )

        expect(result[0]).not.toBe(
            sourceEvent,
        )

        expect(result[0]).toEqual({
            map_u: 0.4,
            map_v: 0.6,
        })
    })
})
