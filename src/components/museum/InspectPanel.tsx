"use client";

// Wall label for the painting being inspected — same engraved-placard idiom as
// the timeline's artist card, docked beside the framed view.

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import type { Placement } from "./layout";

interface Props {
  placement: Placement;
  onClose: () => void;
}

function dims(widthCm: number | null, heightCm: number | null): string | null {
  if (!widthCm || !heightCm) {
    return null;
  }
  return `${heightCm.toLocaleString()} × ${widthCm.toLocaleString()} cm`;
}

export default function InspectPanel({ placement, onClose }: Props) {
  const { painting } = placement;
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const tl = gsap.timeline({ delay: 0.45 });
    tl.fromTo(
      el,
      { x: 56, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
    ).fromTo(
      el.querySelectorAll("[data-reveal]"),
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: "power2.out", stagger: 0.05 },
      "-=0.35",
    );
    return () => {
      tl.kill();
    };
  }, [painting.slug]);

  const size = dims(painting.widthCm, painting.heightCm);

  return (
    <aside
      ref={rootRef}
      data-inspect-panel
      aria-label={`About ${painting.title}`}
      className="absolute right-6 top-6 bottom-6 z-40 flex w-[390px] max-w-[calc(100vw-3rem)] flex-col border border-night-line-strong bg-night-raise/[0.97] shadow-[0_18px_60px_-12px_rgba(0,0,0,0.8)] backdrop-blur-sm"
    >
      <div className="pointer-events-none absolute inset-1.5 border border-night-line-strong opacity-60" />

      <button
        onClick={onClose}
        aria-label="Close"
        className="engraved absolute right-4 top-3 z-10 cursor-pointer text-[13px] text-night-soft transition-colors hover:text-gilt-bright"
      >
        ✕
      </button>

      <div className="placard-scroll relative flex-1 overflow-y-auto px-8 pb-6 pt-10">
        <h2
          data-reveal
          className="engraved text-center text-[19px] leading-snug tracking-[0.14em] text-night-ink"
        >
          {painting.title}
        </h2>
        <p data-reveal className="mt-1.5 text-center font-display text-[15px] italic text-night-soft">
          {painting.yearDisplay ?? "date unknown"}
          {size ? ` · ${size}` : ""}
        </p>

        <div data-reveal className="mx-auto mt-4 w-24 border-t border-night-line-strong" />

        {painting.imageStatus === "placeholder" && (
          <p data-reveal className="mt-4 text-center font-display text-[13.5px] italic leading-relaxed text-night-soft">
            This work is still under copyright, so no freely licensed image exists — its
            story hangs here in its place.
          </p>
        )}

        {painting.story && (
          <p
            data-reveal
            className="mt-5 text-[15px] leading-relaxed text-night-ink/90 first-letter:float-left first-letter:mr-1.5 first-letter:font-display first-letter:text-[32px] first-letter:leading-[0.9] first-letter:text-night-ink"
          >
            {painting.story}
          </p>
        )}

        {painting.funFacts.length > 0 && (
          <div data-reveal className="mt-6">
            <h3 className="engraved text-center text-[10px] tracking-[0.34em] text-night-faint">
              notes
            </h3>
            <ul className="mt-3 space-y-3">
              {painting.funFacts.map((fact, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-night-soft">
                  <span aria-hidden className="mt-[1px] shrink-0 text-gilt-bright">
                    ❧
                  </span>
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div data-reveal className="mt-7 border-t border-night-line pt-4 text-center">
          {(painting.license || painting.attribution) && (
            <p className="font-display text-[12.5px] italic text-night-faint">
              {[painting.attribution, painting.license].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="mt-2 space-x-4">
            {painting.wikipediaUrl && (
              <a
                href={painting.wikipediaUrl}
                target="_blank"
                rel="noreferrer"
                className="engraved text-[9.5px] tracking-[0.26em] text-night-faint underline decoration-night-line underline-offset-4 transition-colors hover:text-gilt-bright"
              >
                wikipedia ↗
              </a>
            )}
            {painting.commonsUrl && (
              <a
                href={painting.commonsUrl}
                target="_blank"
                rel="noreferrer"
                className="engraved text-[9.5px] tracking-[0.26em] text-night-faint underline decoration-night-line underline-offset-4 transition-colors hover:text-gilt-bright"
              >
                commons ↗
              </a>
            )}
          </p>
        </div>
      </div>

      {painting.imageStatus !== "placeholder" && (
        <div className="relative border-t border-night-line px-8 py-3">
          <p className="engraved text-center text-[9.5px] tracking-[0.3em] text-night-faint">
            scroll to lean in · drag to pan · esc to step back
          </p>
        </div>
      )}
    </aside>
  );
}
