"use client";

// The strata wall chart. A horizontal, cursor-anchored zoomable canvas:
// zoomed out, periods read as overlapping colored strata on an engraved
// year axis; selecting a stratum morphs it open (GSAP) into artist
// lifespan bars with portrait medallions.

import {
  forwardRef,
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import type { TimelineArtist, TimelineData, TimelinePeriod } from "@/lib/timeline";
import { PERIOD_MEDIUM, PERIOD_SHORTHAND, pigmentOf } from "@/lib/palette";
import { artistSpan, packLanes, ticksFor } from "./layout";

export interface TimelineHandle {
  focusPeriod: (slug: string) => void;
  focusArtist: (periodSlug: string, artistSlug: string) => void;
  reset: () => void;
}

interface Props {
  data: TimelineData;
  selectedArtist: string | null;
  onSelectArtist: (artist: TimelineArtist, period: TimelinePeriod) => void;
}

const DOMAIN_START = 1130;
const DOMAIN_END = 2040;
const PAD = 56; // horizontal breathing room at fit-all
const BAND_H = 46;
const LANE_GAP = 22;
const ROW_H = 30;
const EXP_PAD_TOP = 50;
const EXP_PAD_BOTTOM = 18;
const AXIS_H = 40;
const MAX_PPY = 46;

const Timeline = forwardRef<TimelineHandle, Props>(function Timeline(
  { data, selectedArtist, onSelectArtist },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Mutable view driven by GSAP tweens and gestures; React re-renders read it
  // directly after a version bump. Cheap at ~150 SVG nodes.
  const view = useRef({ ppy: 0, offset: 0, expandT: 0 }).current;
  const [, bump] = useState(0);
  const commit = useCallback(() => bump((n) => n + 1), []);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const initialized = useRef(false);

  const lanes = useMemo(() => packLanes(data.periods), [data.periods]);
  const laneCount = useMemo(() => Math.max(...lanes.values()) + 1, [lanes]);

  const ppyMin = size.w > 0 ? (size.w - 2 * PAD) / (DOMAIN_END - DOMAIN_START) : 1;

  const clampView = useCallback(() => {
    view.ppy = Math.min(Math.max(view.ppy, ppyMin), MAX_PPY);
    const total = (DOMAIN_END - DOMAIN_START) * view.ppy;
    const minOffset = size.w - PAD - total;
    view.offset = Math.min(Math.max(view.offset, minOffset), PAD);
  }, [view, ppyMin, size.w]);

  // — measurement + initial fit —
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w > 0 && !initialized.current) {
      initialized.current = true;
      view.ppy = ppyMin;
      view.offset = PAD;
      commit();
    }
  }, [size.w, ppyMin, view, commit]);

  // — gestures —
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) {
      return;
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      gsap.killTweensOf(view);
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const factor = Math.exp(-e.deltaY * 0.0016);
      const prev = view.ppy;
      view.ppy = Math.min(Math.max(prev * factor, ppyMin), MAX_PPY);
      view.offset = cx - ((cx - view.offset) * view.ppy) / prev;
      clampView();
      commit();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [view, ppyMin, clampView, commit]);

  const drag = useRef({ active: false, moved: false, startX: 0, startOffset: 0 });
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { active: true, moved: false, startX: e.clientX, startOffset: view.offset };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) {
      return;
    }
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) {
      drag.current.moved = true;
      gsap.killTweensOf(view);
      view.offset = drag.current.startOffset + dx;
      clampView();
      commit();
    }
  };
  const onPointerUp = () => {
    drag.current.active = false;
  };

  // — programmatic camera —
  const tweenTo = useCallback(
    (ppy: number, offset: number, duration = 0.9) => {
      gsap.killTweensOf(view);
      gsap.to(view, {
        ppy,
        offset,
        duration,
        ease: "power3.inOut",
        onUpdate: () => {
          clampView();
          commit();
        },
      });
    },
    [view, clampView, commit],
  );

  const expandTween = useCallback(
    (open: boolean, onDone?: () => void) => {
      gsap.to(view, {
        expandT: open ? 1 : 0,
        duration: 0.65,
        ease: "power3.inOut",
        onUpdate: commit,
        onComplete: onDone,
      });
    },
    [view, commit],
  );

  const collapse = useCallback(() => {
    expandTween(false, () => setExpanded(null));
  }, [expandTween]);

  const focusPeriod = useCallback(
    (slug: string) => {
      const p = data.periods.find((x) => x.slug === slug);
      if (!p || size.w === 0) {
        return;
      }
      // Fit the period AND its artists' working lives — painters routinely
      // outlive their movement (Monet outlived Impressionism by 30 years).
      let lo = p.startYear;
      let hi = p.endYear;
      for (const a of p.artists) {
        const [from, to] = artistSpan(a, p);
        lo = Math.min(lo, from);
        hi = Math.max(hi, to);
      }
      const span = hi - lo;
      const ppy = Math.min(Math.max((size.w * 0.78) / span, ppyMin), MAX_PPY);
      const mid = (lo + hi) / 2;
      const offset = size.w / 2 - (mid - DOMAIN_START) * ppy;
      tweenTo(ppy, offset);
      if (expanded !== slug) {
        if (expanded !== null) {
          view.expandT = 0;
        }
        setExpanded(slug);
        expandTween(true);
      }
    },
    [data.periods, size.w, ppyMin, tweenTo, expanded, view, expandTween],
  );

  useImperativeHandle(
    ref,
    () => ({
      focusPeriod,
      focusArtist: (periodSlug, artistSlug) => {
        focusPeriod(periodSlug);
        const p = data.periods.find((x) => x.slug === periodSlug);
        const a = p?.artists.find((x) => x.slug === artistSlug);
        if (p && a) {
          onSelectArtist(a, p);
        }
      },
      reset: () => {
        collapse();
        tweenTo(ppyMin, PAD);
      },
    }),
    [focusPeriod, data.periods, onSelectArtist, collapse, tweenTo, ppyMin],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expanded) {
        collapse();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, collapse]);

  // — geometry —
  const xOf = (year: number) => (year - DOMAIN_START) * view.ppy + view.offset;

  const expandedPeriod = expanded ? data.periods.find((p) => p.slug === expanded) : null;
  const expandedLane = expandedPeriod ? (lanes.get(expandedPeriod.slug) ?? 0) : 0;
  const expandedTargetH = expandedPeriod
    ? EXP_PAD_TOP + expandedPeriod.artists.length * ROW_H + EXP_PAD_BOTTOM
    : BAND_H;
  const extra = expandedPeriod ? (expandedTargetH - BAND_H) * view.expandT : 0;

  const laneY = (lane: number) =>
    AXIS_H + 14 + lane * (BAND_H + LANE_GAP) + (lane > expandedLane ? extra : 0);
  const chartBottom = AXIS_H + 14 + laneCount * (BAND_H + LANE_GAP) - LANE_GAP + extra + 14;
  const svgH = chartBottom + AXIS_H;

  const ticks = size.w > 0 ? ticksFor(DOMAIN_START, DOMAIN_END, view.ppy) : [];

  if (size.w === 0) {
    return <div ref={wrapRef} className="h-full w-full" />;
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => {
        collapse();
        tweenTo(ppyMin, PAD);
      }}
    >
      <svg
        width={size.w}
        height={svgH}
        className="block"
        style={{ marginTop: Math.max(0, (size.h - svgH) / 2 - 10) }}
        role="img"
        aria-label="Timeline of art periods"
      >
        <defs>
          {data.periods.map((p) => {
            const x = xOf(p.startYear);
            const w = (p.endYear - p.startYear) * view.ppy;
            const isExp = p.slug === expanded;
            const h = isExp ? BAND_H + extra : BAND_H;
            return (
              <Fragment key={p.slug}>
                <clipPath id={`clip-${p.slug}`}>
                  <rect x={x} y={laneY(lanes.get(p.slug) ?? 0)} width={w} height={h} rx={2} />
                </clipPath>
                {/* engraver's hatch, one screen-fixed diagonal per pigment */}
                <pattern
                  id={`hatch-${p.slug}`}
                  patternUnits="userSpaceOnUse"
                  width={5}
                  height={5}
                  patternTransform="rotate(-45)"
                >
                  <line x1={2.5} y1={0} x2={2.5} y2={5} stroke={pigmentOf(p.slug, p.accent)} strokeWidth={1.1} />
                </pattern>
              </Fragment>
            );
          })}
        </defs>

        {/* year grid */}
        <g className="tick-enter">
          {ticks.map((y) => {
            const x = xOf(y);
            return (
              <g key={y}>
                <line x1={x} y1={AXIS_H} x2={x} y2={chartBottom} stroke="var(--rule)" strokeWidth={1} opacity={0.5} />
                <text
                  x={x}
                  y={AXIS_H - 12}
                  textAnchor="middle"
                  fill="var(--ink-soft)"
                  fontSize={15}
                  fontFamily="var(--font-cormorant)"
                  fontWeight={500}
                >
                  {y}
                </text>
                <text
                  x={x}
                  y={chartBottom + 24}
                  textAnchor="middle"
                  fill="var(--ink-faint)"
                  fontSize={13}
                  fontFamily="var(--font-cormorant)"
                >
                  {y}
                </text>
              </g>
            );
          })}
          <line x1={0} y1={AXIS_H} x2={size.w} y2={AXIS_H} stroke="var(--rule)" strokeWidth={1} />
          <line x1={0} y1={AXIS_H + 3} x2={size.w} y2={AXIS_H + 3} stroke="var(--rule)" strokeWidth={1} opacity={0.5} />
          <line x1={0} y1={chartBottom} x2={size.w} y2={chartBottom} stroke="var(--rule)" strokeWidth={1} />
          <line x1={0} y1={chartBottom - 3} x2={size.w} y2={chartBottom - 3} stroke="var(--rule)" strokeWidth={1} opacity={0.5} />
        </g>

        {/* strata */}
        {data.periods.map((p, i) => {
          const lane = lanes.get(p.slug) ?? 0;
          const x = xOf(p.startYear);
          const w = (p.endYear - p.startYear) * view.ppy;
          const isExp = p.slug === expanded;
          const isHover = p.slug === hovered;
          const h = isExp ? BAND_H + extra : BAND_H;
          const y = laneY(lane);
          const dimmed = expanded !== null && !isExp;
          const pigment = pigmentOf(p.slug, p.accent);
          const medium = PERIOD_MEDIUM[p.slug];
          const shorthand = PERIOD_SHORTHAND[p.slug] ?? p.name;
          // Lettering tiers, widest to narrowest: full engraved caps →
          // tightened caps → a single-word stand-in → catalogue shorthand →
          // shorthand run vertically → pigment chip only (hover still names
          // the stratum). Character budgets approximate Cormorant caps at
          // each size + tracking.
          let tier: "full" | "tight" | "short" | "vertical" | "none";
          let label = p.name;
          if (isExp || w > p.name.length * 11 + 24) {
            tier = "full";
          } else if (w > p.name.length * 8.3 + 16) {
            tier = "tight";
          } else if (medium && w > medium.length * 8.3 + 16) {
            tier = "tight";
            label = medium;
          } else if (w > shorthand.length * 6.9 + 12) {
            tier = "short";
            label = shorthand;
          } else if (shorthand.length * 6.1 <= BAND_H - 8 && w >= 17) {
            tier = "vertical";
            label = shorthand;
          } else {
            tier = "none";
          }
          // In-band year captions need the label to leave room for two
          // 4-digit italics (~30px each) plus edge padding, or they letter
          // straight underneath the label's first and last characters.
          const labelEst = tier === "tight" ? label.length * 8.3 : p.name.length * 11;
          const yearsFit = isExp || w > labelEst + 96;
          // Open strata morph fill/hatch/stroke along the expand tween so
          // neither end of the animation snaps.
          const t = isExp ? view.expandT : 0;

          return (
            <g
              key={p.slug}
              className="stratum-enter"
              style={{ animationDelay: `${i * 45}ms`, cursor: "pointer" }}
              opacity={dimmed ? 0.35 + 0.65 * (1 - view.expandT) : 1}
              onMouseEnter={() => setHovered(p.slug)}
              onMouseLeave={() => setHovered(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (drag.current.moved) {
                  return;
                }
                if (isExp) {
                  collapse();
                } else {
                  focusPeriod(p.slug);
                }
              }}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={2}
                fill={pigment}
                fillOpacity={(isHover ? 0.4 : 0.3) * (1 - t) + 0.1 * t}
              />
              {/* the hatch fades away as the stratum opens into artist rows */}
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={`url(#hatch-${p.slug})`}
                opacity={(isHover ? 0.3 : 0.22) * (1 - t)}
                clipPath={`url(#clip-${p.slug})`}
              />
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={2}
                fill="none"
                stroke="var(--ink)"
                strokeOpacity={isHover ? 0.6 : 0.38 + 0.22 * t}
                strokeWidth={1}
              />
              {/* pigment chip — the catalogue swatch at the stratum's left edge */}
              <rect x={x} y={y} width={5} height={h} fill={pigment} opacity={0.95} clipPath={`url(#clip-${p.slug})`} />

              {(tier === "full" || tier === "tight") && (
                <text
                  x={x + w / 2}
                  y={isExp ? y + 30 : y + h / 2 + (tier === "full" ? 6 : 4.5)}
                  textAnchor="middle"
                  className="engraved"
                  fill="var(--ink)"
                  fontSize={isExp ? 17 : tier === "full" ? 14.5 : 12.5}
                  stroke="var(--paper)"
                  strokeOpacity={0.5}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  // tracking must ride the style prop: .engraved's CSS
                  // letter-spacing beats SVG presentation attributes
                  style={{ paintOrder: "stroke", letterSpacing: tier === "full" ? "0.22em" : "0.08em" }}
                  clipPath={`url(#clip-${p.slug})`}
                >
                  {isExp ? p.name : label}
                </text>
              )}
              {tier === "short" && (
                <text
                  x={x + w / 2}
                  y={y + h / 2 + 4}
                  textAnchor="middle"
                  className="engraved"
                  fill="var(--ink)"
                  fontSize={10.5}
                  stroke="var(--paper)"
                  strokeOpacity={0.5}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  style={{ paintOrder: "stroke", letterSpacing: "0.08em" }}
                  clipPath={`url(#clip-${p.slug})`}
                >
                  {label}
                </text>
              )}
              {tier === "vertical" && (
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  transform={`rotate(-90 ${x + w / 2} ${y + h / 2})`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="engraved"
                  fill="var(--ink)"
                  fontSize={9.5}
                  stroke="var(--paper)"
                  strokeOpacity={0.5}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  style={{ paintOrder: "stroke", letterSpacing: "0.06em" }}
                  clipPath={`url(#clip-${p.slug})`}
                >
                  {label}
                </text>
              )}
              {isHover && !isExp && (tier === "none" || label !== p.name || !yearsFit) && (
                // the curator's pencil note: full name + span floated above
                // the band, haloed in paper so it reads over the year grid.
                // Shown whenever the band itself can't letter both the full
                // name and its years.
                <text
                  x={x + w / 2}
                  y={y - 9}
                  textAnchor="middle"
                  className="engraved"
                  fill="var(--ink)"
                  fontSize={12.5}
                  stroke="var(--paper)"
                  strokeOpacity={0.9}
                  strokeWidth={4}
                  strokeLinejoin="round"
                  style={{ paintOrder: "stroke", letterSpacing: "0.14em" }}
                >
                  {p.name} · {p.startYear}–{p.endYear}
                </text>
              )}
              {(isHover || isExp) && yearsFit && (tier === "full" || tier === "tight") && (
                <>
                  <text
                    x={x + 12}
                    y={y + (isExp ? 30 : h / 2 + 5)}
                    fill="var(--ink-soft)"
                    fontSize={12.5}
                    fontFamily="var(--font-cormorant)"
                    fontStyle="italic"
                    clipPath={`url(#clip-${p.slug})`}
                  >
                    {p.startYear}
                  </text>
                  <text
                    x={x + w - 12}
                    y={y + (isExp ? 30 : h / 2 + 5)}
                    textAnchor="end"
                    fill="var(--ink-soft)"
                    fontSize={12.5}
                    fontFamily="var(--font-cormorant)"
                    fontStyle="italic"
                    clipPath={`url(#clip-${p.slug})`}
                  >
                    {p.endYear}
                  </text>
                </>
              )}

              {/* artist rows, revealed as the stratum opens */}
              {isExp && view.expandT > 0.01 && (
                <g opacity={Math.max(0, (view.expandT - 0.35) / 0.65)}>
                  {p.artists.map((a, j) => {
                    const [from, to] = artistSpan(a, p);
                    const ax1 = xOf(from);
                    const ax2 = Math.max(xOf(to), ax1 + 8);
                    const ay = y + EXP_PAD_TOP + j * ROW_H + ROW_H / 2;
                    const isSel = a.slug === selectedArtist;
                    return (
                      <g
                        key={a.slug}
                        style={{ cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!drag.current.moved) {
                            onSelectArtist(a, p);
                          }
                        }}
                      >
                        {/* generous invisible hit area */}
                        <rect x={ax1 - 30} y={ay - ROW_H / 2} width={ax2 - ax1 + 250} height={ROW_H} fill="transparent" />
                        <line
                          x1={ax1}
                          y1={ay}
                          x2={ax2}
                          y2={ay}
                          stroke={isSel ? "var(--gilt)" : "var(--ink)"}
                          strokeOpacity={isSel ? 0.95 : 0.6}
                          strokeWidth={isSel ? 3 : 2}
                        />
                        <line x1={ax2} y1={ay - 4} x2={ax2} y2={ay + 4} stroke="var(--ink)" strokeOpacity={0.6} strokeWidth={1.5} />
                        {/* portrait medallion at the working-life's start */}
                        <clipPath id={`med-${a.slug}`}>
                          <circle cx={ax1} cy={ay} r={10.5} />
                        </clipPath>
                        <circle
                          cx={ax1}
                          cy={ay}
                          r={11.5}
                          fill="var(--paper)"
                          stroke={isSel ? "var(--gilt)" : "var(--ink)"}
                          strokeOpacity={isSel ? 0.9 : 0.45}
                          strokeWidth={1.25}
                        />
                        {a.portrait ? (
                          <image
                            href={a.portrait}
                            x={ax1 - 10.5}
                            y={ay - 10.5}
                            width={21}
                            height={21}
                            preserveAspectRatio="xMidYMid slice"
                            clipPath={`url(#med-${a.slug})`}
                            style={{ filter: "sepia(0.25) contrast(1.02) saturate(0.85)" }}
                          />
                        ) : (
                          <text
                            x={ax1}
                            y={ay + 4}
                            textAnchor="middle"
                            fill="var(--ink-soft)"
                            fontSize={12}
                            fontFamily="var(--font-cormorant)"
                            fontStyle="italic"
                          >
                            {a.name.charAt(0)}
                          </text>
                        )}
                        {/* name floats above the bar at its start, wall-chart
                            style — pinned into view when the start scrolls
                            off-screen so long lives stay labelled */}
                        <text
                          x={Math.min(Math.max(ax1 + 17, 14), Math.max(ax2 - 30, ax1 + 17))}
                          y={ay - 6}
                          fill={isSel ? "var(--gilt-deep)" : "var(--ink)"}
                          fontSize={14.5}
                          fontFamily="var(--font-cormorant)"
                          fontWeight={isSel ? 700 : 500}
                        >
                          {a.name}
                        </text>
                        <text
                          x={ax1 - 18}
                          y={ay + 4}
                          textAnchor="end"
                          fill="var(--ink-faint)"
                          fontSize={11.5}
                          fontFamily="var(--font-cormorant)"
                          fontStyle="italic"
                        >
                          {from}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <p className="engraved pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em] text-ink-faint">
        scroll to magnify · drag to travel · select a stratum
      </p>
    </div>
  );
});

export default Timeline;
