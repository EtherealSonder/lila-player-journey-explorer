import {
    useCallback,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react'

import {
    advancePlayback,
    pausePlayback,
    playPlayback,
    seekPlayback,
    setPlaybackSpeed,
} from './playbackMath'
import {
    normalizeDuration,
    type PlaybackSpeed,
    type PlaybackState,
} from './playbackState'
import {
    createPlaybackSession,
    resolvePlaybackSessionState,
    type StoredPlaybackSession,
} from './playbackSession'
import { getFrameDeltaSeconds } from './playbackFrame'

export interface PlaybackController {
    state: PlaybackState
    play: () => void
    pause: () => void
    seek: (time: number) => void
    setSpeed: (speed: PlaybackSpeed) => void
}

/**
 * React owns match playback state.
 *
 * The reset key is normally the selected match id. When that key or duration
 * changes, the externally visible playback state immediately resolves to a
 * fresh paused state at time zero. No PixiJS object owns or advances time.
 *
 * requestAnimationFrame runs only while playback is active. A layout-effect
 * cleanup cancels the current RAF synchronously when the selected match
 * session changes, before the browser paints the replacement match. Each
 * frame uses the browser-provided RAF timestamp and delegates clamping and
 * end-of-match behavior to the pure Phase 6A playback functions.
 */
export function usePlaybackController(
    resetKey: string,
    duration: number,
): PlaybackController {
    const safeDuration = normalizeDuration(duration)

    const [stored, setStored] = useState<StoredPlaybackSession>(
        () =>
            createPlaybackSession(
                resetKey,
                safeDuration,
            ),
    )

    const state = useMemo(
        () =>
            resolvePlaybackSessionState(
                stored,
                resetKey,
                safeDuration,
            ),
        [resetKey, safeDuration, stored],
    )

    const updateCurrentPlayback = useCallback(
        (
            updater: (
                current: PlaybackState,
            ) => PlaybackState,
        ): void => {
            setStored((currentStored) => {
                const currentState =
                    resolvePlaybackSessionState(
                        currentStored,
                        resetKey,
                        safeDuration,
                    )

                return {
                    resetKey,
                    duration: safeDuration,
                    state: updater(currentState),
                }
            })
        },
        [resetKey, safeDuration],
    )

    const play = useCallback(() => {
        updateCurrentPlayback(playPlayback)
    }, [updateCurrentPlayback])

    const pause = useCallback(() => {
        updateCurrentPlayback(pausePlayback)
    }, [updateCurrentPlayback])

    const seek = useCallback(
        (time: number) => {
            updateCurrentPlayback((current) =>
                seekPlayback(current, time),
            )
        },
        [updateCurrentPlayback],
    )

    const setSpeed = useCallback(
        (speed: PlaybackSpeed) => {
            updateCurrentPlayback((current) =>
                setPlaybackSpeed(current, speed),
            )
        },
        [updateCurrentPlayback],
    )

    useLayoutEffect(() => {
        if (!state.isPlaying) {
            return
        }

        let animationFrameId: number | null = null
        let previousTimestampMs: number | null = null
        let cancelled = false

        function frame(timestampMs: number): void {
            if (cancelled) {
                return
            }

            const deltaSeconds = getFrameDeltaSeconds(
                previousTimestampMs,
                timestampMs,
            )
            previousTimestampMs = timestampMs

            if (deltaSeconds > 0) {
                updateCurrentPlayback((current) =>
                    advancePlayback(
                        current,
                        deltaSeconds,
                    ),
                )
            }

            animationFrameId =
                window.requestAnimationFrame(frame)
        }

        animationFrameId =
            window.requestAnimationFrame(frame)

        return () => {
            cancelled = true

            if (animationFrameId !== null) {
                window.cancelAnimationFrame(
                    animationFrameId,
                )
            }
        }
    }, [
        resetKey,
        state.isPlaying,
        updateCurrentPlayback,
    ])

    return {
        state,
        play,
        pause,
        seek,
        setSpeed,
    }
}
