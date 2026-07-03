// Pure layout math for the strata chart: lane packing, adaptive ticks,
// artist working spans. No DOM, no React — unit-testable.

import type { TimelineArtist, TimelinePeriod } from "@/lib/timeline";

export const CURRENT_YEAR = new Date().getFullYear();

/**
 * Greedy interval packing: each period goes to the first lane whose latest
 * end year doesn't overlap it. Input order (chronological) is preserved,
 * which keeps the chart reading left-to-right, top-to-bottom like a strata
 * diagram.
 */
export function packLanes(periods: TimelinePeriod[]): Map<string, number> {
  const laneEnds: number[] = [];
  const assignment = new Map<string, number>();
  for (const p of [...periods].sort((a, b) => a.startYear - b.startYear)) {
    let lane = laneEnds.findIndex((end) => end <= p.startYear);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(p.endYear);
    } else {
      laneEnds[lane] = p.endYear;
    }
    assignment.set(p.slug, lane);
  }
  return assignment;
}

/** Pick a tick step so labels sit at least ~90px apart at the current zoom. */
export function tickStep(pxPerYear: number): number {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  for (const s of steps) {
    if (s * pxPerYear >= 90) {
      return s;
    }
  }
  return 500;
}

export function ticksFor(domainStart: number, domainEnd: number, pxPerYear: number): number[] {
  const step = tickStep(pxPerYear);
  const first = Math.ceil(domainStart / step) * step;
  const out: number[] = [];
  for (let y = first; y <= domainEnd; y += step) {
    out.push(y);
  }
  return out;
}

/**
 * The span an artist's lifespan bar covers: preferred working dates, falling
 * back to adulthood → death, clamped so a missing datum never escapes the
 * period band.
 */
export function artistSpan(a: TimelineArtist, period: TimelinePeriod): [number, number] {
  const from = a.activeFrom ?? (a.birthYear !== null ? a.birthYear + 18 : period.startYear);
  const to = a.activeTo ?? a.deathYear ?? Math.min(period.endYear, CURRENT_YEAR);
  const lo = Math.max(Math.min(from, to), period.startYear - 30);
  const hi = Math.min(Math.max(from, to), Math.max(period.endYear + 30, CURRENT_YEAR));
  return [lo, hi];
}

/** "b. 1853 – d. 1890" | "b. 1945" — placard-style date line. */
export function dateLine(a: TimelineArtist): string {
  if (a.birthYear === null) {
    return "dates unknown";
  }
  return a.deathYear === null ? `b. ${a.birthYear}` : `${a.birthYear} – ${a.deathYear}`;
}
