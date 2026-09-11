import type { MatchSummary } from './types'

export interface FilterSelection {
    mapId: string
    date: string
    matchId: string
}

export function getAvailableMapIds(
    matches: readonly MatchSummary[],
): string[] {
    return uniqueSorted(matches.map((match) => match.map_id))
}

export function getAvailableDatesForMap(
    matches: readonly MatchSummary[],
    mapId: string,
): string[] {
    if (!mapId) {
        return []
    }

    return uniqueSorted(
        matches
            .filter((match) => match.map_id === mapId)
            .map((match) => match.date),
    )
}

export function getAvailableMatches(
    matches: readonly MatchSummary[],
    mapId: string,
    date: string,
): MatchSummary[] {
    if (!mapId || !date) {
        return []
    }

    return matches
        .filter(
            (match) =>
                match.map_id === mapId &&
                match.date === date,
        )
        .slice()
        .sort((a, b) => a.match_id.localeCompare(b.match_id))
}

export function getInitialFilterSelection(
    matches: readonly MatchSummary[],
): FilterSelection {
    const mapId = getAvailableMapIds(matches)[0] ?? ''
    const date = getAvailableDatesForMap(matches, mapId)[0] ?? ''
    const matchId =
        getAvailableMatches(matches, mapId, date)[0]?.match_id ?? ''

    return {
        mapId,
        date,
        matchId,
    }
}

export function reconcileFilterSelection(
    matches: readonly MatchSummary[],
    selection: FilterSelection,
): FilterSelection {
    const availableMapIds = getAvailableMapIds(matches)

    const mapId = availableMapIds.includes(selection.mapId)
        ? selection.mapId
        : (availableMapIds[0] ?? '')

    const availableDates = getAvailableDatesForMap(matches, mapId)

    const date = availableDates.includes(selection.date)
        ? selection.date
        : (availableDates[0] ?? '')

    const availableMatches = getAvailableMatches(matches, mapId, date)

    const matchId = availableMatches.some(
        (match) => match.match_id === selection.matchId,
    )
        ? selection.matchId
        : (availableMatches[0]?.match_id ?? '')

    return {
        mapId,
        date,
        matchId,
    }
}

export function updateMapSelection(
    matches: readonly MatchSummary[],
    currentSelection: FilterSelection,
    nextMapId: string,
): FilterSelection {
    return reconcileFilterSelection(matches, {
        ...currentSelection,
        mapId: nextMapId,
        date: '',
        matchId: '',
    })
}

export function updateDateSelection(
    matches: readonly MatchSummary[],
    currentSelection: FilterSelection,
    nextDate: string,
): FilterSelection {
    return reconcileFilterSelection(matches, {
        ...currentSelection,
        date: nextDate,
        matchId: '',
    })
}

export function updateMatchSelection(
    matches: readonly MatchSummary[],
    currentSelection: FilterSelection,
    nextMatchId: string,
): FilterSelection {
    return reconcileFilterSelection(matches, {
        ...currentSelection,
        matchId: nextMatchId,
    })
}

function uniqueSorted(values: readonly string[]): string[] {
    return [...new Set(values)].sort((a, b) =>
        a.localeCompare(b),
    )
}
