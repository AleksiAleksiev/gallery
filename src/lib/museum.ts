// Shapes of data/json/artists/[slug].json (produced by pipeline/05-export-json.ts).

export interface MuseumPainting {
  slug: string;
  title: string;
  year: number | null;
  yearDisplay: string | null;
  imageStatus: "free" | "placeholder" | "override";
  thumb: string | null;
  gallery: string | null;
  inspect: string | null;
  imgWidth: number | null;
  imgHeight: number | null;
  widthCm: number | null;
  heightCm: number | null;
  story: string | null;
  funFacts: string[];
  license: string | null;
  attribution: string | null;
  commonsUrl: string | null;
  wikipediaUrl: string | null;
}

export interface MuseumArtist {
  slug: string;
  name: string;
  periodSlug: string;
  birthYear: number | null;
  deathYear: number | null;
  activeFrom: number | null;
  activeTo: number | null;
  portrait: string | null;
  portraitAttribution: string | null;
  placard: string | null;
  bioShort: string | null;
  bioLong: string | null;
  copyrighted: boolean;
  wikipediaUrl: string | null;
  paintings: MuseumPainting[];
}
