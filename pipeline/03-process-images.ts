// Stage 3: images.
// Downloads each free painting at <=3200px via Commons' server-side resizer
// (never the full multi-MB originals), then produces three tiers with sharp:
//   thumb   400px  webp  — timeline + cards
//   gallery 2048px webp  — 3D museum canvas texture
//   inspect 3000px jpg   — zoomed inspect view
// Also: artist portraits (600px), and the owner's overrides/ folder — any
// overrides/<artist-slug>/<painting-slug>.(jpg|png|webp) is processed into the
// same tiers and marks the painting image_status='override'.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { openDb } from "./lib/db";
import { commonsImageInfo, downloadFile } from "./lib/wiki";

const CACHE = path.resolve("data", "cache", "downloads");
const OUT = path.resolve("public", "images");
const OVERRIDES = path.resolve("overrides");

interface Tier {
  name: "thumb" | "gallery" | "inspect";
  width: number;
  format: "webp" | "jpeg";
  quality: number;
}
const TIERS: Tier[] = [
  { name: "thumb", width: 400, format: "webp", quality: 80 },
  { name: "gallery", width: 2048, format: "webp", quality: 85 },
  { name: "inspect", width: 3000, format: "jpeg", quality: 88 },
];

async function makeTiers(srcPath: string, artistSlug: string, paintingSlug: string) {
  const result: Record<string, string> = {};
  let galleryDims = { width: 0, height: 0 };
  for (const tier of TIERS) {
    const ext = tier.format === "webp" ? "webp" : "jpg";
    const rel = `/images/${tier.name}/${artistSlug}/${paintingSlug}.${ext}`;
    const dest = path.join(OUT, tier.name, artistSlug, `${paintingSlug}.${ext}`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const img = sharp(srcPath, { limitInputPixels: 1e9 })
      .rotate()
      .resize({ width: tier.width, withoutEnlargement: true });
    const info =
      tier.format === "webp"
        ? await img.webp({ quality: tier.quality }).toFile(dest)
        : await img.jpeg({ quality: tier.quality, mozjpeg: true }).toFile(dest);
    result[tier.name] = rel;
    if (tier.name === "gallery") {
      galleryDims = { width: info.width, height: info.height };
    }
  }
  return { paths: result, galleryDims };
}

function findOverride(artistSlug: string, paintingSlug: string): string | null {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const p = path.join(OVERRIDES, artistSlug, `${paintingSlug}.${ext}`);
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

async function main(): Promise<void> {
  const db = openDb();
  const update = db.prepare(`
    UPDATE paintings SET image_status=@status, thumb_path=@thumb, gallery_path=@gallery,
      inspect_path=@inspect, img_width=@imgWidth, img_height=@imgHeight
    WHERE artist_slug=@artist AND slug=@slug
  `);

  const paintings = db
    .prepare("SELECT artist_slug, slug, title, commons_file, image_status, gallery_path FROM paintings")
    .all() as {
    artist_slug: string; slug: string; title: string; commons_file: string | null;
    image_status: string; gallery_path: string | null;
  }[];

  let done = 0;
  let placeholders = 0;
  let failures = 0;
  let skipped = 0;
  for (const p of paintings) {
    try {
      // Owner overrides win over everything (incl. previously processed free images).
      const override = findOverride(p.artist_slug, p.slug);

      // Resume support: skip paintings whose tiers already exist on disk
      // (unless an override has appeared since they were processed).
      if (!override && p.gallery_path && fs.existsSync(path.join("public", p.gallery_path))) {
        skipped++;
        continue;
      }
      let src: string | null = null;
      let status = p.image_status;
      if (override) {
        src = override;
        status = "override";
      } else if (p.commons_file) {
        let info = await commonsImageInfo(p.commons_file);
        // Commons rounds iiurlwidth UP to standard buckets (…1920px, 3840px)
        // and permanently refuses renders over roughly 30 MP — very tall scans
        // (e.g. 7669x20230 panel photos) blow that budget at the 3840 bucket.
        // Step down to the largest standard bucket that stays under it.
        const MAX_RENDER_PX = 25e6;
        if (info?.width && info.height) {
          const aspect = info.height / info.width;
          const renderArea = (w: number) => w * w * aspect;
          if (renderArea(info.thumbwidth ?? 3840) > MAX_RENDER_PX) {
            for (const bucket of [1920, 1280, 960, 500]) {
              if (renderArea(bucket) <= MAX_RENDER_PX) {
                info = (await commonsImageInfo(p.commons_file, bucket)) ?? info;
                break;
              }
            }
          }
        }
        const url = info?.thumburl ?? info?.url;
        if (url) {
          src = await downloadFile(url, path.join(CACHE, p.artist_slug, p.slug + path.extname(new URL(url).pathname)));
          status = "free";
        }
      }
      if (!src) {
        placeholders++;
        update.run({
          status: "placeholder", thumb: null, gallery: null, inspect: null,
          imgWidth: null, imgHeight: null, artist: p.artist_slug, slug: p.slug,
        });
        continue;
      }
      const { paths, galleryDims } = await makeTiers(src, p.artist_slug, p.slug);
      update.run({
        status,
        thumb: paths.thumb,
        gallery: paths.gallery,
        inspect: paths.inspect,
        imgWidth: galleryDims.width,
        imgHeight: galleryDims.height,
        artist: p.artist_slug,
        slug: p.slug,
      });
      done++;
      if (done % 25 === 0) {
        console.log(`...${done} paintings processed`);
      }
    } catch (err) {
      failures++;
      console.error(`FAIL    ${p.artist_slug}/${p.slug}: ${(err as Error).message}`);
    }
  }

  // Artist portraits.
  const artists = db
    .prepare("SELECT slug, portrait_file FROM artists WHERE portrait_file IS NOT NULL")
    .all() as { slug: string; portrait_file: string }[];
  const setPortrait = db.prepare("UPDATE artists SET portrait_path=@path, portrait_attribution=@attr WHERE slug=@slug");
  let portraits = 0;
  for (const a of artists) {
    try {
      const info = await commonsImageInfo(a.portrait_file, 600);
      const url = info?.thumburl ?? info?.url;
      if (!url) {
        continue;
      }
      const src = await downloadFile(url, path.join(CACHE, "_portraits", a.slug + path.extname(new URL(url).pathname)));
      const dest = path.join(OUT, "portraits", `${a.slug}.webp`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await sharp(src).rotate().resize({ width: 600, withoutEnlargement: true }).webp({ quality: 84 }).toFile(dest);
      const attr = (info?.extmetadata?.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim() || null;
      setPortrait.run({ path: `/images/portraits/${a.slug}.webp`, attr, slug: a.slug });
      portraits++;
    } catch (err) {
      console.error(`FAIL    portrait ${a.slug}: ${(err as Error).message}`);
    }
  }

  // Sweep orphans: tier files whose painting row was removed by a stage 2
  // reconcile would otherwise linger on disk and get deployed.
  const referenced = new Set<string>();
  for (const row of db
    .prepare("SELECT thumb_path, gallery_path, inspect_path FROM paintings")
    .all() as { thumb_path: string | null; gallery_path: string | null; inspect_path: string | null }[]) {
    for (const rel of [row.thumb_path, row.gallery_path, row.inspect_path]) {
      if (rel) {
        referenced.add(path.join("public", rel));
      }
    }
  }
  let orphans = 0;
  for (const tier of TIERS) {
    const tierDir = path.join(OUT, tier.name);
    if (!fs.existsSync(tierDir)) {
      continue;
    }
    for (const file of fs.readdirSync(tierDir, { recursive: true }) as string[]) {
      const abs = path.join(tierDir, file);
      if (fs.statSync(abs).isFile() && !referenced.has(path.relative(process.cwd(), abs))) {
        fs.unlinkSync(abs);
        orphans++;
      }
    }
  }

  console.log(
    `\nDone. ${done} paintings imaged, ${skipped} already done, ${placeholders} placeholders, ` +
      `${failures} failures, ${portraits} portraits, ${orphans} orphaned files removed.`,
  );
}

main();
