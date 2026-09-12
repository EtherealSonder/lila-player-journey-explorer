import {
    readFileSync,
} from 'node:fs'
import {
    resolve,
} from 'node:path'
import {
    describe,
    expect,
    it,
} from 'vitest'

function readSource(
    relativePath: string,
): string {
    return readFileSync(
        resolve(
            process.cwd(),
            relativePath,
        ),
        'utf8',
    )
}

describe(
    'heatmap performance architecture',
    () => {
        it(
            'keeps heatmap grid calculation independent of playback current time',
            () => {
                const appSource =
                    readSource(
                        'src/App.tsx',
                    )

                const memoStart =
                    appSource.indexOf(
                        'const heatmapGrid = useMemo(',
                    )

                expect(memoStart).toBeGreaterThanOrEqual(
                    0,
                )

                const memoEnd =
                    appSource.indexOf(
                        'const viewportStatus',
                        memoStart,
                    )

                const memoBlock =
                    appSource.slice(
                        memoStart,
                        memoEnd,
                    )

                expect(
                    memoBlock,
                ).toContain(
                    'heatmapMode',
                )
                expect(
                    memoBlock,
                ).toContain(
                    'matchData',
                )
                expect(
                    memoBlock,
                ).not.toContain(
                    'currentTime',
                )
            },
        )

        it(
            'keeps HeatmapRenderer out of the playback-time render effect',
            () => {
                const viewportSource =
                    readSource(
                        'src/map/MapViewport.tsx',
                    )

                const playbackStart =
                    viewportSource.indexOf(
                        'Playback frame updates intentionally',
                    )

                expect(
                    playbackStart,
                ).toBeGreaterThanOrEqual(
                    0,
                )

                const playbackEnd =
                    viewportSource.indexOf(
                        'useEffect(() => {',
                        playbackStart + 80,
                    )

                const playbackBlock =
                    viewportSource.slice(
                        playbackStart,
                        playbackEnd,
                    )

                expect(
                    playbackBlock,
                ).toContain(
                    'currentTimeSeconds',
                )
                expect(
                    playbackBlock,
                ).not.toContain(
                    'heatmapRendererRef.current?.render',
                )
                expect(
                    playbackBlock,
                ).not.toContain(
                    'buildHeatmapGridForMatch',
                )
            },
        )

        it(
            'constructs one retained HeatmapRenderer for the viewport lifecycle',
            () => {
                const viewportSource =
                    readSource(
                        'src/map/MapViewport.tsx',
                    )

                const occurrences =
                    viewportSource.match(
                        /new HeatmapRenderer\(/g,
                    ) ?? []

                expect(
                    occurrences,
                ).toHaveLength(1)
            },
        )
    },
)
