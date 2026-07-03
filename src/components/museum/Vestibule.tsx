"use client";

// The threshold: a dark title wall shown while the gallery loads. The artist's
// name is lettered like an entrance lintel; a gilt hairline fills as textures
// arrive; one click steps inside and locks the pointer.

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import type { MuseumArtist } from "@/lib/museum";

interface Props {
  artist: MuseumArtist;
  periodName: string;
  ready: boolean;
  progress: number; // 0..100
  leaving: boolean; // fade out over the gallery once the visitor steps in
  onEnter: () => void;
}

export default function Vestibule({ artist, periodName, ready, progress, leaving, onEnter }: Props) {
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

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#16120c] text-center ${
        leaving ? "pointer-events-none" : ""
      }`}
    >
      {/* faint radial lamplight behind the lettering */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_42%,rgba(150,116,47,0.14),transparent_70%)]" />

      <p data-reveal className="engraved mb-6 text-[11px] tracking-[0.42em] text-[#8a7a5c]">
        {periodName}
      </p>

      <h1
        data-reveal
        className="engraved max-w-[16em] px-6 text-[clamp(28px,5.2vw,64px)] leading-tight tracking-[0.22em] text-[#e8dfca]"
        style={{ textShadow: "0 0 34px rgba(150,116,47,0.28)" }}
      >
        {artist.name}
      </h1>

      {dates && (
        <p data-reveal className="mt-4 font-display text-[clamp(15px,1.6vw,20px)] italic text-[#9c8d70]">
          {dates}
        </p>
      )}

      <div data-reveal className="mt-8 h-px w-40 bg-[#3d3524]" />

      {/* progress hairline / the step-inside threshold */}
      <div data-reveal className="mt-10 flex h-16 flex-col items-center justify-start">
        {ready ? (
          <button
            onClick={onEnter}
            className="engraved group cursor-pointer border border-[#3d3524] bg-transparent px-10 py-3.5 text-[12px] tracking-[0.34em] text-[#cdbf9f] transition-colors duration-300 hover:border-gilt hover:text-gilt"
          >
            step inside
            <span aria-hidden className="ml-3 inline-block transition-transform duration-300 group-hover:translate-x-1.5">
              ⟶
            </span>
          </button>
        ) : (
          <div className="flex flex-col items-center">
            <div className="h-px w-56 overflow-hidden bg-[#33291a]">
              <div
                className="h-full bg-gilt transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
            <p className="engraved mt-4 text-[10px] tracking-[0.34em] text-[#6e6046]">
              hanging the collection
            </p>
          </div>
        )}
      </div>

      <p data-reveal className="engraved mt-2 text-[10px] tracking-[0.3em] text-[#57492f]">
        {artist.paintings.length} works · walk with WASD · look with the mouse
      </p>

      <Link
        href="/"
        className="engraved absolute bottom-8 text-[10px] tracking-[0.3em] text-[#6e6046] underline decoration-[#3d3524] underline-offset-4 transition-colors hover:text-gilt"
      >
        ⟵ return to the atlas
      </Link>
    </div>
  );
}
