import {
    createPlaybackState,
    normalizeDuration,
    type PlaybackState,
} from './playbackState'

export interface StoredPlaybackSession {
    resetKey: string
    duration: number
    state: PlaybackState
}

export function createPlaybackSession(
    resetKey: string,
    duration: number,
): StoredPlaybackSession {
    const safeDuration =
        normalizeDuration(duration)

    return {
        resetKey,
        duration: safeDuration,
        state: createPlaybackState(
            safeDuration,
        ),
    }
}

/**
 * Returns the state belonging to the requested playback session.
 *
 * A different match id or duration is treated as a new session. The new
 * session always starts at time zero, paused, and at the default 1x speed.
 */
export function resolvePlaybackSessionState(
    stored: StoredPlaybackSession,
    resetKey: string,
    duration: number,
): PlaybackState {
    const safeDuration =
        normalizeDuration(duration)

    if (
        stored.resetKey !== resetKey ||
        stored.duration !== safeDuration
    ) {
        return createPlaybackState(
            safeDuration,
        )
    }

    return stored.state
}
