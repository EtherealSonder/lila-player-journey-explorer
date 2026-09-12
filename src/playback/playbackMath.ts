import {
    DEFAULT_PLAYBACK_SPEED,
    type PlaybackSpeed,
    type PlaybackState,
    createPlaybackState,
    normalizeDuration,
} from './playbackState'

export function clampPlaybackTime(
    time: number,
    duration: number,
): number {
    const safeDuration = normalizeDuration(duration)

    if (!Number.isFinite(time) || time <= 0) {
        return 0
    }

    if (time >= safeDuration) {
        return safeDuration
    }

    return time
}

export function playPlayback(state: PlaybackState): PlaybackState {
    if (state.duration <= 0 || state.currentTime >= state.duration) {
        return {
            ...state,
            currentTime: clampPlaybackTime(
                state.currentTime,
                state.duration,
            ),
            isPlaying: false,
        }
    }

    return {
        ...state,
        isPlaying: true,
    }
}

export function pausePlayback(state: PlaybackState): PlaybackState {
    if (!state.isPlaying) {
        return state
    }

    return {
        ...state,
        isPlaying: false,
    }
}

export function seekPlayback(
    state: PlaybackState,
    requestedTime: number,
): PlaybackState {
    const currentTime = clampPlaybackTime(
        requestedTime,
        state.duration,
    )

    return {
        ...state,
        currentTime,
        isPlaying:
            state.isPlaying &&
            state.duration > 0 &&
            currentTime < state.duration,
    }
}

export function setPlaybackSpeed(
    state: PlaybackState,
    playbackSpeed: PlaybackSpeed,
): PlaybackState {
    if (state.playbackSpeed === playbackSpeed) {
        return state
    }

    return {
        ...state,
        playbackSpeed,
    }
}

export function advancePlayback(
    state: PlaybackState,
    realElapsedSeconds: number,
): PlaybackState {
    if (!state.isPlaying) {
        return state
    }

    if (
        state.duration <= 0 ||
        state.currentTime >= state.duration
    ) {
        return {
            ...state,
            currentTime: clampPlaybackTime(
                state.currentTime,
                state.duration,
            ),
            isPlaying: false,
        }
    }

    if (
        !Number.isFinite(realElapsedSeconds) ||
        realElapsedSeconds <= 0
    ) {
        return state
    }

    const nextTime =
        state.currentTime +
        realElapsedSeconds * state.playbackSpeed

    const currentTime = clampPlaybackTime(
        nextTime,
        state.duration,
    )

    return {
        ...state,
        currentTime,
        isPlaying: currentTime < state.duration,
    }
}

export function resetPlayback(duration: number): PlaybackState {
    return createPlaybackState(duration)
}

export function resetPlaybackWithSpeed(
    duration: number,
    playbackSpeed: PlaybackSpeed = DEFAULT_PLAYBACK_SPEED,
): PlaybackState {
    return {
        ...createPlaybackState(duration),
        playbackSpeed,
    }
}
