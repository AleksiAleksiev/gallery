# Interactive 3D Art Museum — Build Plan

An in-browser, interactive museum of art history. Entry point is a zoomable timeline of
art periods and artists; from any artist you can step into a first-person 3D gallery hung
with their real paintings. All content (bios, images, dates, stories) sourced exclusively
from Wikipedia / Wikimedia Commons — nothing AI-generated.

---

## Decisions Made (settled in discussion, 2026-06-12)

- **No Neon / no hosted Postgres.** Data is read-only at runtime and tiny (~500 painting
  records), so it's stored as **SQLite (build-time) → static JSON (runtime)**. Nothing to
  manage on the server.
- **Images stored as plain files on the VM's disk.** No object storage, no CDN — Oracle's
  free tier includes 10 TB/month egress, far beyond personal-project traffic. Originals
  from Commons are downloaded once at seed time and resized into tiers (see Image
  Pipeline); originals are never stored.
- **Static site, built locally.** The app is a static Next.js export. The build and seed
  pipeline run on the dev machine (the VM's 1 GB RAM can't build it); deploy is rsync.
- **Caddy serves everything.** It's already running on the VM terminating TLS; the gallery
  is one new site block (e.g. `gallery.lokset.dev`) with `file_server`, gzip, and long
  cache headers on images. Zero new server processes, zero added RAM.
- **Copyrighted works get placeholders, not exclusion.** The copyright cliff (~1930 US /
  death+70 EU) means Commons has no hi-res images for much of Surrealism, Abstract
  Expressionism, Pop Art, and Contemporary. Decision: every notable artist still gets a
  card and a museum. Paintings whose images aren't free keep all their Wikipedia metadata
  (title, year, story, facts) but hang as a designed **placeholder canvas** (title +
  "image not freely available"). A local override folder lets the owner drop in an image
  file later — the pipeline picks it up by slug and replaces the placeholder, no code
  changes. Override files live outside the repo/pipeline sources.

## Deployment Target (verified 2026-06-12)

`ssh oracle` — Oracle Cloud micro instance, Ubuntu 24.04, 2 vCPU, **954 MiB RAM**
(~530 MiB available), 2 GB swap, **38 GB free disk**. Already hosting: Caddy (ports
80/443), a Node v20 app (~60 MB RSS, port 17080), a Python bot (~40 MB). Constraint:
don't add resident processes — the static-files approach adds none.

---

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router, TypeScript), **static export** | Routing/structure without a runtime server; output is plain files for Caddy |
| 3D | Three.js via React Three Fiber + drei | First-person controls, PBR materials, postprocessing ecosystem |
| Timeline | Custom infinite-canvas (SVG/Canvas hybrid) | Full control over zoom semantics (periods → artists) |
| Animation | GSAP | The brief explicitly asks for GSAP-quality filter/transition animation |
| Data store | SQLite during seeding → static JSON shipped with the site | Read-only data, no server process needed |
| Data ingestion | Node scripts hitting Wikipedia REST API + Wikidata + Wikimedia Commons API | Repeatable seed pipeline, run locally |
| Image processing | sharp (resize tiers) + KTX2 compression for gallery textures | Browser- and GPU-friendly sizes |
| Styling | Tailwind + custom CSS for the museum-placard typography | Speed + fine control where it matters |
| Hosting | Existing Oracle micro VM, Caddy `file_server` | Already running; static files only |

---

## Architecture Overview

```
DEV MACHINE (build + seed)                          ORACLE VM (serve)
┌─────────────────────────────────────┐
│ Seed pipeline (repeatable)          │
│ Wikipedia/Wikidata/Commons APIs     │
│   → validate → SQLite               │
│   → download originals → resize     │
│     into image tiers (never store   │
│     originals)                      │
│   → export data.json per route      │
├─────────────────────────────────────┤    rsync    ┌──────────────────────────┐
│ Next.js static export               │ ──────────► │ Caddy                    │
│  ├─ /            Timeline           │             │  gallery.lokset.dev      │
│  ├─ /museum/[artist]  R3F gallery   │             │  file_server + gzip +    │
│  └─ /images/{thumb,gallery,inspect} │             │  cache headers           │
└─────────────────────────────────────┘             └──────────────────────────┘
```

## Image Pipeline (the main storage concern — resolved)

Commons originals (10–50 MB museum scans) are downloaded once during seeding, resized,
then discarded. Stored tiers:

| Tier | Size | Used for | ~Per file |
|---|---|---|---|
| Thumb | ~400px | timeline, artist cards | 30–80 KB |
| Gallery texture | 1024–2048px (+KTX2 variant) | hung in the 3D museum | 300 KB–1 MB |
| Inspect | ~3000px | zoomed inspect view | 1–3 MB |

Estimated total for ~500 paintings: **1.5–3 GB** — trivial against 38 GB free.
Attribution/license metadata is kept per image (sourced from Commons API) and surfaced
in the inspect view.

---

## Data Model

SQLite schema during seeding; exported to JSON for the static site. Same shape either way:

```
periods    id, name, slug, start_year, end_year, summary, color/theme,
           wikipedia_url

artists    id, period_id, name, slug, birth_year, death_year,
           active_from, active_to,          -- drives timeline position
           portrait_path, portrait_attribution,
           bio_short (placard), bio_long, why_they_matter,
           wikipedia_url

paintings  id, artist_id, title, year, year_display,
           image_status,                    -- 'free' | 'placeholder' | 'override'
           thumb_path, gallery_path, inspect_path,   -- local tiered files (null if placeholder)
           width_cm, height_cm,             -- real aspect/scale for the gallery
           story, fun_facts (json array),
           license, attribution, commons_url, wikipedia_url
```

Every row keeps its source URL so facts are traceable back to Wikipedia.

---

## Content Scope (minimums from the brief)

- **≥ 12 periods**, comprehensive: Medieval, Gothic, Renaissance, Baroque, Rococo,
  Neoclassicism, Romanticism, Realism, Impressionism, Post-Impressionism, Expressionism,
  Cubism, Surrealism, Abstract Expressionism, Pop Art, Contemporary (16 candidates —
  trim/merge during data work, never below 12).
- **≥ 3 artists per period**, positioned by real working dates.
- **≥ 8 paintings per artist**; images are public-domain from Wikimedia Commons where
  available, placeholder canvases (with full Wikipedia metadata) where not. Post-1930
  periods lean on PD-eligible artists (e.g. Kandinsky, Klee, Mondrian, Gris, Delaunay)
  for image-rich museums.
- Rough total: ~14 periods × ~4 artists × ~9 paintings ≈ **500 paintings** ingested.

**Hard rule:** if a fact or image isn't on Wikipedia/Commons, it doesn't go in. No AI-generated
artwork, bios, stories, or fun facts. "Fun facts" are extracted from the painting's/artist's
Wikipedia article text, with source URL stored.

---

## Phases

### Phase 1 — Foundation & Data Pipeline
1. Scaffold Next.js + TypeScript project (static export config); SQLite schema.
2. Build the ingestion pipeline (runs locally):
   - Curated seed list of periods → artists → notable paintings (names/QIDs only; the
     curation is editorial, the *content* all comes from Wikipedia).
   - Fetch bios, dates, summaries via Wikipedia REST API / Wikidata.
   - Fetch painting images + metadata + license info via Commons API; verify
     public-domain status; download originals → produce thumb/gallery/inspect tiers
     (+ KTX2) → discard originals.
   - Validation pass: enforce the 12/3/8 minimums, flag gaps for manual curation fixes.
3. JSON export step: per-route data files the static site reads at build time.

**Exit criteria:** data seeded and validated against the minimums; image tiers on disk;
JSON export clean.

### Phase 2 — The Timeline
> 🔔 **CHECK-IN #1 (before building):** present 3 design directions (A/B/C) for the
> timeline view, one-line tradeoff each. Wait for the pick.

1. Infinite-canvas timeline: zoomable/pannable, organized by real dates.
   - Zoomed out: the full sweep of periods as named bands/nodes.
   - Zoom into a period: its artists appear, positioned by actual working dates.
2. Filter UI — period + artist filter as an interactive dropdown that swaps content with
   smooth GSAP animation. This is a designed "moment," not a plain select.
3. Artist card — museum-placard quality: portrait, dates, a few lines on who they were
   and why they mattered. Timeless typography (think engraved wall label).

> 🔔 **CHECK-IN #2:** show the artist-card design on one artist before applying it to all.

**Exit criteria:** timeline navigable across all periods/artists; filter animated; cards live.

### Phase 3 — The 3D Museum
> 🔔 **CHECK-IN #3:** propose (a) the interaction for entering an artist's museum from the
> card/timeline, and (b) the click-to-inspect interaction for paintings. Wait for approval.

1. First-person walkable gallery per artist (WASD + mouse look, pointer lock), paintings
   hung at real relative scale where dimensions are known.
2. One clean classical gallery layout for all artists, procedurally sized to the
   artist's painting count (8+).
3. Inspect view on click: zoomed high-res image + title, year, story, fun facts.

**Exit criteria:** any artist's museum walkable; every painting inspectable with real data.

### Phase 4 — Visual Realism Pass
The realism is the point — treated as its own phase, not a garnish:
- Physically-based materials throughout (walls, frames, floor, benches).
- Individual spotlight per painting; soft shadows (PCF/contact shadows).
- Subtle glare/sheen on frames and canvas varnish (clearcoat / env-map reflections).
- Reflective polished floor (screen-space or planar reflections, tuned subtle).
- Proper tone mapping (ACES/AgX) + exposure tuning; light bounce feel via baked or
  ambient techniques.
- Performance budget: target 60fps on a mid-range GPU; texture streaming/compression
  (KTX2), draw-call discipline, quality toggle if needed.

**Exit criteria:** side-by-side against a "lazy Three.js demo," this clearly isn't one.

### Phase 5 — Polish, Deploy & Integration
- Seamless transitions: timeline → card → museum entry → back out.
- Loading states (museum asset preload with a tasteful progress treatment).
- Image attribution/licensing surfaced appropriately (Commons requirement).
- ~~Mobile/touch: graceful fallback for the timeline; museum desktop-first.~~ → deferred
  to Future Ideas (2026-07-03).
- Final data QA sweep: dates, spellings, broken image files.
- **Deploy:** rsync static export + images to the VM; add the Caddyfile site block for
  `gallery.lokset.dev` with gzip + long-lived cache headers for `/images/`; deploy
  script so future updates are one command.

**Exit criteria:** live on the VM behind Caddy; repeat deploys are a single script run.

---

## Check-In Summary (from the brief — kept short when they happen)

| # | When | What |
|---|---|---|
| 1 | Before timeline build | 3 timeline design directions, A/B/C, one-line tradeoff each |
| 2 | After first artist card | Card design approval before applying everywhere |
| 3 | Before museum build | Museum-entry interaction + painting click-to-inspect interaction |

---

## Future Ideas (explicitly out of scope for the initial build)

- **Ambient classical music** while walking the galleries — light, period-appropriate
  selections. Revisit after launch.
- **Mobile/touch fallback** (timeline touch pan/zoom, museum touch controls) — deferred
  from Phase 5 by decision 2026-07-03; desktop-first ships first.

---

## Open Questions

None — all resolved.

### Resolved
- ~~Database~~ → SQLite at seed time, static JSON at runtime. No hosted DB.
- ~~Image hosting~~ → tiered files on the VM's disk, served by Caddy. No CDN, no proxy,
  no hotlinking; estimated 1.5–3 GB total.
- ~~Stack / hosting~~ → Next.js static export built locally, rsync to the Oracle VM,
  served by the existing Caddy.
- ~~Contemporary / copyrighted periods~~ → all notable artists included with full cards
  and museums; non-free paintings hang as placeholder canvases with real Wikipedia
  metadata. Owner-managed local override folder swaps a placeholder for a real image
  file by slug, no code changes.
- ~~Gallery architecture~~ → one clean classical layout for all artists (procedurally
  sized to painting count). Period-themed rooms judged too ambitious for v1.
- ~~Curation source~~ → hand-curated seed list (Claude curates artists/paintings);
  all *content* still strictly from Wikipedia/Commons.
- ~~Subdomain~~ → `gallery.lokset.dev`.
