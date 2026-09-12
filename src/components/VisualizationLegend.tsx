function VisualizationLegend() {
    return (
        <div className="visualization-legend">
            <div className="legend-row">
                <span
                    className="legend-trajectory legend-trajectory-human"
                    aria-hidden="true"
                />
                <span>Human track</span>
                <span
                    className="legend-participant legend-participant-human"
                    aria-hidden="true"
                />
            </div>

            <div className="legend-row">
                <span
                    className="legend-trajectory legend-trajectory-bot"
                    aria-hidden="true"
                />
                <span>Bot track</span>
                <span
                    className="legend-participant legend-participant-bot"
                    aria-hidden="true"
                />
            </div>

            <div className="legend-separator" aria-hidden="true" />

            <div className="legend-event-grid">
                <LegendEvent
                    label="Kill"
                    markerClass="legend-event-kill"
                />
                <LegendEvent
                    label="Death"
                    markerClass="legend-event-death"
                />
                <LegendEvent
                    label="Loot"
                    markerClass="legend-event-loot"
                />
                <LegendEvent
                    label="Storm death"
                    markerClass="legend-event-storm"
                />
            </div>
        </div>
    )
}

interface LegendEventProps {
    label: string
    markerClass: string
}

function LegendEvent({
    label,
    markerClass,
}: LegendEventProps) {
    return (
        <div className="legend-event-item">
            <span
                className={`legend-event-marker ${markerClass}`}
                aria-hidden="true"
            />
            <span>{label}</span>
        </div>
    )
}

export default VisualizationLegend
