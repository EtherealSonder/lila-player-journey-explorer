import type { GameMap } from '../telemetry/types'

interface AppHeaderProps {
    selectedMap: GameMap | null
    selectedDate: string
    selectedMatchId: string
}

function AppHeader({
    selectedMap,
    selectedDate,
    selectedMatchId,
}: AppHeaderProps) {
    return (
        <header className="app-header">
            <div className="app-header-brand">
                <span className="app-header-mark" aria-hidden="true">
                    P
                </span>

                <div>
                    <h1>Player Journey Explorer</h1>
                    <p>Internal match telemetry review</p>
                </div>
            </div>

            <div className="app-header-context" aria-label="Current selection">
                <div>
                    <span>Map</span>
                    <strong>
                        {selectedMap?.display_name ?? 'Not selected'}
                    </strong>
                </div>

                <div>
                    <span>Date</span>
                    <strong>
                        {selectedDate || 'Not selected'}
                    </strong>
                </div>

                <div>
                    <span>Match</span>
                    <strong>
                        {selectedMatchId || 'Not selected'}
                    </strong>
                </div>
            </div>
        </header>
    )
}

export default AppHeader
