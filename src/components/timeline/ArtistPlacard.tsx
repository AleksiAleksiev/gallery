"use client";

// Museum wall-label card for one artist. Styled after an engraved gallery
// placard: deep paper, double hairline frame, letterspaced caps, italic
// epithet, and a portrait treated like a plate reproduction.

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import type { TimelineArtist, TimelinePeriod } from "@/lib/timeline";
import { dateLine } from "./layout";

interface Props {
  artist: TimelineArtist;
  period: TimelinePeriod;
  onClose: () => void;
}

export default function ArtistPlacard({ artist, period, onClose }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const router = useRouter();
  // Entering the museum: dim the atlas down to the vestibule's dark before
  // navigating, so the light plate never hard-cuts to the dark room.
  const [entering, setEntering] = useState(false);
  const enter = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
      return; // let new-tab clicks behave like normal links
    }
    e.preventDefault();
    if (entering) {
      return;
    }
    setEntering(true);
    setTimeout(() => router.push(`/museum/${artist.slug}`), 600);
  };

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const tl = gsap.timeline();
    tl.fromTo(
      el,
      { x: 48, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.55, ease: "power3.out" },
    ).fromTo(
      el.querySelectorAll("[data-reveal]"),
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: "power2.out", stagger: 0.06 },
      "-=0.3",
    );
    return () => {
      tl.kill();
    };
  }, [artist.slug]);

  return (
    <aside
      ref={rootRef}
      aria-label={`About ${artist.name}`}
      className="absolute right-6 top-6 bottom-6 z-40 flex w-[370px] max-w-[calc(100vw-3rem)] flex-col border border-rule bg-paper-deep shadow-[0_18px_50px_-18px_rgba(43,38,30,0.45)]"
    >
      {/* inner hairline — the double-matted frame */}
      <div className="pointer-events-none absolute inset-1.5 border border-rule opacity-60" />

      <button
        onClick={onClose}
        aria-label="Close"
        className="engraved absolute right-4 top-3 z-10 cursor-pointer text-[13px] text-ink-soft transition-colors hover:text-gilt"
      >
        ✕
      </button>

      <div className="placard-scroll relative flex-1 overflow-y-auto px-8 pb-6 pt-9">
        {/* portrait plate */}
        <div data-reveal className="mx-auto mb-6 w-44">
          <div className="border border-rule bg-paper p-1.5 shadow-[0_2px_10px_rgba(43,38,30,0.18)]">
            {artist.portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artist.portrait}
                alt={`Portrait of ${artist.name}`}
                className="block aspect-[3/4] w-full object-cover [filter:sepia(0.22)_contrast(1.02)_saturate(0.9)]"
                draggable={false}
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center bg-paper-shade">
                <span className="font-display text-6xl font-medium italic text-ink-faint">
                  {artist.name.charAt(0)}
                </span>
              </div>
            )}
          </div>
          <p className="engraved mt-2 text-center text-[9px] leading-relaxed tracking-[0.3em] text-ink-faint">
            {/* CC-licensed portrait photos require the photographer's name */}
            {!artist.portrait
              ? "no portrait survives the commons"
              : artist.portraitAttribution && !/unknown|anonymous|unattributed/i.test(artist.portraitAttribution)
                ? `portrait · ${artist.portraitAttribution} · commons`
                : "from the commons"}
          </p>
        </div>

        {/* the wall label */}
        <h2
          data-reveal
          className="engraved engraved-relief text-center text-[21px] leading-snug tracking-[0.18em] text-ink"
        >
          {artist.name}
        </h2>
        <p data-reveal className="mt-1.5 text-center font-display text-[15px] italic text-ink-soft">
          {dateLine(artist)} · {period.name}
        </p>

        <div data-reveal className="double-rule mx-auto mt-4 w-24" />

        {artist.placard && (
          <p data-reveal className="mt-4 text-center font-display text-[17px] italic leading-relaxed text-ink">
            {artist.placard}
          </p>
        )}

        {artist.bioShort && (
          <p data-reveal className="mt-4 text-[15.5px] leading-relaxed text-ink-soft first-letter:float-left first-letter:mr-1.5 first-letter:font-display first-letter:text-[34px] first-letter:leading-[0.9] first-letter:text-ink">
            {artist.bioShort}
          </p>
        )}

        {artist.wikipediaUrl && (
          <p data-reveal className="mt-4 text-center">
            <a
              href={artist.wikipediaUrl}
              target="_blank"
              rel="noreferrer"
              className="engraved text-[10px] tracking-[0.28em] text-ink-faint underline decoration-rule underline-offset-4 transition-colors hover:text-gilt"
            >
              source · wikipedia ↗
            </a>
          </p>
        )}
      </div>

      {/* threshold to the museum */}
      <div data-reveal className="relative border-t border-rule px-8 py-4">
        <Link
          href={`/museum/${artist.slug}`}
          onClick={enter}
          className="engraved group flex items-center justify-between text-[12px] tracking-[0.3em] text-ink transition-colors hover:text-gilt"
        >
          <span>enter the museum</span>
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1.5">
            ⟶
          </span>
        </Link>
      </div>

      {/* the lights dim on the way in */}
      <div
        className={`pointer-events-none fixed inset-0 z-[90] bg-[#16120c] transition-opacity duration-[600ms] ease-in ${
          entering ? "opacity-100" : "opacity-0"
        }`}
      />
    </aside>
  );
}
