"use client";

// The threshold: a dark title wall shown while the gallery loads. The artist's
// name is lettered like an entrance lintel; a gilt hairline fills as textures
// arrive; one click steps inside and locks the pointer. The atlas plate's
// double frame and the period's pigment chip carry over so both worlds read
// as one publication.

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import type { MuseumArtist } from "@/lib/museum";

interface Props {
  artist: MuseumArtist;
  periodName: string;
  pigment: string; // the period's display pigment (see lib/palette)
  ready: boolean;
  progress: number; // 0..100
  leaving: boolean; // fade out over the gallery once the visitor steps in
  onEnter: () => void;
}

export default function Vestibule({ artist, periodName, pigment, ready, progress, leaving, onEnter }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    if (leaving) {
      gsap.to(el, { opacity: 0, duration: 1.0, ease: "power2.inOut" });
      return;
    }
    const tl = gsap.timeline();
    tl.fromTo(
      el.querySelectorAll("[data-reveal]"),
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", stagger: 0.12, delay: 0.15 },
    );
    return () => {
      tl.kill();
    };
  }, [leaving]);

  const dates = [artist.birthYear, artist.deathYear].filter(Boolean).join(" – ");
  // Mid-tone pigments sink into the dark wall; lift the chip toward parchment.
  const litPigment = `color-mix(in srgb, ${pigment} 72%, var(--night-ink))`;

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-night text-center ${
        leaving ? "pointer-events-none" : ""
      }`}
    >
      {/* faint radial lamplight behind the lettering */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_42%,rgba(210,171,97,0.12),transparent_70%)]" />

      {/* the plate frame, same idiom as the atlas */}
      <div className="pointer-events-none absolute inset-4 border border-night-line sm:inset-6" />
      <div className="pointer-events-none absolute inset-[22px] border border-night-line opacity-50 sm:inset-[30px]" />

      <p data-reveal className="engraved mb-6 text-[11px] tracking-[0.42em] text-night-soft">
        {periodName}
      </p>

      <h1
        data-reveal
        className="engraved max-w-[16em] px-6 text-[clamp(28px,5.2vw,64px)] leading-tight tracking-[0.22em] text-night-ink"
        style={{ textShadow: "0 0 34px rgba(210,171,97,0.22)" }}
      >
        {artist.name}
      </h1>

      {dates && (
        <p data-reveal className="mt-4 font-display text-[clamp(15px,1.6vw,20px)] italic text-night-soft">
          {dates}
        </p>
      )}

      {/* the stratum's pigment chip, laid on the lintel */}
      <div data-reveal className="mt-8 flex items-center gap-3">
        <div className="h-px w-14 bg-night-line" />
        <div className="h-[5px] w-10" style={{ background: litPigment }} />
        <div className="h-px w-14 bg-night-line" />
      </div>

      {/* progress hairline / the step-inside threshold */}
      <div data-reveal className="mt-10 flex h-16 flex-col items-center justify-start">
        {ready ? (
          <button
            onClick={onEnter}
            className="engraved group cursor-pointer border border-night-line-strong bg-gilt/[0.05] px-12 py-4 text-[12.5px] tracking-[0.34em] text-gilt-bright transition-all duration-300 hover:border-gilt-bright/70 hover:bg-gilt/15"
          >
            step inside
            <span aria-hidden className="ml-3 inline-block transition-transform duration-300 group-hover:translate-x-1.5">
              ⟶
            </span>
          </button>
        ) : (
          <div className="flex flex-col items-center">
            <div className="h-[2px] w-56 overflow-hidden bg-night-line/60">
              <div
                className="h-full bg-gilt-bright transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
            <p className="engraved mt-4 text-[10px] tracking-[0.34em] text-night-faint">
              hanging the collection
            </p>
          </div>
        )}
      </div>

      <p data-reveal className="engraved mt-2 text-[10px] tracking-[0.3em] text-night-faint">
        {artist.paintings.length} works · walk with WASD · look with the mouse
      </p>

      <Link
        href="/"
        className="engraved absolute bottom-10 text-[10px] tracking-[0.3em] text-night-faint underline decoration-night-line underline-offset-4 transition-colors hover:text-gilt-bright sm:bottom-12"
      >
        ⟵ return to the atlas
      </Link>
    </div>
  );
}
