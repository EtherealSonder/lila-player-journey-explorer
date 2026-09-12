import { describe, expect, it } from 'vitest'

import {
    createPlaybackSession,
    resolvePlaybackSessionState,
} from '../../src/playback/playbackSession'
import {
    seekPlayback,
    setPlaybackSpeed,
} from '../../src/playback/playbackMath'

describe('playback session reset policy', () => {
    it('resets time, playing state, and speed when the match key changes', () => {
        const firstSession =
            createPlaybackSession(
                'match-a',
                120,
            )

        firstSession.state = {
            ...setPlaybackSpeed(
                seekPlayback(
                    {
                        ...firstSession.state,
                        isPlaying: true,
                    },
                    65,
                ),
                4,
            ),
            isPlaying: true,
        }

        const next =
            resolvePlaybackSessionState(
                firstSession,
                'match-b',
                90,
            )

        expect(next).toEqual({
            currentTime: 0,
            duration: 90,
            isPlaying: false,
            playbackSpeed: 1,
        })
    })

    it('resets when the duration changes for the same key', () => {
        const session =
            createPlaybackSession(
                'match-a',
                120,
            )

        session.state = {
            ...session.state,
            currentTime: 40,
            isPlaying: true,
            playbackSpeed: 2,
        }

        const next =
            resolvePlaybackSessionState(
                session,
                'match-a',
                150,
            )

        expect(next).toEqual({
            currentTime: 0,
            duration: 150,
            isPlaying: false,
            playbackSpeed: 1,
        })
    })

    it('preserves playback state within the same match session', () => {
        const session =
            createPlaybackSession(
                'match-a',
                120,
            )

        session.state = {
            ...session.state,
            currentTime: 25.5,
            isPlaying: true,
            playbackSpeed: 2,
        }

        expect(
            resolvePlaybackSessionState(
                session,
                'match-a',
                120,
            ),
        ).toBe(session.state)
    })

    it('normalizes invalid duration when creating a new session', () => {
        expect(
            createPlaybackSession(
                'match-a',
                Number.NaN,
            ).state,
        ).toEqual({
            currentTime: 0,
            duration: 0,
            isPlaying: false,
            playbackSpeed: 1,
        })
    })
})
