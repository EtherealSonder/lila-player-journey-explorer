# Player Journey Explorer: Level Design Insights

This document contains exactly three telemetry-backed observations from
the supplied Player Journey Explorer dataset. The analysis uses all
**796 normalized matches** across **Ambrose Valley (566 matches)**,
**Grand Rift (59 matches)**, and **Lockdown (171 matches)**.

For spatial comparisons, normalized `map_u` / `map_v` coordinates were
grouped into a coarse **8 × 8 grid**. This makes the evidence comparable
across maps without inventing named regions that are not present in the
supplied data. Traffic means valid trajectory samples. Kill locations
use killer-side `kill` events. Death locations use victim-side regular
`death` events, with `storm_death` kept separate.

The findings below describe correlations and spatial patterns in the
telemetry. They do not establish why players behaved this way. Any
proposed explanation is therefore framed as a Level Design hypothesis to
investigate.

------------------------------------------------------------------------

## Insight 1: Combat is more spatially concentrated than general movement, especially on Grand Rift

### What caught my eye

When comparing the Traffic, Kills, and Deaths views, combat repeatedly
appeared to collapse into a smaller set of locations than general player
movement. Grand Rift showed the strongest version of this pattern.

### Evidence

Across Grand Rift's **5,728 trajectory samples**, the four busiest 8 × 8
traffic cells contain **36.5% of all traffic**. In comparison, the four
busiest kill cells contain **56.0% of 193 killer-side kills**, and the
four busiest regular-death cells contain **78.7% of 47 victim-side
deaths**.

The single busiest Grand Rift cell, grid cell **(3, 3)**, contains:

-   **12.3% of all Grand Rift traffic**
-   **23.3% of Grand Rift kills**
-   **36.2% of Grand Rift regular deaths**

The same broader pattern also appears on the other maps. On Ambrose
Valley, the top four cells contain **29.4% of traffic**, compared with
**50.9% of kills** and **61.2% of regular deaths**. On Lockdown, they
contain **32.3% of traffic**, compared with **46.0% of kills** and
**52.4% of regular deaths**.

This means the combat concentration is not explained only by players
spending more time in a few locations. Combat is more concentrated than
the underlying movement distribution.

### Level Design interpretation

A plausible hypothesis is that particular routes, intersections,
objectives, sightlines, or resource locations are repeatedly funneling
encounters into a limited part of each map. Grand Rift deserves the
closest inspection because the difference between movement concentration
and death concentration is particularly large.

The telemetry alone cannot identify whether this concentration is
desirable. A deliberate combat focal point can create readable pacing
and reliable encounters. If the same locations dominate too strongly,
however, other traversable areas may contribute relatively little to
meaningful combat.

### Actionable next step

A Level Designer could inspect the high-combat cells in the visualizer
and compare their geometry with nearby lower-combat routes. Useful
experiments include changing cover, sightlines, route connectivity,
objective placement, or resource incentives around those cells, then
comparing the spatial distribution after another playtest.

Metrics to watch include **kill concentration, death concentration,
traffic share, encounter distribution, and route usage**.

### Why this matters

This finding helps distinguish **where players travel** from **where the
map consistently turns movement into combat**. That is useful when
evaluating whether encounter pacing is intentionally distributed or
being dominated by a small number of spaces.

------------------------------------------------------------------------

## Insight 2: Human and bot movement distributions diverge most on Ambrose Valley

### What caught my eye

Human and bot paths overlap substantially, but they do not use each map
in exactly the same proportions. The largest difference appears on
Ambrose Valley.

### Evidence

The dataset contains **568 human and 268 bot participant journeys on
Ambrose Valley**, contributing **36,126 human trajectory samples** and
**12,565 bot trajectory samples**.

Using the same 8 × 8 grid, the total-variation distance between the
normalized human and bot traffic distributions is:

  Map                Human vs bot traffic distance
  ---------------- -------------------------------
  Ambrose Valley                         **0.277**
  Grand Rift                             **0.204**
  Lockdown                               **0.194**

A value of 0 would mean that humans and bots distribute their movement
across the grid in identical proportions. The higher Ambrose Valley
value therefore indicates the strongest population-level route
difference of the three maps.

The busiest cells also differ. The most-used human cell on Ambrose
Valley is **(4, 3)** with **3,645 human samples**, while the most-used
bot cell is **(2, 4)** with **1,324 bot samples**. Six cells still
appear in both populations' top eight, so this is not complete route
separation. It is a measurable difference in how strongly each
population uses particular areas.

### Level Design interpretation

This pattern could have several causes. Bots may have different
navigation preferences, humans may respond differently to combat or loot
incentives, or particular routes may be easier for one population to
discover or traverse.

The telemetry does not identify which explanation is correct. It does
show that treating bot traffic as a direct substitute for human traffic
would be least reliable on Ambrose Valley.

### Actionable next step

A Level Designer could use the Human and Bot visibility controls to
inspect Ambrose Valley's human-heavy and bot-heavy cells separately.
Those areas are good candidates for checking navigation links, traversal
complexity, cover, route readability, and whether important gameplay
incentives are equally accessible to both populations.

If bots are intended to approximate realistic player movement, the gap
can also be discussed with AI/navigation designers before bot-heavy
playtests are used to evaluate map flow.

Metrics to watch include **human route share, bot route share, route
diversity, navigation coverage, and encounter distribution by
participant category**.

### Why this matters

Bots can generate useful coverage, but a map-design conclusion based on
bot movement is weaker when bots and humans distribute themselves
differently. Ambrose Valley is therefore the map where designers should
be most careful about combining the two populations into one traffic
interpretation.

------------------------------------------------------------------------

## Insight 3: Loot activity is more concentrated than traffic in specific hotspots

### What caught my eye

Loot activity generally follows travelled areas, but the busiest loot
locations receive a noticeably larger share of loot events than their
share of movement. This occurs on all three maps.

### Evidence

There are **12,866 loot events** in the normalized dataset: **9,936 on
Ambrose Valley**, **880 on Grand Rift**, and **2,050 on Lockdown**.

For each map's busiest loot cell:

  -----------------------------------------------------------------------
  Map         Busiest       Share of loot        Share of    Loot share /
              loot cell                   traffic in same   traffic share
                                                     cell 
  ----------- ----------- --------------- --------------- ---------------
  Ambrose     (4, 3)            **14.2%**        **8.4%**       **1.70×**
  Valley                                                  

  Grand Rift  (3, 3)            **16.0%**       **12.3%**       **1.31×**

  Lockdown    (4, 5)            **12.0%**        **7.8%**       **1.54×**
  -----------------------------------------------------------------------

The pattern is also visible across several cells rather than only one
extreme value. For example, Ambrose Valley cell **(4, 1)** accounts for
about **7.0% of loot events** but only **4.0% of traffic**, while
Lockdown cell **(3, 5)** accounts for about **7.9% of loot** against
**5.5% of traffic**.

At the broader top-four-cell level, loot is also more concentrated than
traffic on every map:

-   Ambrose Valley: **37.1% of loot vs 29.4% of traffic**
-   Grand Rift: **41.2% vs 36.5%**
-   Lockdown: **35.3% vs 32.3%**

### Level Design interpretation

These cells behave like stronger loot-activity hotspots than movement
volume alone would predict. A possible explanation is concentrated loot
availability or particularly attractive loot routes. Another possibility
is that players remain or interact more intensively once they reach
those areas.

The event data records where loot interactions occurred, not the
complete authored loot-spawn configuration, so it cannot prove that item
placement itself caused the concentration.

### Actionable next step

A Level Designer could inspect these cells against the authored loot
layout and nearby routes. If concentrated loot is intentional, the
question becomes whether the resulting risk/reward and encounter pacing
are appropriate. If the goal is broader exploration, some loot value or
access could be redistributed toward underused routes and tested again.

This finding can also be combined with the combat result. A cell that
over-indexes on both loot and combat is a strong candidate for
investigating whether resource incentives are helping create an
encounter funnel.

Metrics to watch include **loot-event concentration, traffic share,
route usage, time spent in the area, nearby kill/death concentration,
and exploration coverage**.

### Why this matters

Loot is one of the tools Level Designers can use to influence movement
and risk/reward decisions. Comparing loot activity with underlying
traffic helps identify areas that appear disproportionately important to
player resource interaction instead of simply being busy because many
players pass through them.

------------------------------------------------------------------------

## Summary

The three findings point to three different Level Design questions:

1.  **Encounter distribution:** combat is substantially more
    concentrated than general movement, with Grand Rift showing the
    strongest concentration.
2.  **Population behaviour:** human and bot route usage differs most on
    Ambrose Valley, so combined traffic should be interpreted carefully
    there.
3.  **Resource distribution:** specific loot hotspots attract a larger
    share of loot activity than their underlying traffic share,
    providing concrete locations for checking resource-driven route
    incentives.

These are intended as investigation targets rather than causal
conclusions. The next useful step for each finding is to inspect the
identified grid cells in the Player Journey Explorer alongside the
actual map geometry and authored gameplay content, make a controlled
Level Design change, and compare the same metrics in a later telemetry
sample.
