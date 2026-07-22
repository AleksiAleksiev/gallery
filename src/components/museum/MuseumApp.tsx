"use client";

// Client root for one artist's museum. Owns the visit state machine:
//   vestibule → walking ⇄ paused, walking → inspecting → paused.
// The 3D canvas mounts immediately (textures load behind the vestibule);
// DOM overlays carry the placard typography.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor, useProgress } from "@react-three/drei";
import type { MuseumArtist } from "@/lib/museum";
import { pigmentOf } from "@/lib/palette";
import { ARRIVE_DARK_KEY } from "@/lib/transitions";
import { buildLayout, type Placement } from "./layout";
import GalleryScene, { type Quality } from "./GalleryScene";
import PlayerControls, { type PlayerApi } from "./PlayerControls";
import InspectController from "./InspectController";
import Vestibule from "./Vestibule";
import InspectPanel from "./InspectPanel";

type Phase = "vestibule" | "walking" | "paused" | "inspecting" | "leaving";

interface Props {
  artist: MuseumArtist;
  periodName: string;
}

export default function MuseumApp({ artist, periodName }: Props) {
  const layout = useMemo(() => buildLayout(artist.paintings), [artist.paintings]);
  const [phase, setPhase] = useState<Phase>("vestibule");
  const [vestibule, setVestibule] = useState<"shown" | "leaving" | "gone">("shown");
  const [inspect, setInspect] = useState<Placement | null>(null);
  const [target, setTarget] = useState<Placement | null>(null);
  const [dwelled, setDwelled] = useState(false);
  // Realism costs (floor reflections, full dpr) drop once if the frame rate
  // can't hold — a one-way ratchet so the quality doesn't visibly oscillate.
  const [quality, setQuality] = useState<Quality>("high");
  // Walking through the atlas doorway: fade the room out, then leave.
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();
  const player = useRef<PlayerApi>(null);
  // Updated eagerly (not on render): unlock() fires onLockChange synchronously,
  // before React re-renders, and the handler must see the phase just set.
  const phaseRef = useRef(phase);
  const changePhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const { active, progress } = useProgress();
  const ready = dwelled && !active;

  // Give the lintel a beat even when everything is cached.
  useEffect(() => {
    const t = setTimeout(() => setDwelled(true), 900);
    return () => clearTimeout(t);
  }, []);

  const enter = useCallback(() => {
    player.current?.lock();
  }, []);

  const onLockChange = useCallback(
    (locked: boolean) => {
      if (locked) {
        changePhase("walking");
        setInspect(null);
        // Let the title wall fade over the gallery instead of vanishing.
        setVestibule((v) => (v === "shown" ? "leaving" : v));
        setTimeout(() => setVestibule("gone"), 1200);
      } else if (phaseRef.current === "walking") {
        // Esc mid-walk: pause. (Inspect-triggered unlocks set their own phase.)
        changePhase("paused");
      }
    },
    [changePhase],
  );

  const onInspect = useCallback(
    (pl: Placement) => {
      changePhase("inspecting");
      setInspect(pl);
      setTarget(null);
      player.current?.unlock();
    },
    [changePhase],
  );

  const closeInspect = useCallback(() => {
    setInspect(null); // InspectController flies back, then onReturned fires
  }, []);

  // Fired from the render loop every frame the visitor stands in the door —
  // the ref makes it once-only. "leaving" keeps the unlock from reading as an
  // Esc-pause, and disables movement while the room fades.
  const leavingRef = useRef(false);
  const onExitDoor = useCallback(() => {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    setLeaving(true);
    changePhase("leaving");
    player.current?.unlock();
    sessionStorage.setItem(ARRIVE_DARK_KEY, "1");
    setTimeout(() => router.push("/"), 750);
  }, [changePhase, router]);

  // Stepping away from a painting resumes the walk directly — the pause
  // dialog is reserved for Esc while walking. lock() falls back to drag-look
  // if the browser refuses, so this always lands back in "walking".
  const onReturned = useCallback(() => {
    if (phaseRef.current === "inspecting") {
      player.current?.lock();
    }
  }, []);

  // Esc closes the inspect view (pointer is already free there).
  useEffect(() => {
    if (phase !== "inspecting") {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeInspect();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, closeInspect]);

  return (
    <div className={`fixed inset-0 bg-night ${phase === "inspecting" ? "cursor-grab active:cursor-grabbing" : ""}`}>
      <Canvas
        camera={{ fov: 60, near: 0.05, far: 120 }}
        dpr={quality === "high" ? [1, 2] : [1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.5 }}
      >
        <color attach="background" args={["#14100b"]} />
        {/* measure only once the visitor is walking — texture uploads behind
            the vestibule would read as a false frame-rate decline */}
        {phase !== "vestibule" && quality === "high" && (
          <PerformanceMonitor onDecline={() => setQuality("low")} />
        )}
        <GalleryScene
          artist={artist}
          layout={layout}
          inspectSlug={inspect?.painting.slug ?? null}
          quality={quality}
        />
        <PlayerControls
          ref={player}
          layout={layout}
          enabled={phase === "walking"}
          onLockChange={onLockChange}
          onTarget={setTarget}
          onInspect={onInspect}
          onExitDoor={onExitDoor}
        />
        <InspectController inspect={inspect} onRequestClose={closeInspect} onReturned={onReturned} />
      </Canvas>

      {/* ---- walking HUD ---- */}
      {phase === "walking" && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
            <div
              className={`h-1.5 w-1.5 rounded-full transition-all duration-200 ${
                target ? "scale-[2.2] bg-gilt-bright" : "bg-night-ink/70"
              }`}
            />
          </div>
          {target && (
            <p className="engraved pointer-events-none absolute left-1/2 top-[58%] z-30 -translate-x-1/2 text-[11px] tracking-[0.3em] text-night-ink [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">
              {target.painting.title}
            </p>
          )}
          <p className="engraved pointer-events-none absolute bottom-5 left-1/2 z-30 -translate-x-1/2 text-[9.5px] tracking-[0.3em] text-night-soft/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">
            wasd walk · aim and click to inspect · esc to pause
          </p>
        </>
      )}

      {/* ---- paused ---- */}
      {phase === "paused" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45">
          <div className="border border-night-line-strong bg-night-raise/95 px-12 py-9 text-center shadow-[0_18px_60px_-12px_rgba(0,0,0,0.8)]">
            <h2 className="engraved text-[15px] tracking-[0.26em] text-night-ink">{artist.name}</h2>
            <div className="mx-auto mt-3 w-16 border-t border-night-line-strong" />
            <button
              onClick={enter}
              className="engraved mt-6 block w-full cursor-pointer border border-night-line-strong bg-gilt/[0.05] px-8 py-3 text-[11px] tracking-[0.32em] text-gilt-bright transition-all hover:border-gilt-bright/70 hover:bg-gilt/15"
            >
              resume the walk
            </button>
            <Link
              href="/"
              onClick={() => sessionStorage.setItem(ARRIVE_DARK_KEY, "1")}
              className="engraved mt-4 inline-block text-[10px] tracking-[0.28em] text-night-faint underline decoration-night-line underline-offset-4 transition-colors hover:text-gilt-bright"
            >
              ⟵ return to the atlas
            </Link>
          </div>
        </div>
      )}

      {/* ---- inspecting ---- */}
      {phase === "inspecting" && inspect && <InspectPanel placement={inspect} onClose={closeInspect} />}

      {/* ---- leaving through the door: fade to dark, then the atlas ---- */}
      <div
        className={`pointer-events-none absolute inset-0 z-50 bg-night transition-opacity duration-700 ${
          leaving ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* ---- threshold ---- */}
      {vestibule !== "gone" && (
        <Vestibule
          artist={artist}
          periodName={periodName}
          pigment={pigmentOf(artist.periodSlug)}
          ready={ready}
          progress={progress}
          leaving={vestibule === "leaving"}
          onEnter={enter}
        />
      )}
    </div>
  );
}
