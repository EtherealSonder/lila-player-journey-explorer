

export type ParticipantCategory = 'human' | 'bot' | 'unknown'

export type TelemetryEventType =
    | 'kill'
    | 'death'
    | 'storm_death'
    | 'loot'

export type EventOwnerRole =
    | 'killer'
    | 'victim'
    | 'participant'


export interface MapProjectionMetadata {
    origin_x: number
    origin_z: number
    scale: number
}

export interface GameMap {
    id: string
    display_name: string
    image_path: string
    projection: MapProjectionMetadata
    texture_width: number | null
    texture_height: number | null
}

export interface MapsPayload {
    schema_version: number
    map_count: number
    maps: GameMap[]
}

export interface MatchEventCounts {
    kill: number
    death: number
    storm_death: number
    loot: number
}

export interface MatchSummary {
    match_id: string
    date: string
    map_id: string
    duration_seconds: number
    participant_count: number
    human_count: number
    bot_count: number
    event_counts: MatchEventCounts
}

export interface ManifestPayload {
    schema_version: number
    match_count: number
    map_ids: string[]
    dates: string[]
    matches: MatchSummary[]
}

export interface Participant {
    id: string
    category: ParticipantCategory
}

export interface TelemetryPoint {
    time_seconds: number
    world_x: number
    world_y: number
    world_z: number
    map_u: number
    map_v: number
}

export interface ParticipantTrack {
    participant_id: string
    points: TelemetryPoint[]
}

export interface TelemetryEvent {
    time_seconds: number
    type: TelemetryEventType
    participant_id: string
    participant_category: ParticipantCategory
    owner_role: EventOwnerRole
    world_x: number
    world_y: number
    world_z: number
    map_u: number
    map_v: number
    source_category: ParticipantCategory | null
    target_category: ParticipantCategory | null
    metadata: Record<string, unknown>
}

export interface MatchData {
    match_id: string
    date: string
    map_id: string
    duration_seconds: number
    participants: Participant[]
    tracks: ParticipantTrack[]
    events: TelemetryEvent[]
}
