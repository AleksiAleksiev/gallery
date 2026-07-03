# Timeline Design Directions (Check-in #1, 2026-07-02)

Three directions were presented; **A was chosen**. C is the agreed fallback if A's
end result disappoints — swap should only affect the timeline view, since routes,
data JSON, and the museum are independent of the timeline's rendering approach.

## A — Strata wall chart (CHOSEN)

Horizontal infinite canvas, x = real years; periods stack as overlapping colored
strata (like a geological/museum wall chart). Zooming into a band reveals artist
lifespan bars on the same axis, portrait medallions at the left edge.

- Aesthetic: engraved museum wall chart — paper texture, engraved serif labels,
  muted period accent colors.
- Zoom semantics: GSAP morph, period band → artist lanes.
- Tradeoff: most legible way to show 19 overlapping periods; most conventional.

## B — Vertical descent (rejected)

Vertical canvas; scrolling down travels forward through time, each period a
full-bleed immersive chapter with its accent palette and floating artist cards.
Fixed year-rail tracks position. Most natural navigation (plain scroll, great on
mobile) but weakest at showing periods that overlap in time — and overlap is
rampant in the modern movements.

## C — Constellation atlas (FALLBACK — build this if A disappoints)

A dark 2D map panned/zoomed like Google Maps:

- **Layout:** x = time, y = lineage — related movements drift near each other
  (Impressionism near Post-Impressionism, Cubism near Futurism…).
- **Zoomed out:** periods are glowing nebula regions on a deep-space blue field;
  a few star glyphs hint at density.
- **Zoom in:** the nebula resolves into artist "stars" — portrait medallions
  placed by working dates, name + dates beside each. Semantic zoom swaps detail
  levels with GSAP-eased map zoom; levels cross-fade.
- **Detail touches:** hairline constellation lines linking teacher → student /
  influence pairs; click a star → artist card slides in.
- **Tradeoffs:** the most spectacular and the truest "infinite canvas" of the
  three; riskiest for text legibility at intermediate zooms and for performance
  (hundreds of glowing nodes + blur effects). Needs canvas/WebGL rendering
  discipline and careful LOD to stay at 60fps.

## Notes for a potential A → C swap

- Keep the timeline's data interface (periods + artists from
  `data/json/timeline.json`) and the artist-card component decoupled from the
  canvas rendering, so C reuses both.
- The period `accent` colors in the DB were chosen for A's paper aesthetic;
  C would want a luminous variant of each (same hue, boosted chroma on dark).
