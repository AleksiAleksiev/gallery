import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MuseumApp from "@/components/museum/MuseumApp";
import type { MuseumArtist } from "@/lib/museum";
import type { TimelineData } from "@/lib/timeline";

// Statically exported: every artist page is prerendered at build time from
// the seed pipeline's JSON.

const DATA_DIR = path.join(process.cwd(), "data", "json");

async function loadArtist(slug: string): Promise<MuseumArtist | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "artists", `${slug}.json`), "utf8");
    return JSON.parse(raw) as MuseumArtist;
  } catch {
    return null;
  }
}

async function loadPeriodName(periodSlug: string): Promise<string> {
  const raw = await fs.readFile(path.join(DATA_DIR, "timeline.json"), "utf8");
  const timeline = JSON.parse(raw) as TimelineData;
  return timeline.periods.find((p) => p.slug === periodSlug)?.name ?? "";
}

export async function generateStaticParams() {
  const files = await fs.readdir(path.join(DATA_DIR, "artists"));
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ artist: f.replace(/\.json$/, "") }));
}

export async function generateMetadata({
  params,
}: PageProps<"/museum/[artist]">): Promise<Metadata> {
  const { artist: slug } = await params;
  const artist = await loadArtist(slug);
  if (!artist) {
    return {};
  }
  return {
    title: `${artist.name} — Gallery`,
    description: `Walk a museum of ${artist.paintings.length} paintings by ${artist.name}. Every image and fact from Wikipedia and Wikimedia Commons.`,
  };
}

export default async function MuseumPage({ params }: PageProps<"/museum/[artist]">) {
  const { artist: slug } = await params;
  const artist = await loadArtist(slug);
  if (!artist) {
    notFound();
  }
  const periodName = await loadPeriodName(artist.periodSlug);
  return <MuseumApp artist={artist} periodName={periodName} />;
}
