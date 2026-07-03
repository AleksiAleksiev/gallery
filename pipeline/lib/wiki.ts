// Rate-limited, disk-cached helpers for the Wikipedia / Wikidata / Commons APIs.
// Every response is cached under data/cache/api/ so re-runs are cheap and the
// pipeline is polite to the APIs (sequential, ~3 req/s, custom User-Agent).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CACHE_DIR = path.resolve("data", "cache", "api");
const UA = "GalleryMuseumSeed/1.0 (personal art-history project; one-time seed)";
let intervalMs = 350; // raised adaptively when the API pushes back
let lastRequest = 0;

async function throttle(): Promise<void> {
  const wait = lastRequest + intervalMs - Date.now();
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequest = Date.now();
}

export async function cachedJson<T>(url: string, init?: RequestInit): Promise<T> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const key = crypto.createHash("sha1").update(url + (init?.body ?? "")).digest("hex");
  const cacheFile = path.join(CACHE_DIR, key + ".json");
  if (fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8")) as T;
  }
  for (let attempt = 1; attempt <= 6; attempt++) {
    await throttle();
    let retryAfterMs = 0;
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": UA, Accept: "application/json", ...init?.headers },
      });
      if (res.status === 429 || res.status >= 500) {
        retryAfterMs = (parseInt(res.headers.get("retry-after") ?? "0", 10) || 0) * 1000;
        if (res.status === 429) {
          intervalMs = Math.min(intervalMs * 2, 5000); // permanently slow down
        }
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: true });
      }
      const json = await res.json();
      fs.writeFileSync(cacheFile, JSON.stringify(json));
      return json as T;
    } catch (err) {
      const e = err as Error & { fatal?: boolean };
      if (e.fatal || attempt === 6) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, Math.max(retryAfterMs, attempt * 4000)));
    }
  }
  throw new Error("unreachable");
}

// — Wikipedia —

export interface WikiSummary {
  title: string;
  description?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
  thumbnail?: { source: string };
}

export async function wikipediaSummary(title: string): Promise<WikiSummary> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`;
  return cachedJson<WikiSummary>(url);
}

/** Full plain-text extract of an article (intro + body, no markup). */
export async function wikipediaExtract(title: string): Promise<string> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1" +
    "&prop=extracts&explaintext=1&titles=" +
    encodeURIComponent(title);
  const json = await cachedJson<{ query?: { pages?: { extract?: string }[] } }>(url);
  return json.query?.pages?.[0]?.extract ?? "";
}

/** Resolve a Wikipedia article title to its Wikidata QID. */
export async function resolveQid(title: string): Promise<{ qid: string; canonicalTitle: string } | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1" +
    "&prop=pageprops&ppprop=wikibase_item&titles=" +
    encodeURIComponent(title);
  const json = await cachedJson<{
    query?: { pages?: { title: string; pageprops?: { wikibase_item?: string } }[] };
  }>(url);
  const page = json.query?.pages?.[0];
  const qid = page?.pageprops?.wikibase_item;
  return qid ? { qid, canonicalTitle: page!.title } : null;
}

// — Wikidata —

export async function wikidataEntity(qid: string): Promise<Record<string, unknown>> {
  // We only consume claims (language-neutral); requesting just those keeps the
  // response ~50x smaller than the full entity dump with all-language labels.
  const url =
    "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json" +
    `&props=claims&languages=en&ids=${qid}`;
  const json = await cachedJson<{ entities: Record<string, Record<string, unknown>> }>(url);
  return json.entities[qid];
}

export async function sparql<T = Record<string, { value: string }>>(query: string): Promise<T[]> {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  const json = await cachedJson<{ results: { bindings: T[] } }>(url);
  return json.results.bindings;
}

// — Wikimedia Commons —

export interface CommonsImageInfo {
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  url?: string;
  descriptionurl?: string;
  width?: number;
  height?: number;
  extmetadata?: Record<string, { value: string }>;
}

/** imageinfo (incl. license metadata + a server-side resized URL) for a Commons file. */
export async function commonsImageInfo(fileName: string, thumbWidth = 3200): Promise<CommonsImageInfo | null> {
  const title = fileName.startsWith("File:") ? fileName : "File:" + fileName;
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2" +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=${thumbWidth}&titles=` +
    encodeURIComponent(title);
  const json = await cachedJson<{
    query?: { pages?: { imageinfo?: CommonsImageInfo[] }[] };
  }>(url);
  return json.query?.pages?.[0]?.imageinfo?.[0] ?? null;
}

// Media downloads (upload.wikimedia.org) are throttled separately and harder
// than the JSON APIs — rendering custom thumbnail sizes is expensive for
// Commons, and bursts get 429'd aggressively. Keep a slow dedicated pace,
// honor Retry-After, and back off for a long time rather than give up.
let mediaIntervalMs = 1200;
let lastMediaRequest = 0;

/** Download a (binary) URL to a file, with cache + retry. Returns the local path. */
export async function downloadFile(url: string, destPath: string): Promise<string> {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    return destPath;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  for (let attempt = 1; attempt <= 7; attempt++) {
    const wait = lastMediaRequest + mediaIntervalMs - Date.now();
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastMediaRequest = Date.now();
    let retryAfterMs = 0;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 429 || res.status >= 500) {
        retryAfterMs = (parseInt(res.headers.get("retry-after") ?? "0", 10) || 0) * 1000;
        if (res.status === 429) {
          mediaIntervalMs = Math.min(mediaIntervalMs * 2, 10000);
        }
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: true });
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(destPath, buf);
      return destPath;
    } catch (err) {
      const e = err as Error & { fatal?: boolean };
      if (e.fatal || attempt === 7) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, Math.max(retryAfterMs, attempt * 5000)));
    }
  }
  throw new Error("unreachable");
}
