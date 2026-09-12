export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

export interface PlaybackState {
    currentTime: number
    duration: number
    isPlaying: boolean
    playbackSpeed: PlaybackSpeed
}

export const DEFAULT_PLAYBACK_SPEED: PlaybackSpeed = 1

export function createPlaybackState(duration: number): PlaybackState {
    return {
        currentTime: 0,
        duration: normalizeDuration(duration),
        isPlaying: false,
        playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    }
}

export function normalizeDuration(duration: number): number {
    if (!Number.isFinite(duration) || duration <= 0) {
        return 0
    }

    return duration
}
