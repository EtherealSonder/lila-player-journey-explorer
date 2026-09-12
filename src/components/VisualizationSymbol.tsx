export type VisualizationSymbolKind =
    | 'human'
    | 'bot'
    | 'kill'
    | 'death'
    | 'loot'
    | 'storm'

interface VisualizationSymbolProps {
    kind: VisualizationSymbolKind
    className?: string
}

function VisualizationSymbol({
    kind,
    className = '',
}: VisualizationSymbolProps) {
    return (
        <span
            className={`visualization-symbol visualization-symbol-${kind} ${className}`.trim()}
            aria-hidden="true"
        />
    )
}

export default VisualizationSymbol
