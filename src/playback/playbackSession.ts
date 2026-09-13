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
