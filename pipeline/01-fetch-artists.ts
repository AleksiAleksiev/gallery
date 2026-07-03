// Stage 1: periods + artists.
// Period summaries from Wikipedia; artist bios from Wikipedia REST summaries +
// full extracts; dates and portrait file from Wikidata.

import { ARTISTS, PERIODS } from "./seed-data";
import { openDb, slugify } from "./lib/db";
import { resolveQid, wikidataEntity, wikipediaExtract, wikipediaSummary } from "./lib/wiki";

interface Claims {
  claims?: Record<string, { mainsnak?: { datavalue?: { value: unknown } } }[]>;
}

function claimYear(entity: Claims, prop: string): number | null {
  const value = entity.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value as { time?: string } | undefined;
  const match = value?.time?.match(/^([+-]\d+)-/);
  return match ? parseInt(match[1], 10) : null;
}

function claimString(entity: Claims, prop: string): string | null {
  const value = entity.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" ? value : null;
}

async function main(): Promise<void> {
  const db = openDb();

  const upsertPeriod = db.prepare(`
    INSERT INTO periods (slug, name, start_year, end_year, summary, accent, wikipedia_url)
    VALUES (@slug, @name, @startYear, @endYear, @summary, @accent, @url)
    ON CONFLICT(slug) DO UPDATE SET
      name=@name, start_year=@startYear, end_year=@endYear,
      summary=@summary, accent=@accent, wikipedia_url=@url
  `);

  for (const period of PERIODS) {
    const summary = await wikipediaSummary(period.wiki);
    upsertPeriod.run({
      ...period,
      summary: summary.extract ?? "",
      url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${period.wiki.replace(/ /g, "_")}`,
    });
    console.log(`period  ${period.name}`);
  }

  const upsertArtist = db.prepare(`
    INSERT INTO artists (period_slug, slug, name, qid, birth_year, death_year,
      active_from, active_to, placard, bio_short, bio_long, copyrighted, wikipedia_url)
    VALUES (@period, @slug, @name, @qid, @birth, @death,
      @activeFrom, @activeTo, @placard, @bioShort, @bioLong, @copyrighted, @url)
    ON CONFLICT(slug) DO UPDATE SET
      period_slug=@period, name=@name, qid=@qid, birth_year=@birth, death_year=@death,
      active_from=@activeFrom, active_to=@activeTo, placard=@placard,
      bio_short=@bioShort, bio_long=@bioLong, copyrighted=@copyrighted, wikipedia_url=@url
  `);
  const setPortraitFile = db.prepare("UPDATE artists SET portrait_file=@file WHERE slug=@slug");

  const failures: string[] = [];
  for (const seed of ARTISTS) {
    try {
      const resolved = await resolveQid(seed.wiki);
      if (!resolved) {
        throw new Error("no QID");
      }
      const [summary, extract, entity] = [
        await wikipediaSummary(seed.wiki),
        await wikipediaExtract(seed.wiki),
        await wikidataEntity(resolved.qid),
      ];

      const birth = claimYear(entity, "P569");
      const death = claimYear(entity, "P570");
      let activeFrom = claimYear(entity, "P2031") ?? (birth ? birth + 20 : null);
      let activeTo = claimYear(entity, "P2032") ?? death ?? null;
      // Work-period claims are sometimes junk imports (Leonardo's Q762 says
      // 1519–1519); discard any span that doesn't start before it ends.
      if (activeFrom !== null && activeTo !== null && activeFrom >= activeTo) {
        console.warn(`        degenerate work period ${activeFrom}–${activeTo} for ${seed.wiki}, using fallback`);
        activeFrom = birth ? birth + 20 : null;
        activeTo = death ?? null;
      }
      if (seed.activeFrom !== undefined) {
        activeFrom = seed.activeFrom;
      }
      if (seed.activeTo !== undefined) {
        activeTo = seed.activeTo;
      }
      const slug = slugify(resolved.canonicalTitle);

      upsertArtist.run({
        period: seed.period,
        slug,
        name: resolved.canonicalTitle,
        qid: resolved.qid,
        birth,
        death,
        activeFrom,
        activeTo,
        placard: summary.description ?? "",
        bioShort: summary.extract ?? "",
        bioLong: extract.split("\n\n").slice(0, 6).join("\n\n").slice(0, 4000),
        copyrighted: seed.copyrighted ? 1 : 0,
        url: summary.content_urls?.desktop?.page ?? "",
      });

      // Portrait Commons file name (P18); downloaded/processed in stage 3.
      const portraitFile = claimString(entity, "P18");
      if (portraitFile) {
        setPortraitFile.run({ file: "File:" + portraitFile, slug });
      }
      console.log(`artist  ${resolved.canonicalTitle} (${resolved.qid}) ${birth ?? "?"}–${death ?? ""}`);
    } catch (err) {
      failures.push(`${seed.wiki}: ${(err as Error).message}`);
      console.error(`FAIL    ${seed.wiki}: ${(err as Error).message}`);
    }
  }

  console.log(`\nDone. ${ARTISTS.length - failures.length}/${ARTISTS.length} artists ingested.`);
  if (failures.length > 0) {
    console.log("Failures:\n  " + failures.join("\n  "));
    process.exitCode = 1;
  }
}

main();
