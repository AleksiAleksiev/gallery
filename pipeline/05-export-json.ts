// Stage 5: export the DB to static JSON consumed by the Next.js build.
//   data/json/timeline.json          — periods + artist placards (timeline view)
//   data/json/artists/<slug>.json    — full artist + paintings (museum pages)

import fs from "node:fs";
import path from "node:path";
import { openDb } from "./lib/db";

const OUT = path.resolve("data", "json");
const db = openDb();

// Image URLs carry a fingerprint of the file on disk (?v=…) so that a
// replaced image — an owner override, a reprocessed tier — is a NEW url.
// Without it the 30-day browser cache keeps serving the old pixels: the
// Beethoven Frieze override was invisible to anyone who had visited before.
function versioned(p: unknown): string | null {
  if (typeof p !== "string" || !p) {
    return null;
  }
  try {
    const st = fs.statSync(path.join("public", p.replace(/^\//, "")));
    return `${p}?v=${st.size.toString(36)}${Math.floor(st.mtimeMs / 1000).toString(36)}`;
  } catch {
    return p; // file missing: leave the path alone, stage 4 flags it anyway
  }
}

// Commons extmetadata artifacts: flattened HTML doubles the author text
// ("Unknown authorUnknown author") and appends restoration credits.
function cleanAttribution(s: unknown): string | null {
  if (typeof s !== "string" || !s.trim()) {
    return null;
  }
  const t = s.replace(/\s+/g, " ").replace(/\s*(Restored|Retouched|Cropped|Edited) by\b.*$/i, "").trim();
  // No-credit credits: "Unknown author", "Anonymous; <biography prose>",
  // "Original uploader was …" — worthless on a placard, drop entirely.
  if (/^(unknown|anonymous|unattributed|non.identified)/i.test(t) || /original uploader/i.test(t)) {
    return null;
  }
  // Commons extmetadata sometimes doubles the text ("Carl Van VechtenCarl Van Vechten")
  if (t.length % 2 === 0) {
    const half = t.slice(0, t.length / 2);
    if (half + half === t) {
      return half.trim() || null;
    }
  }
  return t || null;
}

const periods = db.prepare("SELECT * FROM periods ORDER BY start_year").all() as Record<string, unknown>[];
const artists = db.prepare("SELECT * FROM artists ORDER BY active_from, birth_year").all() as Record<string, unknown>[];
const paintingsByArtist = db.prepare(
  "SELECT * FROM paintings WHERE artist_slug=? ORDER BY must_include DESC, sitelinks DESC",
) as unknown as { all: (slug: string) => Record<string, unknown>[] };

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "artists"), { recursive: true });

const timeline = {
  periods: periods.map((p) => ({
    slug: p.slug,
    name: p.name,
    startYear: p.start_year,
    endYear: p.end_year,
    summary: p.summary,
    accent: p.accent,
    wikipediaUrl: p.wikipedia_url,
    artists: artists
      .filter((a) => a.period_slug === p.slug)
      .map((a) => ({
        slug: a.slug,
        name: a.name,
        birthYear: a.birth_year,
        deathYear: a.death_year,
        activeFrom: a.active_from,
        activeTo: a.active_to,
        portrait: versioned(a.portrait_path),
        portraitAttribution: cleanAttribution(a.portrait_attribution),
        placard: a.placard,
        bioShort: a.bio_short,
        copyrighted: !!a.copyrighted,
        wikipediaUrl: a.wikipedia_url,
      })),
  })),
};
fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify(timeline, null, 1));

for (const a of artists) {
  const paintings = paintingsByArtist.all(a.slug as string).map((pt) => ({
    slug: pt.slug,
    title: pt.title,
    year: pt.year,
    yearDisplay: pt.year_display,
    imageStatus: pt.image_status,
    thumb: versioned(pt.thumb_path),
    gallery: versioned(pt.gallery_path),
    inspect: versioned(pt.inspect_path),
    imgWidth: pt.img_width,
    imgHeight: pt.img_height,
    widthCm: pt.width_cm,
    heightCm: pt.height_cm,
    story: pt.story,
    funFacts: JSON.parse((pt.fun_facts as string) || "[]"),
    license: pt.license,
    attribution: cleanAttribution(pt.attribution),
    commonsUrl: pt.commons_url,
    wikipediaUrl: pt.wikipedia_url,
  }));
  const full = {
    slug: a.slug,
    name: a.name,
    periodSlug: a.period_slug,
    birthYear: a.birth_year,
    deathYear: a.death_year,
    activeFrom: a.active_from,
    activeTo: a.active_to,
    portrait: versioned(a.portrait_path),
    portraitAttribution: cleanAttribution(a.portrait_attribution),
    placard: a.placard,
    bioShort: a.bio_short,
    bioLong: a.bio_long,
    copyrighted: !!a.copyrighted,
    wikipediaUrl: a.wikipedia_url,
    paintings,
  };
  fs.writeFileSync(path.join(OUT, "artists", `${a.slug}.json`), JSON.stringify(full, null, 1));
}

console.log(`Exported timeline.json + ${artists.length} artist files to data/json/`);
