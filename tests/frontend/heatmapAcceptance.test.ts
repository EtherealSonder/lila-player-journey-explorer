import {
    describe,
    expect,
    it,
} from 'vitest'

import type {
    MatchData,
    TelemetryEvent,
} from '../../src/telemetry/types'
import {
    buildHeatmapGridForMatch,
    getHeatmapPointsForMode,
} from '../../src/visualization/heatmap/heatmapPipeline'
import {
    shouldRecalculateHeatmap,
} from '../../src/visualization/heatmap/heatmapLifecycle'
import {
    HEATMAP_MODES,
} from '../../src/visualization/heatmap/heatmapDefinitions'

function makeEvent(
    overrides: Partial<TelemetryEvent>,
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
        map_u: 0.5,
        map_v: 0.5,
        source_category: 'human',
        target_category: 'bot',
        metadata: {},
        ...overrides,
    }
}

function makeMatch(): MatchData {
    return {
        match_id: 'phase-7j-validation',
        date: '2026-02-13',
        map_id: 'ambrose_valley',
        duration_seconds: 300,
        participants: [],
        tracks: [
            {
                participant_id: 'p1',
                points: [
                    {
                        time_seconds: 0,
                        world_x: 0,
                        world_y: 0,
                        world_z: 0,
                        map_u: 0.10,
                        map_v: 0.10,
                    },
                    {
                        time_seconds: 1,
                        world_x: 1,
                        world_y: 0,
                        world_z: 0,
                        map_u: 0.10,
                        map_v: 0.10,
                    },
                    {
                        time_seconds: 2,
                        world_x: 2,
                        world_y: 0,
                        world_z: 0,
                        map_u: 0.50,
                        map_v: 0.50,
                    },
                ],
            },
        ],
        events: [
            makeEvent({
                type: 'kill',
                owner_role: 'killer',
                map_u: 0.20,
                map_v: 0.20,
            }),
            makeEvent({
                type: 'kill',
                owner_role: 'killer',
                map_u: 0.20,
                map_v: 0.20,
            }),
            makeEvent({
                type: 'death',
                owner_role: 'victim',
                map_u: 0.70,
                map_v: 0.70,
            }),
            makeEvent({
                type: 'storm_death',
                owner_role: 'victim',
                map_u: 0.80,
                map_v: 0.80,
            }),
            makeEvent({
                type: 'loot',
                owner_role: 'participant',
                map_u: 0.90,
                map_v: 0.90,
            }),
        ],
    }
}

describe(
    'Phase 7J heatmap acceptance validation',
    () => {
        it(
            'supports exactly the four mutually exclusive heatmap modes',
            () => {
                expect(HEATMAP_MODES).toEqual([
                    'none',
                    'traffic',
                    'kills',
                    'deaths',
                ])
            },
        )

        it(
            'routes none mode to no source records',
            () => {
                expect(
                    getHeatmapPointsForMode(
                        makeMatch(),
                        'none',
                    ),
                ).toEqual([])
            },
        )

        it(
            'uses all valid trajectory samples for traffic',
            () => {
                expect(
                    getHeatmapPointsForMode(
                        makeMatch(),
                        'traffic',
                    ),
                ).toHaveLength(3)
            },
        )

        it(
            'uses only killer-side kill events for kills',
            () => {
                const points =
                    getHeatmapPointsForMode(
                        makeMatch(),
                        'kills',
                    )

                expect(points).toHaveLength(2)
                expect(points).toEqual([
                    {
                        map_u: 0.20,
                        map_v: 0.20,
                    },
                    {
                        map_u: 0.20,
                        map_v: 0.20,
                    },
                ])
            },
        )

        it(
            'uses only victim-side regular deaths and excludes storm deaths',
            () => {
                const points =
                    getHeatmapPointsForMode(
                        makeMatch(),
                        'deaths',
                    )

                expect(points).toEqual([
                    {
                        map_u: 0.70,
                        map_v: 0.70,
                    },
                ])
            },
        )

        it(
            'produces the expected traffic hotspot count',
            () => {
                const grid =
                    buildHeatmapGridForMatch(
                        makeMatch(),
                        'traffic',
                        10,
                        10,
                    )

                expect(grid.maxCount).toBe(2)

                const hottest =
                    grid.cells.find(
                        (cell) =>
                            cell.x === 1 &&
                            cell.y === 1,
                    )

                expect(hottest?.count).toBe(2)
                expect(
                    hottest?.intensity,
                ).toBe(1)
            },
        )

        it(
            'produces the expected kill hotspot count',
            () => {
                const grid =
                    buildHeatmapGridForMatch(
                        makeMatch(),
                        'kills',
                        10,
                        10,
                    )

                expect(grid.maxCount).toBe(2)
                expect(grid.cells).toHaveLength(1)
                expect(grid.cells[0]?.count).toBe(2)
                expect(
                    grid.cells[0]?.intensity,
                ).toBe(1)
            },
        )

        it(
            'keeps match-local normalization independent between modes',
            () => {
                const match =
                    makeMatch()

                const traffic =
                    buildHeatmapGridForMatch(
                        match,
                        'traffic',
                        10,
                        10,
                    )
                const kills =
                    buildHeatmapGridForMatch(
                        match,
                        'kills',
                        10,
                        10,
                    )
                const deaths =
                    buildHeatmapGridForMatch(
                        match,
                        'deaths',
                        10,
                        10,
                    )

                expect(traffic.maxCount).toBe(2)
                expect(kills.maxCount).toBe(2)
                expect(deaths.maxCount).toBe(1)

                expect(
                    Math.max(
                        ...traffic.cells.map(
                            (cell) =>
                                cell.intensity,
                        ),
                    ),
                ).toBe(1)

                expect(
                    Math.max(
                        ...kills.cells.map(
                            (cell) =>
                                cell.intensity,
                        ),
                    ),
                ).toBe(1)

                expect(
                    Math.max(
                        ...deaths.cells.map(
                            (cell) =>
                                cell.intensity,
                        ),
                    ),
                ).toBe(1)
            },
        )

        it(
            'does not mutate the source match during heatmap generation',
            () => {
                const match =
                    makeMatch()
                const before =
                    structuredClone(match)

                buildHeatmapGridForMatch(
                    match,
                    'traffic',
                )
                buildHeatmapGridForMatch(
                    match,
                    'kills',
                )
                buildHeatmapGridForMatch(
                    match,
                    'deaths',
                )

                expect(match).toEqual(before)
            },
        )

        it(
            'keeps playback outside the heatmap calculation lifecycle',
            () => {
                const match =
                    makeMatch()

                expect(
                    shouldRecalculateHeatmap(
                        {
                            matchData: match,
                            mode: 'traffic',
                        },
                        {
                            matchData: match,
                            mode: 'traffic',
                        },
                    ),
                ).toBe(false)
            },
        )
    },
)
