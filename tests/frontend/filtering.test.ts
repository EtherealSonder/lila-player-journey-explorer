import { describe, expect, it } from 'vitest'

import type { MatchSummary } from '../../src/telemetry/types'
import {
    getAvailableDatesForMap,
    getAvailableMapIds,
    getAvailableMatches,
    getInitialFilterSelection,
    reconcileFilterSelection,
    updateDateSelection,
    updateMapSelection,
    updateMatchSelection,
} from '../../src/telemetry/filtering'

function makeMatch(
    matchId: string,
    mapId: string,
    date: string,
): MatchSummary {
    return {
        match_id: matchId,
        date,
        map_id: mapId,
        duration_seconds: 100,
        participant_count: 1,
        human_count: 1,
        bot_count: 0,
        event_counts: {
            kill: 0,
            death: 0,
            storm_death: 0,
            loot: 0,
        },
    }
}

const MATCHES: MatchSummary[] = [
    makeMatch('ambrose-b', 'AmbroseValley', '2026-02-11'),
    makeMatch('ambrose-a', 'AmbroseValley', '2026-02-10'),
    makeMatch('ambrose-c', 'AmbroseValley', '2026-02-10'),
    makeMatch('grand-a', 'GrandRift', '2026-02-12'),
    makeMatch('lockdown-a', 'Lockdown', '2026-02-10'),
    makeMatch('lockdown-b', 'Lockdown', '2026-02-14'),
]

describe('hierarchical telemetry filtering', () => {
    it('returns unique sorted map IDs', () => {
        expect(getAvailableMapIds(MATCHES)).toEqual([
            'AmbroseValley',
            'GrandRift',
            'Lockdown',
        ])
    })

    it('returns only dates that exist for the selected map', () => {
        expect(
            getAvailableDatesForMap(
                MATCHES,
                'AmbroseValley',
            ),
        ).toEqual([
            '2026-02-10',
            '2026-02-11',
        ])

        expect(
            getAvailableDatesForMap(
                MATCHES,
                'GrandRift',
            ),
        ).toEqual([
            '2026-02-12',
        ])
    })

    it('returns only matches that satisfy both map and date', () => {
        expect(
            getAvailableMatches(
                MATCHES,
                'AmbroseValley',
                '2026-02-10',
            ).map((match) => match.match_id),
        ).toEqual([
            'ambrose-a',
            'ambrose-c',
        ])
    })

    it('creates the first valid hierarchical selection', () => {
        expect(getInitialFilterSelection(MATCHES)).toEqual({
            mapId: 'AmbroseValley',
            date: '2026-02-10',
            matchId: 'ambrose-a',
        })
    })

    it('resets date and match when the selected map changes', () => {
        const result = updateMapSelection(
            MATCHES,
            {
                mapId: 'AmbroseValley',
                date: '2026-02-11',
                matchId: 'ambrose-b',
            },
            'Lockdown',
        )

        expect(result).toEqual({
            mapId: 'Lockdown',
            date: '2026-02-10',
            matchId: 'lockdown-a',
        })
    })

    it('resets match when the selected date changes', () => {
        const result = updateDateSelection(
            MATCHES,
            {
                mapId: 'Lockdown',
                date: '2026-02-10',
                matchId: 'lockdown-a',
            },
            '2026-02-14',
        )

        expect(result).toEqual({
            mapId: 'Lockdown',
            date: '2026-02-14',
            matchId: 'lockdown-b',
        })
    })

    it('preserves a valid selected match', () => {
        const result = reconcileFilterSelection(
            MATCHES,
            {
                mapId: 'AmbroseValley',
                date: '2026-02-10',
                matchId: 'ambrose-c',
            },
        )

        expect(result).toEqual({
            mapId: 'AmbroseValley',
            date: '2026-02-10',
            matchId: 'ambrose-c',
        })
    })

    it('repairs an invalid downstream match without changing valid upstream filters', () => {
        const result = reconcileFilterSelection(
            MATCHES,
            {
                mapId: 'AmbroseValley',
                date: '2026-02-10',
                matchId: 'lockdown-a',
            },
        )

        expect(result).toEqual({
            mapId: 'AmbroseValley',
            date: '2026-02-10',
            matchId: 'ambrose-a',
        })
    })

    it('ignores an invalid direct match change and keeps the selection valid', () => {
        const result = updateMatchSelection(
            MATCHES,
            {
                mapId: 'AmbroseValley',
                date: '2026-02-10',
                matchId: 'ambrose-c',
            },
            'grand-a',
        )

        expect(result).toEqual({
            mapId: 'AmbroseValley',
            date: '2026-02-10',
            matchId: 'ambrose-a',
        })
    })

    it('returns empty selections when no matches exist', () => {
        expect(getInitialFilterSelection([])).toEqual({
            mapId: '',
            date: '',
            matchId: '',
        })

        expect(
            reconcileFilterSelection([], {
                mapId: 'AmbroseValley',
                date: '2026-02-10',
                matchId: 'ambrose-a',
            }),
        ).toEqual({
            mapId: '',
            date: '',
            matchId: '',
        })
    })
})
