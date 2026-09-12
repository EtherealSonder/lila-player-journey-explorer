import VisualizationSymbol from './VisualizationSymbol'

function VisualizationLegend() {
    return (
        <div className="visualization-legend">
            <div className="legend-row">
                <span
                    className="legend-trajectory legend-trajectory-human"
                    aria-hidden="true"
                />
                <span>Human track</span>
                <VisualizationSymbol kind="human" />
            </div>

            <div className="legend-row">
                <span
                    className="legend-trajectory legend-trajectory-bot"
                    aria-hidden="true"
                />
                <span>Bot track</span>
                <VisualizationSymbol kind="bot" />
            </div>

            <div
                className="legend-separator"
                aria-hidden="true"
            />

            <div className="legend-event-grid">
                <LegendEvent label="Kill" kind="kill" />
                <LegendEvent label="Death" kind="death" />
                <LegendEvent label="Loot" kind="loot" />
                <LegendEvent
                    label="Storm death"
                    kind="storm"
                />
            </div>
        </div>
    )
}

interface LegendEventProps {
    label: string
    kind:
    | 'kill'
    | 'death'
    | 'loot'
    | 'storm'
}

function LegendEvent({
    label,
    kind,
}: LegendEventProps) {
    return (
        <div className="legend-event-item">
            <VisualizationSymbol kind={kind} />
            <span>{label}</span>
        </div>
    )
}

export default VisualizationLegend
