// Stage 4: validation against the brief's minimums.
//   >= 12 periods, >= 3 artists per period, >= 8 paintings per artist museum.
// Reports gaps (missing must-includes, placeholder-only museums, missing
// dates/bios) so curation fixes are targeted. Exits non-zero on hard failures.

import { openDb } from "./lib/db";
import { ARTISTS, PAINTINGS_MIN } from "./seed-data";

const db = openDb();

const periods = db
  .prepare(`
    SELECT p.slug, p.name, COUNT(a.id) AS artists
    FROM periods p LEFT JOIN artists a ON a.period_slug = p.slug
    GROUP BY p.slug ORDER BY p.start_year
  `)
  .all() as { slug: string; name: string; artists: number }[];

const artists = db
  .prepare(`
    SELECT a.slug, a.name, a.period_slug, a.copyrighted, a.birth_year, a.bio_short, a.portrait_path,
      COUNT(pt.id) AS paintings,
      SUM(CASE WHEN pt.image_status != 'placeholder' THEN 1 ELSE 0 END) AS with_image,
      SUM(pt.must_include) AS must_hits
    FROM artists a LEFT JOIN paintings pt ON pt.artist_slug = a.slug
    GROUP BY a.slug ORDER BY a.period_slug, a.name
  `)
  .all() as {
  slug: string; name: string; period_slug: string; copyrighted: number; birth_year: number | null;
  bio_short: string | null; portrait_path: string | null; paintings: number; with_image: number; must_hits: number;
}[];

let hardFailures = 0;
const warn = (msg: string) => console.log("  WARN  " + msg);
const fail = (msg: string) => {
  console.log("  FAIL  " + msg);
  hardFailures++;
};

console.log(`Periods: ${periods.length} (minimum 12)`);
if (periods.length < 12) {
  fail(`only ${periods.length} periods`);
}
for (const p of periods) {
  if (p.artists < 3) {
    fail(`${p.name}: ${p.artists} artists (minimum 3)`);
  }
}

console.log(`Artists: ${artists.length} (seed had ${ARTISTS.length})`);
for (const a of artists) {
  if (a.paintings < PAINTINGS_MIN) {
    fail(`${a.name}: ${a.paintings} paintings (minimum ${PAINTINGS_MIN})`);
  }
  if (!a.copyrighted && a.with_image < PAINTINGS_MIN) {
    warn(`${a.name}: only ${a.with_image}/${a.paintings} have images (PD artist — expected ${PAINTINGS_MIN}+)`);
  }
  if (a.copyrighted && a.with_image === 0 && a.paintings > 0) {
    // expected: placeholder museum
  }
  if (!a.birth_year) {
    warn(`${a.name}: no birth year (timeline position degraded)`);
  }
  if (!a.bio_short) {
    warn(`${a.name}: no bio`);
  }
  if (!a.portrait_path) {
    warn(`${a.name}: no portrait`);
  }
  const seed = ARTISTS.find((s) => s.wiki === a.name);
  if (seed && a.must_hits < Math.min(seed.mustInclude.length, 2)) {
    warn(`${a.name}: only ${a.must_hits}/${seed.mustInclude.length} must-include paintings matched`);
  }
}

const totals = db
  .prepare(`
    SELECT COUNT(*) AS n,
      SUM(CASE WHEN image_status='free' THEN 1 ELSE 0 END) AS free,
      SUM(CASE WHEN image_status='override' THEN 1 ELSE 0 END) AS override,
      SUM(CASE WHEN image_status='placeholder' THEN 1 ELSE 0 END) AS placeholder,
      SUM(CASE WHEN story != '' THEN 1 ELSE 0 END) AS with_story
    FROM paintings
  `)
  .get() as { n: number; free: number; override: number; placeholder: number; with_story: number };

console.log(
  `Paintings: ${totals.n} total — ${totals.free} free images, ${totals.placeholder} placeholders, ` +
    `${totals.override} overrides, ${totals.with_story} with stories`,
);
console.log(hardFailures > 0 ? `\n${hardFailures} hard failure(s).` : "\nAll minimums satisfied.");
process.exitCode = hardFailures > 0 ? 1 : 0;
