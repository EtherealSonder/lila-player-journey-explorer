import type {
    GameMap,
    MatchSummary,
} from '../telemetry/types'
import type {
    FilterSelection,
} from '../telemetry/filtering'

interface AppHeaderProps {
    maps: GameMap[]
    availableMapIds: string[]
    availableDates: string[]
    availableMatches: MatchSummary[]
    selection: FilterSelection
    disabled: boolean
    onMapChange: (mapId: string) => void
    onDateChange: (date: string) => void
    onMatchChange: (matchId: string) => void
}

function AppHeader({
    maps,
    availableMapIds,
    availableDates,
    availableMatches,
    selection,
    disabled,
    onMapChange,
    onDateChange,
    onMatchChange,
}: AppHeaderProps) {
    const mapNames = new Map(
        maps.map((map) => [
            map.id,
            map.display_name,
        ]),
    )

    return (
        <header className="app-header">
            <div className="app-header-brand">
                <img
                    className="app-header-logo"
                    src="/assets/branding/lila-black-logo.png"
                    alt="LILA Games"
                />
                <h1>Player Journey Visualizer</h1>
            </div>

            <div
                className="app-header-filters"
                aria-label="Match selection"
            >
                <label className="header-filter">
                    <span>Map</span>
                    <select
                        value={selection.mapId}
                        disabled={
                            disabled ||
                            availableMapIds.length === 0
                        }
                        onChange={(event) =>
                            onMapChange(
                                event.target.value,
                            )
                        }
                    >
                        {availableMapIds.length === 0 ? (
                            <option value="">
                                No maps available
                            </option>
                        ) : (
                            availableMapIds.map(
                                (mapId) => (
                                    <option
                                        key={mapId}
                                        value={mapId}
                                    >
                                        {mapNames.get(
                                            mapId,
                                        ) ?? mapId}
                                    </option>
                                ),
                            )
                        )}
                    </select>
                </label>

                <label className="header-filter">
                    <span>Date</span>
                    <select
                        value={selection.date}
                        disabled={
                            disabled ||
                            availableDates.length === 0
                        }
                        onChange={(event) =>
                            onDateChange(
                                event.target.value,
                            )
                        }
                    >
                        {availableDates.length === 0 ? (
                            <option value="">
                                No dates available
                            </option>
                        ) : (
                            availableDates.map(
                                (date) => (
                                    <option
                                        key={date}
                                        value={date}
                                    >
                                        {date}
                                    </option>
                                ),
                            )
                        )}
                    </select>
                </label>

                <label className="header-filter header-filter-match">
                    <span>Match</span>
                    <select
                        value={selection.matchId}
                        disabled={
                            disabled ||
                            availableMatches.length === 0
                        }
                        onChange={(event) =>
                            onMatchChange(
                                event.target.value,
                            )
                        }
                    >
                        {availableMatches.length === 0 ? (
                            <option value="">
                                No matches available
                            </option>
                        ) : (
                            availableMatches.map(
                                (match) => (
                                    <option
                                        key={match.match_id}
                                        value={match.match_id}
                                    >
                                        {match.match_id}
                                    </option>
                                ),
                            )
                        )}
                    </select>
                </label>
            </div>
        </header>
    )
}

export default AppHeader
