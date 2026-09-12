# Phase 7J Manual Heatmap Validation

## Purpose

This checklist is the final manual acceptance gate for Phase 7. It verifies that the heatmap is correct, readable, stable across maps and match changes, and independent from playback.

Complete the checks in the running application after all automated tests pass.

---

## 1. Basic mode switching

Use one match with visible movement and events.

### None

- Select **None**.
- Confirm that no heatmap overlay is visible.
- Confirm that the original full-colour minimap is restored immediately.

Expected result: PASS if the overlay is fully cleared and the original map colours return.

### Traffic

- Select **Traffic**.
- Confirm that the map becomes muted/grayscale.
- Confirm that only blue-family heatmap colours are visible.
- Confirm that high-density areas appear stronger than low-density areas.
- Confirm that the field appears smooth rather than as visible grid squares.

Expected result: PASS if movement density reads clearly as a blue spatial field.

### Kills

- Select **Kills**.
- Confirm that only red-family heatmap colours are visible.
- Confirm that sparse kills appear as local hotspots.
- Confirm that nearby kills can merge into stronger hotspots.
- Confirm that blue Traffic heatmap regions do not remain visible.

Expected result: PASS if kill density is visually distinct and semantically red.

### Deaths

- Select **Deaths**.
- Confirm that only purple-family heatmap colours are visible.
- Confirm that regular death locations contribute to the heatmap.
- Confirm that storm deaths do not contribute to the Deaths heatmap.

Expected result: PASS if regular deaths are shown clearly and storm deaths are excluded.

---

## 2. Layer ordering

For each active heatmap mode:

- Keep trajectories visible.
- Keep participant markers visible.
- Keep event markers visible.
- Confirm that the heatmap remains beneath all of them.
- Confirm that the minimap remains beneath the heatmap.

Expected order:

`Minimap → Heatmap → Trajectories → Participant Markers → Event Markers`

Expected result: PASS if analytical context remains readable and markers are never hidden by the heatmap.

---

## 3. Playback independence

Use an active heatmap.

- Press Play.
- Pause.
- Scrub backward.
- Scrub forward.
- Change playback speed.
- Observe the heatmap while the timeline changes.

Expected result: the heatmap must remain spatially identical throughout playback. Only playback-dependent trajectories, participant positions, and event visibility should change.

Expected result: PASS if heatmap density does not rebuild, animate, shrink, or grow with playback time.

---

## 4. Match switching

Choose an active heatmap mode, preferably Traffic.

- Switch to another match.
- Observe the viewport while the next match loads.
- Confirm that the previous match heatmap is cleared.
- Confirm that the same selected heatmap mode remains selected.
- Confirm that the new heatmap appears only after the new match data loads.

Expected result: PASS if no stale heatmap from the previous match remains visible.

---

## 5. Map switching

With a heatmap mode active:

- Switch between Ambrose Valley, Grand Rift, and Lockdown where data is available.
- Confirm that the heatmap aligns with the new minimap.
- Confirm that the old map's heatmap disappears.
- Confirm that the selected heatmap mode is preserved.

Expected result: PASS if heatmap geometry always belongs to the current map.

---

## 6. Camera behaviour

With a heatmap active:

- Zoom in several steps.
- Zoom out several steps.
- Pan horizontally.
- Pan vertically.
- Press Reset.

Expected result: the minimap, heatmap, trajectories, participant markers, and event markers move together under the same camera transform.

Expected result: PASS if there is no drifting or misalignment.

---

## 7. Resize behaviour

With a heatmap active:

- Resize the browser window wider.
- Resize it narrower.
- Change the viewport height if possible.
- Observe heatmap alignment after each resize.

Expected result: PASS if density regions remain aligned with their map locations.

---

## 8. Empty and sparse data

Find a match or mode with very few relevant records if available.

- Select a mode with no matching records.
- Confirm that the application remains stable.
- Confirm that no invalid or phantom heatmap is drawn.
- Test a sparse Kills or Deaths mode.
- Confirm that individual hotspots remain readable.

Expected result: PASS if empty data produces no overlay and sparse data remains visually meaningful.

---

## 9. Source-record semantics

Validate at least one representative match.

### Traffic

Traffic must come from valid participant trajectory samples only.

### Kills

Kills must come from normalized events where:

- `type === "kill"`
- `owner_role === "killer"`

### Deaths

Deaths must come from normalized events where:

- `type === "death"`
- `owner_role === "victim"`

`storm_death` must remain excluded from the general Deaths heatmap.

Expected result: PASS if the visible modes follow these source rules.

---

## 10. Visual quality

Review all three active heatmap modes.

Confirm that:

- The grayscale/muted basemap still preserves useful geography.
- Heatmaps are visible without overpowering the map.
- The heatmap does not visibly expose the 64 × 64 analytical grid.
- Traffic reads as blue.
- Kills read as red.
- Deaths read as purple.
- Stronger density is clearly distinguishable from weaker density.
- The same colour never changes semantic meaning between modes.

Expected result: PASS if the heatmap can be interpreted at a glance without needing to decode a rainbow scale.

---

## Final Phase 7 Exit Gate

Phase 7 can be marked complete only when all of the following are true:

- Automated heatmap tests pass.
- Full regression suite passes.
- ESLint passes.
- Production build passes.
- Traffic corresponds to trajectory samples.
- Kills correspond to killer-side kill events.
- Deaths correspond to victim-side regular death events.
- Storm deaths are excluded from Deaths.
- Mode switching is immediate.
- Empty modes are safe.
- Minimap remains readable.
- Heatmap remains beneath trajectories and markers.
- Playback does not alter heatmap calculation.
- Match/map changes do not leave stale overlays.
- Zoom, pan, and resize preserve alignment.
- Semantic single-hue presentation is clear across all three maps.

If every item above passes, mark **Phase 7. Heatmap Overlays** complete.
