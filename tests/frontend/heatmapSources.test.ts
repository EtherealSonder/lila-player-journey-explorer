import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    getTrafficHeatmapPoints,
} from '../../src/visualization/heatmap/heatmapSources'
import type {
    MatchData,
    TelemetryPoint,
} from '../../src/telemetry/types'

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

function createMatch(
    tracks: MatchData['tracks'],
): MatchData {
    return {
        match_id: 'match-traffic',
        date: '2026-02-10',
        map_id: 'AmbroseValley',
        duration_seconds: 120,
        participants: tracks.map(
            (track, index) => ({
                id: track.participant_id,
                category:
                    index % 2 === 0
                        ? 'human'
                        : 'bot',
            }),
        ),
        tracks,
        events: [],
    }
}

describe('traffic heatmap source extraction', () => {
    it('extracts every valid normalized trajectory sample', () => {
        const match =
            createMatch([
                {
                    participant_id: 'p1',
                    points: [
                        point(0, 0.1, 0.2),
                        point(1, 0.2, 0.3),
                    ],
                },
                {
                    participant_id: 'p2',
                    points: [
                        point(0, 0.7, 0.8),
                    ],
                },
            ])

        expect(
            getTrafficHeatmapPoints(
                match,
            ),
        ).toEqual([
            {
                map_u: 0.1,
                map_v: 0.2,
            },
            {
                map_u: 0.2,
                map_v: 0.3,
            },
            {
                map_u: 0.7,
                map_v: 0.8,
            },
        ])
    })

    it('preserves track and sample order', () => {
        const match =
            createMatch([
                {
                    participant_id: 'first',
                    points: [
                        point(0, 0.4, 0.1),
                        point(2, 0.5, 0.2),
                    ],
                },
                {
                    participant_id: 'second',
                    points: [
                        point(1, 0.6, 0.3),
                    ],
                },
            ])

        expect(
            getTrafficHeatmapPoints(
                match,
            ),
        ).toEqual([
            {
                map_u: 0.4,
                map_v: 0.1,
            },
            {
                map_u: 0.5,
                map_v: 0.2,
            },
            {
                map_u: 0.6,
                map_v: 0.3,
            },
        ])
    })

    it('does not downsample repeated or dense samples', () => {
        const repeated = [
            point(0, 0.25, 0.25),
            point(1, 0.25, 0.25),
            point(2, 0.25, 0.25),
            point(3, 0.25, 0.25),
        ]

        const match =
            createMatch([
                {
                    participant_id: 'p1',
                    points: repeated,
                },
            ])

        expect(
            getTrafficHeatmapPoints(
                match,
            ),
        ).toHaveLength(4)
    })

    it('returns an empty list for a match with no tracks', () => {
        const match =
            createMatch([])

        expect(
            getTrafficHeatmapPoints(
                match,
            ),
        ).toEqual([])
    })

    it('handles empty participant tracks safely', () => {
        const match =
            createMatch([
                {
                    participant_id: 'p1',
                    points: [],
                },
            ])

        expect(
            getTrafficHeatmapPoints(
                match,
            ),
        ).toEqual([])
    })

    it('keeps normalized edge coordinates at zero and one', () => {
        const match =
            createMatch([
                {
                    participant_id: 'p1',
                    points: [
                        point(0, 0, 0),
                        point(1, 1, 1),
                    ],
                },
            ])

        expect(
            getTrafficHeatmapPoints(
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

    it('ignores invalid normalized trajectory coordinates', () => {
        const match =
            createMatch([
                {
                    participant_id: 'p1',
                    points: [
                        point(0, 0.5, 0.5),
                        point(1, -0.1, 0.5),
                        point(2, 1.1, 0.5),
                        point(
                            3,
                            Number.NaN,
                            0.5,
                        ),
                        point(
                            4,
                            0.5,
                            Number.POSITIVE_INFINITY,
                        ),
                    ],
                },
            ])

        expect(
            getTrafficHeatmapPoints(
                match,
            ),
        ).toEqual([
            {
                map_u: 0.5,
                map_v: 0.5,
            },
        ])
    })

    it('does not inspect or include events', () => {
        const match =
            createMatch([
                {
                    participant_id: 'p1',
                    points: [
                        point(0, 0.2, 0.3),
                    ],
                },
            ])

        match.events = [
            {
                time_seconds: 10,
                type: 'kill',
                participant_id: 'p1',
                participant_category: 'human',
                owner_role: 'killer',
                world_x: 999,
                world_y: 0,
                world_z: 999,
                map_u: 0.9,
                map_v: 0.9,
                source_category: 'human',
                target_category: 'bot',
                metadata: {},
            },
        ]

        expect(
            getTrafficHeatmapPoints(
                match,
            ),
        ).toEqual([
            {
                map_u: 0.2,
                map_v: 0.3,
            },
        ])
    })

    it('does not mutate MatchData, tracks, or telemetry points', () => {
        const match =
            createMatch([
                {
                    participant_id: 'p1',
                    points: [
                        point(0, 0.1, 0.2),
                        point(1, 0.3, 0.4),
                    ],
                },
            ])

        const snapshot =
            structuredClone(match)

        getTrafficHeatmapPoints(
            match,
        )

        expect(match).toEqual(
            snapshot,
        )
    })

    it('returns new HeatmapPoint objects instead of source TelemetryPoint references', () => {
        const sourcePoint =
            point(0, 0.1, 0.2)

        const match =
            createMatch([
                {
                    participant_id: 'p1',
                    points: [
                        sourcePoint,
                    ],
                },
            ])

        const result =
            getTrafficHeatmapPoints(
                match,
            )

        expect(result[0]).not.toBe(
            sourcePoint,
        )

        expect(result[0]).toEqual({
            map_u: 0.1,
            map_v: 0.2,
        })
    })
})
