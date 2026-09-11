import type {
    ManifestPayload,
    MapsPayload,
    MatchData,
} from './types'

const matchCache = new Map<string, Promise<MatchData>>()

export async function loadManifest(): Promise<ManifestPayload> {
    return fetchJson<ManifestPayload>(
        '/data/manifest.json',
        'manifest',
    )
}

export async function loadMaps(): Promise<MapsPayload> {
    return fetchJson<MapsPayload>(
        '/data/maps.json',
        'map registry',
    )
}

export function loadMatch(matchId: string): Promise<MatchData> {
    const normalizedMatchId = matchId.trim()

    if (!normalizedMatchId) {
        return Promise.reject(
            new Error('Cannot load a match without a match ID.'),
        )
    }

    const cached = matchCache.get(normalizedMatchId)

    if (cached) {
        return cached
    }

    const request = fetchJson<MatchData>(
        `/data/matches/${encodeURIComponent(normalizedMatchId)}.json`,
        `match ${normalizedMatchId}`,
    ).catch((error: unknown) => {
        matchCache.delete(normalizedMatchId)
        throw error
    })

    matchCache.set(normalizedMatchId, request)

    return request
}

export function clearMatchCache(): void {
    matchCache.clear()
}

async function fetchJson<T>(
    url: string,
    resourceLabel: string,
): Promise<T> {
    let response: Response

    try {
        response = await fetch(url)
    } catch {
        throw new Error(
            `Failed to fetch ${resourceLabel}.`,
        )
    }

    if (!response.ok) {
        throw new Error(
            `Failed to fetch ${resourceLabel} (${response.status} ${response.statusText}).`,
        )
    }

    try {
        return (await response.json()) as T
    } catch {
        throw new Error(
            `Failed to parse ${resourceLabel} JSON.`,
        )
    }
}
