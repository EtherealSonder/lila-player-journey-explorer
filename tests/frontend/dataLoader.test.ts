import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'

import {
    clearMatchCache,
    loadManifest,
    loadMaps,
    loadMatch,
} from '../../src/telemetry/dataLoader'

function jsonResponse(
    payload: unknown,
    init: ResponseInit = {},
): Response {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        ...init,
    })
}

describe('telemetry dataLoader', () => {
    beforeEach(() => {
        clearMatchCache()
        vi.restoreAllMocks()
    })

    afterEach(() => {
        clearMatchCache()
        vi.restoreAllMocks()
    })

    it('loads the manifest from the generated static path', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse({
                schema_version: 1,
                match_count: 0,
                map_ids: [],
                dates: [],
                matches: [],
            }),
        )

        const result = await loadManifest()

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledWith('/data/manifest.json')
        expect(result.match_count).toBe(0)
    })

    it('loads the map registry from the generated static path', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse({
                schema_version: 1,
                map_count: 0,
                maps: [],
            }),
        )

        const result = await loadMaps()

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledWith('/data/maps.json')
        expect(result.map_count).toBe(0)
    })

    it('loads one selected match from its static match path', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse({
                match_id: 'match-123',
                date: '2026-02-12',
                map_id: 'AmbroseValley',
                duration_seconds: 10,
                participants: [],
                tracks: [],
                events: [],
            }),
        )

        const result = await loadMatch('match-123')

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledWith(
            '/data/matches/match-123.json',
        )
        expect(result.match_id).toBe('match-123')
    })

    it('reuses the same cached promise when the same match is requested again', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse({
                match_id: 'match-cache',
                date: '2026-02-12',
                map_id: 'AmbroseValley',
                duration_seconds: 10,
                participants: [],
                tracks: [],
                events: [],
            }),
        )

        const firstRequest = loadMatch('match-cache')
        const secondRequest = loadMatch('match-cache')

        expect(secondRequest).toBe(firstRequest)

        const [firstResult, secondResult] = await Promise.all([
            firstRequest,
            secondRequest,
        ])

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(secondResult).toBe(firstResult)
    })

    it('fetches different match IDs independently', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                jsonResponse({
                    match_id: 'match-a',
                    date: '2026-02-12',
                    map_id: 'AmbroseValley',
                    duration_seconds: 10,
                    participants: [],
                    tracks: [],
                    events: [],
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    match_id: 'match-b',
                    date: '2026-02-12',
                    map_id: 'AmbroseValley',
                    duration_seconds: 10,
                    participants: [],
                    tracks: [],
                    events: [],
                }),
            )

        const [matchA, matchB] = await Promise.all([
            loadMatch('match-a'),
            loadMatch('match-b'),
        ])

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(matchA.match_id).toBe('match-a')
        expect(matchB.match_id).toBe('match-b')
    })

    it('removes a failed match request from the cache so a later retry can refetch', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                new Response(null, {
                    status: 500,
                    statusText: 'Internal Server Error',
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    match_id: 'retry-match',
                    date: '2026-02-12',
                    map_id: 'Lockdown',
                    duration_seconds: 10,
                    participants: [],
                    tracks: [],
                    events: [],
                }),
            )

        await expect(loadMatch('retry-match')).rejects.toThrow(
            'Failed to fetch match retry-match (500 Internal Server Error).',
        )

        const result = await loadMatch('retry-match')

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(result.match_id).toBe('retry-match')
    })

    it('rejects an empty match ID without issuing a fetch', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch')

        await expect(loadMatch('   ')).rejects.toThrow(
            'Cannot load a match without a match ID.',
        )

        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('reports network failures with a resource-specific error', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new TypeError('Network unavailable'),
        )

        await expect(loadManifest()).rejects.toThrow(
            'Failed to fetch manifest.',
        )
    })

    it('reports malformed JSON separately from HTTP failures', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('{broken-json', {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            }),
        )

        await expect(loadMaps()).rejects.toThrow(
            'Failed to parse map registry JSON.',
        )
    })
})
