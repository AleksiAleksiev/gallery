"use client";

// Composes the atlas plate: masthead, filter drawers, the strata chart, and
// the artist placard. Owns selection state; the chart exposes an imperative
// camera (focusPeriod/reset) that the filters drive.

import { useLayoutEffect, useRef, useState } from "react";
import type { TimelineArtist, TimelineData, TimelinePeriod } from "@/lib/timeline";
import Timeline, { type TimelineHandle } from "./Timeline";
import ArtistPlacard from "./ArtistPlacard";
import FilterDrawer from "./FilterDrawer";
import { ARRIVE_DARK_KEY } from "@/lib/transitions";

interface Props {
  data: TimelineData;
}

export default function TimelineApp({ data }: Props) {
  const chartRef = useRef<TimelineHandle>(null);
  const [selection, setSelection] = useState<{ artist: TimelineArtist; period: TimelinePeriod } | null>(null);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);

  // Pre-paint (layout effect): if we came from a museum, snap the overlay
  // dark before the first frame, then let the CSS transition fade it away.
  // Imperative style keeps server and client markup identical.
  const arriveOverlay = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = arriveOverlay.current;
    if (!el || !sessionStorage.getItem(ARRIVE_DARK_KEY)) {
      return;
    }
    sessionStorage.removeItem(ARRIVE_DARK_KEY);
    el.style.opacity = "1";
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.opacity = "0";
      }),
    );
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <main className="relative flex h-full flex-col p-4 sm:p-6">
      <div
        ref={arriveOverlay}
        className="pointer-events-none fixed inset-0 z-[90] bg-night opacity-0 transition-opacity duration-700 ease-out"
      />
      {/* the plate frame */}
      <div className="relative flex min-h-0 flex-1 flex-col border border-rule">
        <div className="pointer-events-none absolute inset-1.5 border border-rule opacity-50" />

        {/* masthead */}
        <header className="relative z-50 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 px-8 pb-4 pt-6">
          <div className="flex items-baseline gap-5">
            <h1 className="engraved engraved-relief text-[26px] tracking-[0.32em] text-ink">Gallery</h1>
            <p className="hidden font-display text-[14px] italic text-ink-soft md:block">
              An atlas of painting, 1150 — present · drawn from Wikipedia
            </p>
          </div>
          <FilterDrawer
            data={data}
            periodLabel={periodLabel}
            onPickPeriod={(slug) => {
              setSelection(null);
              if (slug === null) {
                setPeriodLabel(null);
                chartRef.current?.reset();
              } else {
                const p = data.periods.find((x) => x.slug === slug);
                setPeriodLabel(p?.name ?? null);
                chartRef.current?.focusPeriod(slug);
              }
            }}
            onPickArtist={(periodSlug, artistSlug) => {
              const p = data.periods.find((x) => x.slug === periodSlug);
              setPeriodLabel(p?.name ?? null);
              chartRef.current?.focusArtist(periodSlug, artistSlug);
            }}
          />
        </header>

        <div className="double-rule relative z-0 mx-8" />

        {/* the chart */}
        <div className="relative min-h-0 flex-1 px-2 pt-2">
          <Timeline
            ref={chartRef}
            data={data}
            selectedArtist={selection?.artist.slug ?? null}
            onSelectArtist={(artist, period) => setSelection({ artist, period })}
          />
          {selection && (
            <ArtistPlacard
              key={selection.artist.slug}
              artist={selection.artist}
              period={selection.period}
              onClose={() => setSelection(null)}
            />
          )}
        </div>

        {/* colophon */}
        <footer className="relative z-10 flex items-baseline justify-between px-8 pb-4 pt-3">
          <p className="engraved text-[9px] tracking-[0.3em] text-ink-faint">
            all works &amp; words · wikipedia and wikimedia commons
          </p>
          <p className="font-display text-[12px] italic text-ink-faint">
            {data.periods.length} periods · {data.periods.reduce((s, p) => s + p.artists.length, 0)} painters
          </p>
        </footer>
      </div>
    </main>
  );
}
