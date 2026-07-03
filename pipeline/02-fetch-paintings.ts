// Stage 2: paintings per artist.
// Candidates come from Wikidata (paintings whose creator P170 is the artist),
// ranked: must-include matches first, then "has enwiki article + has image",
// then sitelink count (notability proxy). Stories are the lead extract of the
// painting's own Wikipedia article; fun facts are verbatim sentences extracted
// (not generated) from the article body. License/attribution from Commons.

import { ARTISTS, PAINTINGS_TARGET } from "./seed-data";
import { openDb, slugify } from "./lib/db";
import { commonsImageInfo, sparql, wikipediaExtract, wikipediaSummary } from "./lib/wiki";

interface Candidate {
  qid: string;
  label: string;
  year: number | null;
  yearDisplay: string | null;
  image: string | null; // Commons file name (decoded)
  heightCm: number | null;
  widthCm: number | null;
  sitelinks: number;
  enwiki: string | null; // article title
  mustIncludeRank: number; // -1 if not matched
}

/**
 * Numeric year + placard string honoring Wikidata time precision: exact years
 * (11–9) print as-is, decades (8) as "1610s", anything vaguer is omitted —
 * better no date than a confidently wrong one.
 */
export function interpretDate(
  year: number | null,
  precision: number,
): { year: number | null; yearDisplay: string | null } {
  if (year == null || precision < 8) {
    return { year: null, yearDisplay: null };
  }
  if (precision === 8) {
    return { year, yearDisplay: `${year}s` };
  }
  return { year, yearDisplay: String(year) };
}

function normalize(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Each must-include entry claims exactly ONE candidate: exact normalized title
// match beats substring containment, sitelinks break ties. Flagging every
// substring match let series/version titles swallow the museum — Van Gogh's
// "Sunflowers" + "Bedroom in Arles" matched 7 candidates and left one slot
// for everything else.
function assignMustIncludes(candidates: Candidate[], mustInclude: string[]): void {
  for (let i = 0; i < mustInclude.length; i++) {
    const want = normalize(mustInclude[i]);
    let best: Candidate | null = null;
    let bestKey = -1;
    for (const c of candidates) {
      if (c.mustIncludeRank >= 0) {
        continue; // already claimed by an earlier entry
      }
      const names = [normalize(c.label), c.enwiki ? normalize(c.enwiki.replace(/\s*\([^)]*\)\s*$/, "")) : ""];
      let quality = 0;
      for (const n of names) {
        if (n === "") {
          continue;
        }
        if (n === want) {
          quality = Math.max(quality, 2);
        } else if (n.includes(want) || want.includes(n)) {
          quality = Math.max(quality, 1);
        }
      }
      if (quality === 0) {
        continue;
      }
      const key = quality * 1_000_000 + c.sitelinks;
      if (key > bestKey) {
        bestKey = key;
        best = c;
      }
    }
    if (best) {
      best.mustIncludeRank = i;
    }
  }
}

// Verbatim sentence extraction — keyword-gated, length-bounded. No generation.
const FACT_RE =
  /\b(stolen|theft|thief|recovered|vandal|attack|slashed|forg|x-ray|infrared|underneath|hidden|discover|auction|sold for|record price|million|insured|smuggl|looted|nazi|recovered|myth|legend|parod|referenced|pop culture|largest|smallest|first|unfinished|commissioned by|rejected|scandal|controvers|destroyed|fire|war|restor)\w*/i;

function extractFunFacts(articleText: string, story: string): string[] {
  const body = articleText.slice(story.length); // skip the lead we already show
  const sentences = body
    .replace(/\n==+[^=]+==+\n/g, "\n")
    .split(/(?<=[.!?])\s+(?=[A-Z“"])/);
  const facts: string[] = [];
  for (const raw of sentences) {
    const s = raw.replace(/\s+/g, " ").trim();
    if (s.length >= 70 && s.length <= 320 && FACT_RE.test(s) && !s.includes("==")) {
      facts.push(s);
    }
    if (facts.length >= 4) {
      break;
    }
  }
  return facts;
}

async function candidatesFor(artistQid: string): Promise<Candidate[]> {
  // The item selection is a subquery ordered by sitelinks so the 400-item
  // window is the *most notable* 400 works, not an arbitrary 400. (Prolific
  // artists like Turner have thousands of catalogued works; an unordered
  // LIMIT — which also counted duplicate rows from the OPTIONALs — routinely
  // missed their famous paintings entirely.)
  const query = `
    SELECT ?item ?itemLabel ?date ?datePrec ?image ?heightM ?widthM ?sitelinks ?article WHERE {
      {
        SELECT ?item ?sitelinks WHERE {
          ?item wdt:P170 wd:${artistQid} .
          ?item wdt:P31/wdt:P279* wd:Q3305213 .
          ?item wikibase:sitelinks ?sitelinks .
        } ORDER BY DESC(?sitelinks) LIMIT 400
      }
      # Inception with its precision: a raw "+1500" can mean the year 1500, the
      # 1500s decade, or the 16th century — the placard must not print a
      # century-precision value as an exact year (Duccio was once dated 2000).
      OPTIONAL {
        ?item p:P571 ?dateSt .
        ?dateSt a wikibase:BestRank ;
                psv:P571 [ wikibase:timeValue ?date ; wikibase:timePrecision ?datePrec ] .
      }
      OPTIONAL { ?item wdt:P18 ?image . }
      # psn: is the unit-normalized value (always metres) — raw wdt: amounts
      # arrive in whatever unit each statement uses (cm for most paintings,
      # mm/inches for many), which once scaled Starry Night Over the Rhône to
      # 9 m. BestRank keeps deprecated/secondary statements out.
      OPTIONAL {
        ?item p:P2048 ?hSt .
        ?hSt a wikibase:BestRank ; psn:P2048/wikibase:quantityAmount ?heightM .
      }
      OPTIONAL {
        ?item p:P2049 ?wSt .
        ?wSt a wikibase:BestRank ; psn:P2049/wikibase:quantityAmount ?widthM .
      }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;
  const rows = await sparql<Record<string, { value: string } | undefined>>(query);

  const byQid = new Map<string, Candidate>();
  for (const row of rows) {
    const qid = row.item!.value.split("/").pop()!;
    if (byQid.has(qid)) {
      continue;
    }
    const label = row.itemLabel?.value ?? "";
    if (label === "" || label === qid) {
      continue; // unlabeled items make poor museum placards
    }
    const yearMatch = row.date?.value.match(/^([+-]?\d{1,4})-/);
    const { year, yearDisplay } = interpretDate(
      yearMatch ? parseInt(yearMatch[1], 10) : null,
      row.datePrec ? parseInt(row.datePrec.value, 10) : 9,
    );
    byQid.set(qid, {
      qid,
      label,
      year,
      yearDisplay,
      image: row.image ? decodeURIComponent(row.image.value.split("/Special:FilePath/").pop()!).replace(/_/g, " ") : null,
      heightCm: row.heightM ? parseFloat(row.heightM.value) * 100 : null,
      widthCm: row.widthM ? parseFloat(row.widthM.value) * 100 : null,
      sitelinks: row.sitelinks ? parseInt(row.sitelinks.value, 10) : 0,
      enwiki: row.article ? decodeURIComponent(row.article.value.split("/wiki/").pop()!).replace(/_/g, " ") : null,
      mustIncludeRank: -1,
    });
  }
  return [...byQid.values()];
}

async function main(): Promise<void> {
  const db = openDb();
  // Optional targeted re-run: `npm run seed:paintings -- <artist-slug> ...`
  const onlySlugs = new Set(process.argv.slice(2));
  let artists = db
    .prepare("SELECT slug, name, qid, copyrighted FROM artists")
    .all() as { slug: string; name: string; qid: string; copyrighted: number }[];
  if (onlySlugs.size > 0) {
    artists = artists.filter((a) => onlySlugs.has(a.slug));
    console.log(`Targeted run: ${artists.map((a) => a.slug).join(", ") || "(no slugs matched!)"}`);
  }
  // Seed entries are keyed by Wikipedia title; artists in the DB use the
  // canonical (post-redirect) title. Match on either slug or exact name.
  function seedFor(artist: { slug: string; name: string }) {
    return ARTISTS.find((a) => slugify(a.wiki) === artist.slug || a.wiki === artist.name);
  }

  const insert = db.prepare(`
    INSERT INTO paintings (artist_slug, slug, qid, title, year, year_display, image_status,
      commons_file, width_cm, height_cm, story, fun_facts, license, attribution,
      commons_url, wikipedia_url, sitelinks, must_include)
    VALUES (@artist, @slug, @qid, @title, @year, @yearDisplay, @status,
      @commonsFile, @widthCm, @heightCm, @story, @funFacts, @license, @attribution,
      @commonsUrl, @wikipediaUrl, @sitelinks, @mustInclude)
    ON CONFLICT(artist_slug, slug) DO UPDATE SET
      qid=@qid, title=@title, year=@year, year_display=@yearDisplay, image_status=@status,
      commons_file=@commonsFile, width_cm=@widthCm, height_cm=@heightCm, story=@story,
      fun_facts=@funFacts, license=@license, attribution=@attribution,
      commons_url=@commonsUrl, wikipedia_url=@wikipediaUrl, sitelinks=@sitelinks,
      must_include=@mustInclude
  `);

  for (const artist of artists) {
    const mustInclude = seedFor(artist)?.mustInclude ?? [];

    let candidates: Candidate[];
    try {
      candidates = await candidatesFor(artist.qid);
    } catch (err) {
      console.error(`FAIL    ${artist.name}: SPARQL ${(err as Error).message}`);
      continue;
    }

    assignMustIncludes(candidates, mustInclude);
    candidates.sort((a, b) => {
      const aMust = a.mustIncludeRank >= 0 ? 0 : 1;
      const bMust = b.mustIncludeRank >= 0 ? 0 : 1;
      if (aMust !== bMust) {
        return aMust - bMust;
      }
      if (aMust === 0) {
        return a.mustIncludeRank - b.mustIncludeRank;
      }
      const aScore = (a.enwiki ? 2 : 0) + (a.image ? 1 : 0);
      const bScore = (b.enwiki ? 2 : 0) + (b.image ? 1 : 0);
      if (aScore !== bScore) {
        return bScore - aScore;
      }
      return b.sitelinks - a.sitelinks;
    });

    const picked = candidates.slice(0, PAINTINGS_TARGET);
    const pickedSlugs = picked.map((c) => slugify(c.label) + "-" + c.qid.toLowerCase());
    let stored = 0;
    for (const c of picked) {
      let story = "";
      let funFacts: string[] = [];
      let wikipediaUrl = "";
      if (c.enwiki) {
        try {
          const summary = await wikipediaSummary(c.enwiki);
          story = summary.extract ?? "";
          wikipediaUrl = summary.content_urls?.desktop?.page ?? "";
          const full = await wikipediaExtract(c.enwiki);
          funFacts = extractFunFacts(full, story);
        } catch {
          /* article fetch is best-effort */
        }
      }

      let status = "placeholder";
      let license: string | null = null;
      let attribution: string | null = null;
      let commonsUrl: string | null = null;
      if (c.image) {
        try {
          const info = await commonsImageInfo(c.image);
          if (info?.thumburl) {
            status = "free";
            license = info.extmetadata?.LicenseShortName?.value ?? null;
            attribution = (info.extmetadata?.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim() || null;
            commonsUrl = info.descriptionurl ?? null;
          }
        } catch {
          /* image stays placeholder */
        }
      }

      insert.run({
        artist: artist.slug,
        slug: slugify(c.label) + "-" + c.qid.toLowerCase(),
        qid: c.qid,
        title: c.label,
        year: c.year,
        yearDisplay: c.yearDisplay,
        status,
        commonsFile: status === "free" ? c.image : null,
        widthCm: c.widthCm,
        heightCm: c.heightCm,
        story,
        funFacts: JSON.stringify(funFacts),
        license,
        attribution,
        commonsUrl,
        wikipediaUrl,
        sitelinks: c.sitelinks,
        mustInclude: c.mustIncludeRank >= 0 ? 1 : 0,
      });
      stored++;
    }
    // Reconcile: drop previously stored paintings that are no longer picked,
    // so re-runs define the museum instead of accreting stale rows. (Only
    // reached when the SPARQL fetch succeeded — a failed fetch keeps old data.)
    const removed =
      pickedSlugs.length === 0
        ? 0
        : db
            .prepare(
              `DELETE FROM paintings WHERE artist_slug = ? AND slug NOT IN (${pickedSlugs.map(() => "?").join(",")})`,
            )
            .run(artist.slug, ...pickedSlugs).changes;
    const free = picked.filter((c) => c.image).length;
    console.log(
      `${artist.name.padEnd(30)} ${stored} paintings (${free} with images, ${candidates.length} candidates` +
        (removed > 0 ? `, ${removed} stale removed` : "") +
        `)`,
    );
  }
  console.log("\nDone.");
}

main();
