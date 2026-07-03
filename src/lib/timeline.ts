// Shapes of data/json/timeline.json (produced by pipeline/05-export-json.ts).

export interface TimelineArtist {
  slug: string;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  activeFrom: number | null;
  activeTo: number | null;
  portrait: string | null;
  portraitAttribution: string | null;
  placard: string | null;
  bioShort: string | null;
  copyrighted: boolean;
  wikipediaUrl: string | null;
}

export interface TimelinePeriod {
  slug: string;
  name: string;
  startYear: number;
  endYear: number;
  summary: string | null;
  accent: string;
  wikipediaUrl: string | null;
  artists: TimelineArtist[];
}

export interface TimelineData {
  periods: TimelinePeriod[];
}
