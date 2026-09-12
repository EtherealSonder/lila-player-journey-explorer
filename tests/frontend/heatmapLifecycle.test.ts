import {
    describe,
    expect,
    it,
} from 'vitest'

import {
    shouldRecalculateHeatmap,
} from '../../src/visualization/heatmap/heatmapLifecycle'
import type {
    MatchData,
} from '../../src/telemetry/types'

function createMatch(
    matchId: string,
): MatchData {
    return {
        match_id: matchId,
        date: '2026-02-13',
        map_id: 'ambrose_valley',
        duration_seconds: 100,
        participants: [],
        tracks: [],
        events: [],
    }
}

describe(
    'heatmap calculation lifecycle',
    () => {
        it(
            'does not recalculate when match identity and mode are unchanged',
            () => {
                const match =
                    createMatch('match-a')

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

        it(
            'recalculates when the loaded match object changes',
            () => {
                const previousMatch =
                    createMatch('match-a')
                const nextMatch =
                    createMatch('match-b')

                expect(
                    shouldRecalculateHeatmap(
                        {
                            matchData:
                                previousMatch,
                            mode: 'traffic',
                        },
                        {
                            matchData:
                                nextMatch,
                            mode: 'traffic',
                        },
                    ),
                ).toBe(true)
            },
        )

        it(
            'recalculates when the selected heatmap mode changes',
            () => {
                const match =
                    createMatch('match-a')

                expect(
                    shouldRecalculateHeatmap(
                        {
                            matchData: match,
                            mode: 'traffic',
                        },
                        {
                            matchData: match,
                            mode: 'kills',
                        },
                    ),
                ).toBe(true)
            },
        )

        it(
            'treats clearing and loading match data as calculation changes',
            () => {
                const match =
                    createMatch('match-a')

                expect(
                    shouldRecalculateHeatmap(
                        {
                            matchData: match,
                            mode: 'traffic',
                        },
                        {
                            matchData: null,
                            mode: 'traffic',
                        },
                    ),
                ).toBe(true)

                expect(
                    shouldRecalculateHeatmap(
                        {
                            matchData: null,
                            mode: 'traffic',
                        },
                        {
                            matchData: match,
                            mode: 'traffic',
                        },
                    ),
                ).toBe(true)
            },
        )
    },
)
