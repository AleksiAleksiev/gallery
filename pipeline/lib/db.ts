import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.resolve("data");
export const DB_PATH = path.join(DATA_DIR, "gallery.sqlite");

export function openDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS periods (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      start_year INTEGER NOT NULL,
      end_year INTEGER NOT NULL,
      summary TEXT,
      accent TEXT,
      wikipedia_url TEXT
    );

    CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY,
      period_slug TEXT NOT NULL REFERENCES periods(slug),
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      qid TEXT,
      birth_year INTEGER,
      death_year INTEGER,
      active_from INTEGER,
      active_to INTEGER,
      portrait_file TEXT,    -- "File:..." on Commons (P18)
      portrait_path TEXT,
      portrait_attribution TEXT,
      placard TEXT,          -- one-line description (Wikidata/Wikipedia)
      bio_short TEXT,        -- lead extract (REST summary)
      bio_long TEXT,         -- fuller plain-text extract
      copyrighted INTEGER NOT NULL DEFAULT 0,
      wikipedia_url TEXT
    );

    CREATE TABLE IF NOT EXISTS paintings (
      id INTEGER PRIMARY KEY,
      artist_slug TEXT NOT NULL REFERENCES artists(slug),
      slug TEXT NOT NULL,
      qid TEXT,
      title TEXT NOT NULL,
      year INTEGER,
      year_display TEXT,
      image_status TEXT NOT NULL DEFAULT 'placeholder',  -- free | placeholder | override
      commons_file TEXT,     -- "File:..." name on Commons (when free)
      thumb_path TEXT,
      gallery_path TEXT,
      inspect_path TEXT,
      img_width INTEGER,     -- pixel dims of processed gallery tier
      img_height INTEGER,
      width_cm REAL,
      height_cm REAL,
      story TEXT,
      fun_facts TEXT,        -- JSON array of strings
      license TEXT,
      attribution TEXT,
      commons_url TEXT,
      wikipedia_url TEXT,
      sitelinks INTEGER DEFAULT 0,
      must_include INTEGER NOT NULL DEFAULT 0,
      UNIQUE(artist_slug, slug)
    );
  `);
  return db;
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "untitled";
}
