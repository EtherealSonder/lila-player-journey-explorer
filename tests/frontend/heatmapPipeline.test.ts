import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    buildHeatmapGridForMatch,
    getHeatmapPointsForMode,
} from '../../src/visualization/heatmap/heatmapPipeline'
import type {
    MatchData,
    ParticipantTrack,
    TelemetryEvent,
} from '../../src/telemetry/types'

function track(
    participantId: string,
    points: Array<{
        map_u: number
        map_v: number
    }>,
): ParticipantTrack {
    return {
        participant_id:
            participantId,
        points: points.map(
            (
                point,
                index,
            ) => ({
                time_seconds:
                    index,
                world_x: 0,
                world_y: 0,
                world_z: 0,
                map_u:
                    point.map_u,
                map_v:
                    point.map_v,
            }),
        ),
    }
}

function event(
    overrides: Partial<TelemetryEvent> = {},
): TelemetryEvent {
    return {
        time_seconds: 10,
        type: 'kill',
        participant_id: 'p1',
        participant_category: 'human',
        owner_role: 'killer',
        world_x: 0,
        world_y: 0,
        world_z: 0,
        map_u: 0.25,
        map_v: 0.25,
        source_category: 'human',
        target_category: 'bot',
        metadata: {},
        ...overrides,
    }
}

function match(
    overrides: Partial<MatchData> = {},
): MatchData {
    return {
        match_id:
            'match-1',
        date:
            '2026-02-10',
        map_id:
            'AmbroseValley',
        duration_seconds:
            120,
        participants:
            [],
        tracks:
            [],
        events:
            [],
        ...overrides,
    }
}

describe(
    'match-local heatmap pipeline',
    () => {
        it(
            'routes each heatmap mode to its intended source',
            () => {
                const data =
                    match({
                        tracks: [
                            track(
                                'p1',
                                [
                                    {
                                        map_u:
                                            0.1,
                                        map_v:
                                            0.2,
                                    },
                                ],
                            ),
                        ],
                        events: [
                            event({
                                type:
                                    'kill',
                                owner_role:
                                    'killer',
                                map_u:
                                    0.3,
                                map_v:
                                    0.4,
                            }),
                            event({
                                type:
                                    'death',
                                owner_role:
                                    'victim',
                                map_u:
                                    0.5,
                                map_v:
                                    0.6,
                            }),
                            event({
                                type:
                                    'storm_death',
                                owner_role:
                                    'victim',
                                map_u:
                                    0.7,
                                map_v:
                                    0.8,
                            }),
                        ],
                    })

                expect(
                    getHeatmapPointsForMode(
                        data,
                        'traffic',
                    ),
                ).toEqual([
                    {
                        map_u:
                            0.1,
                        map_v:
                            0.2,
                    },
                ])

                expect(
                    getHeatmapPointsForMode(
                        data,
                        'kills',
                    ),
                ).toEqual([
                    {
                        map_u:
                            0.3,
                        map_v:
                            0.4,
                    },
                ])

                expect(
                    getHeatmapPointsForMode(
                        data,
                        'deaths',
                    ),
                ).toEqual([
                    {
                        map_u:
                            0.5,
                        map_v:
                            0.6,
                    },
                ])

                expect(
                    getHeatmapPointsForMode(
                        data,
                        'none',
                    ),
                ).toEqual([])
            },
        )

        it(
            'normalizes intensity against the selected match only',
            () => {
                const matchA =
                    match({
                        match_id:
                            'match-a',
                        tracks: [
                            track(
                                'p1',
                                [
                                    {
                                        map_u:
                                            0.1,
                                        map_v:
                                            0.1,
                                    },
                                    {
                                        map_u:
                                            0.1,
                                        map_v:
                                            0.1,
                                    },
                                    {
                                        map_u:
                                            0.8,
                                        map_v:
                                            0.8,
                                    },
                                ],
                            ),
                        ],
                    })

                const matchB =
                    match({
                        match_id:
                            'match-b',
                        tracks: [
                            track(
                                'p2',
                                [
                                    {
                                        map_u:
                                            0.2,
                                        map_v:
                                            0.2,
                                    },
                                    {
                                        map_u:
                                            0.2,
                                        map_v:
                                            0.2,
                                    },
                                    {
                                        map_u:
                                            0.2,
                                        map_v:
                                            0.2,
                                    },
                                    {
                                        map_u:
                                            0.9,
                                        map_v:
                                            0.9,
                                    },
                                ],
                            ),
                        ],
                    })

                const gridA =
                    buildHeatmapGridForMatch(
                        matchA,
                        'traffic',
                        10,
                        10,
                    )

                const gridB =
                    buildHeatmapGridForMatch(
                        matchB,
                        'traffic',
                        10,
                        10,
                    )

                expect(
                    gridA.maxCount,
                ).toBe(2)

                expect(
                    gridB.maxCount,
                ).toBe(3)

                expect(
                    Math.max(
                        ...gridA.cells.map(
                            (
                                cell,
                            ) =>
                                cell.intensity,
                        ),
                    ),
                ).toBe(1)

                expect(
                    Math.max(
                        ...gridB.cells.map(
                            (
                                cell,
                            ) =>
                                cell.intensity,
                        ),
                    ),
                ).toBe(1)
            },
        )

        it(
            'normalizes each heatmap mode independently within the same match',
            () => {
                const data =
                    match({
                        tracks: [
                            track(
                                'p1',
                                [
                                    {
                                        map_u:
                                            0.1,
                                        map_v:
                                            0.1,
                                    },
                                    {
                                        map_u:
                                            0.1,
                                        map_v:
                                            0.1,
                                    },
                                    {
                                        map_u:
                                            0.1,
                                        map_v:
                                            0.1,
                                    },
                                ],
                            ),
                        ],
                        events: [
                            event({
                                type:
                                    'kill',
                                owner_role:
                                    'killer',
                                map_u:
                                    0.2,
                                map_v:
                                    0.2,
                            }),
                            event({
                                type:
                                    'death',
                                owner_role:
                                    'victim',
                                map_u:
                                    0.3,
                                map_v:
                                    0.3,
                            }),
                            event({
                                type:
                                    'death',
                                owner_role:
                                    'victim',
                                map_u:
                                    0.3,
                                map_v:
                                    0.3,
                            }),
                        ],
                    })

                const traffic =
                    buildHeatmapGridForMatch(
                        data,
                        'traffic',
                        10,
                        10,
                    )

                const kills =
                    buildHeatmapGridForMatch(
                        data,
                        'kills',
                        10,
                        10,
                    )

                const deaths =
                    buildHeatmapGridForMatch(
                        data,
                        'deaths',
                        10,
                        10,
                    )

                expect(
                    traffic.maxCount,
                ).toBe(3)

                expect(
                    kills.maxCount,
                ).toBe(1)

                expect(
                    deaths.maxCount,
                ).toBe(2)

                expect(
                    traffic.cells[0]
                        .intensity,
                ).toBe(1)

                expect(
                    kills.cells[0]
                        .intensity,
                ).toBe(1)

                expect(
                    deaths.cells[0]
                        .intensity,
                ).toBe(1)
            },
        )

        it(
            'uses linear count-over-maxCount normalization',
            () => {
                const data =
                    match({
                        tracks: [
                            track(
                                'p1',
                                [
                                    {
                                        map_u:
                                            0.1,
                                        map_v:
                                            0.1,
                                    },
                                    {
                                        map_u:
                                            0.1,
                                        map_v:
                                            0.1,
                                    },
                                    {
                                        map_u:
                                            0.1,
                                        map_v:
                                            0.1,
                                    },
                                    {
                                        map_u:
                                            0.1,
                                        map_v:
                                            0.1,
                                    },
                                    {
                                        map_u:
                                            0.8,
                                        map_v:
                                            0.8,
                                    },
                                    {
                                        map_u:
                                            0.8,
                                        map_v:
                                            0.8,
                                    },
                                ],
                            ),
                        ],
                    })

                const grid =
                    buildHeatmapGridForMatch(
                        data,
                        'traffic',
                        10,
                        10,
                    )

                expect(
                    grid.maxCount,
                ).toBe(4)

                const intensities =
                    grid.cells
                        .map(
                            (
                                cell,
                            ) =>
                                cell.intensity,
                        )
                        .sort(
                            (
                                a,
                                b,
                            ) => a - b,
                        )

                expect(
                    intensities,
                ).toEqual([
                    0.5,
                    1,
                ])
            },
        )

        it(
            'returns a safe empty grid for none mode',
            () => {
                const grid =
                    buildHeatmapGridForMatch(
                        match(),
                        'none',
                    )

                expect(
                    grid,
                ).toEqual({
                    columns:
                        64,
                    rows:
                        64,
                    maxCount:
                        0,
                    cells:
                        [],
                })
            },
        )

        it(
            'returns a safe empty grid when the selected source has no points',
            () => {
                const grid =
                    buildHeatmapGridForMatch(
                        match(),
                        'kills',
                        8,
                        8,
                    )

                expect(
                    grid,
                ).toEqual({
                    columns:
                        8,
                    rows:
                        8,
                    maxCount:
                        0,
                    cells:
                        [],
                })
            },
        )

        it(
            'does not mutate the selected match while building a grid',
            () => {
                const data =
                    match({
                        tracks: [
                            track(
                                'p1',
                                [
                                    {
                                        map_u:
                                            0.2,
                                        map_v:
                                            0.2,
                                    },
                                ],
                            ),
                        ],
                    })

                const snapshot =
                    structuredClone(
                        data,
                    )

                buildHeatmapGridForMatch(
                    data,
                    'traffic',
                    8,
                    8,
                )

                expect(data).toEqual(
                    snapshot,
                )
            },
        )
    },
)
