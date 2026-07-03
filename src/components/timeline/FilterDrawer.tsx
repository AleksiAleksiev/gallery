"use client";

// The period/artist filter — designed as a pair of catalogue drawers in the
// masthead. Opening one slides a paper drawer down with a stagger of entries
// (GSAP); picking an entry drives the chart's camera rather than swapping a
// list, so filtering *is* travel.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { TimelineData } from "@/lib/timeline";

interface Props {
  data: TimelineData;
  periodLabel: string | null;
  onPickPeriod: (slug: string | null) => void;
  onPickArtist: (periodSlug: string, artistSlug: string) => void;
}

type Drawer = "period" | "artist" | null;

export default function FilterDrawer({ data, periodLabel, onPickPeriod, onPickArtist }: Props) {
  const [open, setOpen] = useState<Drawer>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // close on outside click / escape
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !open) {
      return;
    }
    const tl = gsap.timeline();
    tl.fromTo(
      panel,
      { height: 0, opacity: 0 },
      { height: "auto", opacity: 1, duration: 0.4, ease: "power3.out" },
    ).fromTo(
      panel.querySelectorAll("button"),
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.3, ease: "power2.out", stagger: 0.022 },
      "-=0.2",
    );
    return () => {
      tl.kill();
    };
  }, [open]);

  const activePeriod = data.periods.find((p) => p.name === periodLabel) ?? null;
  const artistPool = activePeriod ? [activePeriod] : data.periods;

  const tab = (drawer: Exclude<Drawer, null>, label: string, value: string | null) => (
    <button
      onClick={() => setOpen(open === drawer ? null : drawer)}
      aria-expanded={open === drawer}
      className={`engraved cursor-pointer border-b pb-1 text-[11px] tracking-[0.28em] transition-colors ${
        open === drawer ? "border-gilt text-gilt" : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      {label}
      {value && <span className="ml-2 normal-case italic tracking-normal text-gilt">{value}</span>}
      <span aria-hidden className="ml-1.5 inline-block text-[9px]">
        {open === drawer ? "▴" : "▾"}
      </span>
    </button>
  );

  return (
    <div ref={rootRef} className="relative flex items-baseline gap-7">
      {tab("period", "period", periodLabel)}
      {tab("artist", "artist", null)}

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-3 max-h-[62vh] w-72 overflow-hidden border border-rule bg-paper-deep shadow-[0_16px_40px_-14px_rgba(43,38,30,0.4)]"
        >
          <div className="placard-scroll max-h-[62vh] overflow-y-auto p-2">
            {open === "period" && (
              <>
                <button
                  onClick={() => {
                    onPickPeriod(null);
                    setOpen(null);
                  }}
                  className="engraved block w-full cursor-pointer px-4 py-2 text-left text-[10.5px] tracking-[0.26em] text-ink-faint transition-colors hover:bg-paper-shade hover:text-ink"
                >
                  — the full sweep —
                </button>
                {data.periods.map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => {
                      onPickPeriod(p.slug);
                      setOpen(null);
                    }}
                    className={`group flex w-full cursor-pointer items-baseline justify-between px-4 py-2 text-left transition-colors hover:bg-paper-shade ${
                      periodLabel === p.name ? "bg-paper-shade" : ""
                    }`}
                  >
                    <span className="engraved text-[11px] tracking-[0.24em] text-ink">
                      <span
                        aria-hidden
                        className="mr-2 inline-block h-2 w-2 border border-ink/30"
                        style={{ background: p.accent, opacity: 0.75 }}
                      />
                      {p.name}
                    </span>
                    <span className="font-display text-[12px] italic text-ink-faint">
                      {p.startYear}–{p.endYear}
                    </span>
                  </button>
                ))}
              </>
            )}
            {open === "artist" &&
              artistPool.map((p) => (
                <div key={p.slug}>
                  <p className="engraved px-4 pb-1 pt-3 text-[9px] tracking-[0.3em] text-ink-faint">{p.name}</p>
                  {p.artists.map((a) => (
                    <button
                      key={a.slug}
                      onClick={() => {
                        onPickArtist(p.slug, a.slug);
                        setOpen(null);
                      }}
                      className="flex w-full cursor-pointer items-baseline justify-between px-4 py-1.5 text-left transition-colors hover:bg-paper-shade"
                    >
                      <span className="font-display text-[15px] text-ink">{a.name}</span>
                      <span className="font-display text-[12px] italic text-ink-faint">
                        {a.birthYear ?? "?"}–{a.deathYear ?? ""}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
