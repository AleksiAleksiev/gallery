"use client";

// The museum hall itself, realism pass included: plank floor with soft planar
// reflections, mottled plaster walls, a spotlight pool per painting, a
// ceiling laylight, and a procedural light environment for the gilt and
// varnish to catch. Shadows are all prebaked-style — contact shadows for the
// furniture and wall bases, gradient decals for the frames — because one
// shadow map per spotlight would exceed WebGL's 16 texture units per shader.
// `quality` degrades the expensive bits (reflections, dpr) when the frame
// rate can't hold.

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei";
import type { MuseumArtist } from "@/lib/museum";
import Painting from "./Painting";
import { WALL_HEIGHT, type MuseumLayout } from "./layout";
import { disposeMaps, plasterMaps, woodFloorMaps } from "./textures";

export type Quality = "high" | "low";

function makeTitleTexture(artist: MuseumArtist): THREE.CanvasTexture {
  const el = document.createElement("canvas");
  el.width = 2048;
  el.height = 256;
  const ctx = el.getContext("2d")!;
  ctx.clearRect(0, 0, el.width, el.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(74, 66, 52, 0.92)";
  ctx.font = '600 118px "Cormorant Garamond", Georgia, serif';
  const name = artist.name.toUpperCase().split("").join(" ");
  ctx.fillText(name, el.width / 2, 96, el.width - 120);
  const dates = [artist.birthYear, artist.deathYear].filter(Boolean).join(" – ");
  if (dates) {
    ctx.font = 'italic 64px "Cormorant Garamond", Georgia, serif';
    ctx.fillStyle = "rgba(110, 99, 83, 0.85)";
    ctx.fillText(dates, el.width / 2, 200);
  }
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// One plastered wall with its own texture repeat (walls differ in run length).
function Wall({
  run,
  position,
  rotationY,
}: {
  run: number;
  position: [number, number, number];
  rotationY: number;
}) {
  const maps = useMemo(() => plasterMaps(run, WALL_HEIGHT), [run]);
  useEffect(() => () => disposeMaps(maps), [maps]);
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[run, WALL_HEIGHT]} />
      <meshStandardMaterial {...maps} normalScale={new THREE.Vector2(0.6, 0.6)} />
    </mesh>
  );
}

function Floor({ width, length, quality }: { width: number; length: number; quality: Quality }) {
  const maps = useMemo(() => woodFloorMaps(width, length), [width, length]);
  useEffect(() => () => disposeMaps(maps), [maps]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, length]} />
      {quality === "high" ? (
        <MeshReflectorMaterial
          {...maps}
          normalScale={new THREE.Vector2(0.5, 0.5)}
          resolution={1024}
          blur={[400, 130]}
          mixBlur={1}
          mixStrength={1.9}
          mirror={0.5}
          depthScale={0.4}
          minDepthThreshold={0.3}
          maxDepthThreshold={1.2}
        />
      ) : (
        <meshStandardMaterial {...maps} normalScale={new THREE.Vector2(0.5, 0.5)} />
      )}
    </mesh>
  );
}

function makePlaqueTexture(text: string): THREE.CanvasTexture {
  const el = document.createElement("canvas");
  el.width = 512;
  el.height = 96;
  const ctx = el.getContext("2d")!;
  ctx.clearRect(0, 0, el.width, el.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(96, 86, 68, 0.9)";
  ctx.font = '600 44px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(text.toUpperCase().split("").join(" "), el.width / 2, el.height / 2, el.width - 40);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// The way out: a recessed dark opening on the entry wall, cased in timber
// with an engraved plaque above — the door the visitor came in through.
function Doorway({ z }: { z: number }) {
  const plaqueTex = useMemo(() => makePlaqueTexture("the atlas"), []);
  useEffect(() => () => plaqueTex.dispose(), [plaqueTex]);
  const timber = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#3b2c1f", roughness: 0.45, envMapIntensity: 0.6 }),
    [],
  );
  useEffect(() => () => timber.dispose(), [timber]);
  return (
    <group position={[0, 0, z]}>
      {/* the opening itself, sitting just off the wall while the casing
          stands 15 cm proud — the depth difference sells the recess. Unlit
          near-black so it reads as space beyond the room. */}
      <mesh position={[0, 1.32, -0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.62, 2.64]} />
        <meshBasicMaterial color="#0b0805" />
      </mesh>
      {/* reveal: timber lining the sides of the recess */}
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 1.32, -0.075]} material={timber}>
          <boxGeometry args={[0.08, 2.64, 0.15]} />
        </mesh>
      ))}
      {/* architrave: jambs + lintel proud of the wall */}
      {[-0.96, 0.96].map((x) => (
        <mesh key={x} position={[x, 1.32, -0.05]} material={timber}>
          <boxGeometry args={[0.18, 2.64, 0.16]} />
        </mesh>
      ))}
      <mesh position={[0, 2.75, -0.05]} material={timber}>
        <boxGeometry args={[2.3, 0.22, 0.16]} />
      </mesh>
      {/* brass edge on the lintel */}
      <mesh position={[0, 2.75, -0.14]}>
        <boxGeometry args={[2.3, 0.1, 0.02]} />
        <meshStandardMaterial color="#8f6e30" metalness={0.85} roughness={0.35} envMapIntensity={1.1} />
      </mesh>
      {/* engraved label above the door */}
      <mesh position={[0, 3.12, -0.015]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.15, 0.22]} />
        <meshBasicMaterial map={plaqueTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Bench({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[1.8, 0.08, 0.5]} />
        <meshStandardMaterial color="#4a3626" roughness={0.35} envMapIntensity={0.6} />
      </mesh>
      {[-0.72, 0.72].map((x) => (
        <mesh key={x} position={[x, 0.19, 0]}>
          <boxGeometry args={[0.09, 0.38, 0.42]} />
          <meshStandardMaterial color="#3b2c1f" roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

// Recessed laylight running down the ceiling: an emissive panel in a shallow
// cove. Not a light source itself — the ambient/hemisphere pretend for it —
// but it reads as the room's daylight and shows up in the floor reflections.
function Laylight({ length }: { length: number }) {
  const panelL = Math.max(4, length - 6);
  const w = 1.5;
  return (
    <group position={[0, WALL_HEIGHT, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[w, panelL]} />
        <meshStandardMaterial color="#ffffff" emissive="#fff3dc" emissiveIntensity={1.35} />
      </mesh>
      {/* cove trim */}
      {(
        [
          { pos: [w / 2 + 0.05, -0.05, 0] as const, size: [0.1, 0.1, panelL + 0.2] as const },
          { pos: [-w / 2 - 0.05, -0.05, 0] as const, size: [0.1, 0.1, panelL + 0.2] as const },
          { pos: [0, -0.05, panelL / 2 + 0.05] as const, size: [w + 0.2, 0.1, 0.1] as const },
          { pos: [0, -0.05, -panelL / 2 - 0.05] as const, size: [w + 0.2, 0.1, 0.1] as const },
        ] as const
      ).map((t, i) => (
        <mesh key={i} position={[t.pos[0], t.pos[1], t.pos[2]]}>
          <boxGeometry args={[t.size[0], t.size[1], t.size[2]]} />
          <meshStandardMaterial color="#e8e0cd" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

interface Props {
  artist: MuseumArtist;
  layout: MuseumLayout;
  inspectSlug: string | null;
  quality: Quality;
}

export default function GalleryScene({ artist, layout, inspectSlug, quality }: Props) {
  const { width, length, placements, benches } = layout;
  const halfW = width / 2;
  const halfL = length / 2;

  const titleTex = useMemo(() => makeTitleTexture(artist), [artist]);
  useEffect(() => () => titleTex.dispose(), [titleTex]);

  return (
    <>
      {/* ---- room shell ---- */}
      <Floor width={width} length={length} quality={quality} />
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT, 0]}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#efe8d8" roughness={1} />
      </mesh>
      <Laylight length={length} />
      {/* far / entry walls */}
      <Wall run={width} position={[0, WALL_HEIGHT / 2, -halfL]} rotationY={0} />
      <Wall run={width} position={[0, WALL_HEIGHT / 2, halfL]} rotationY={Math.PI} />
      {/* side walls */}
      <Wall run={length} position={[halfW, WALL_HEIGHT / 2, 0]} rotationY={-Math.PI / 2} />
      <Wall run={length} position={[-halfW, WALL_HEIGHT / 2, 0]} rotationY={Math.PI / 2} />

      {/* baseboard + picture rail, the cheap classical details */}
      {(
        [
          { pos: [0, 0, -halfL + 0.045] as const, rot: 0, len: width },
          { pos: [0, 0, halfL - 0.045] as const, rot: Math.PI, len: width },
          { pos: [halfW - 0.045, 0, 0] as const, rot: -Math.PI / 2, len: length },
          { pos: [-halfW + 0.045, 0, 0] as const, rot: Math.PI / 2, len: length },
        ] as const
      ).map((w, i) => (
        <group key={i} position={[w.pos[0], 0, w.pos[2]]} rotation={[0, w.rot, 0]}>
          <mesh position={[0, 0.09, 0]}>
            <boxGeometry args={[w.len, 0.18, 0.05]} />
            <meshStandardMaterial color="#8c8066" roughness={0.55} envMapIntensity={0.5} />
          </mesh>
          <mesh position={[0, 3.35, 0.01]}>
            <boxGeometry args={[w.len, 0.05, 0.035]} />
            <meshStandardMaterial color="#a89a7c" roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* doorway back to the atlas on the entry wall: a recessed dark
          opening in a timber architrave, labelled so it reads as the way
          out rather than a stray black rectangle */}
      <Doorway z={halfL} />

      {/* artist name above the far wall — exact placard color, no tonemap */}
      <mesh position={[0, 3.72, -halfL + 0.02]}>
        <planeGeometry args={[Math.min(7.4, width - 1.2), Math.min(7.4, width - 1.2) / 8]} />
        <meshBasicMaterial map={titleTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>

      {/* ---- light ---- */}
      <ambientLight intensity={0.18} color="#fff3dd" />
      <hemisphereLight intensity={0.28} color="#f6ecd9" groundColor="#3a2f24" />
      {placements.map((pl) => {
        const lightPos = new THREE.Vector3(...pl.position)
          .add(new THREE.Vector3(...pl.normal).multiplyScalar(2.1))
          .setY(WALL_HEIGHT - 0.3);
        return (
          <SpotFor
            key={pl.painting.slug}
            position={lightPos.toArray() as [number, number, number]}
            target={pl.position}
            wide={Math.max(pl.frameW, pl.frameH)}
          />
        );
      })}

      {/* soft ambient-occlusion pass: bench shadows + the wall/floor junction.
          The scene is static, so it renders exactly once. */}
      <ContactShadows
        position={[0, 0.01, 0]}
        scale={[width, length]}
        far={1.15}
        blur={2.4}
        opacity={0.42}
        resolution={512}
        frames={1}
        color="#140f09"
      />

      {/* what the gilt frames and varnish reflect: a warm laylight overhead,
          plaster-toned side fill, dark floor bounce. Rendered once. */}
      <Environment resolution={128} environmentIntensity={0.35}>
        <Lightformer form="rect" intensity={2.6} color="#fff2dc" position={[0, 5, 0]} scale={[2.4, 12, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#d8cdb2" position={[6, 1.5, 0]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#d8cdb2" position={[-6, 1.5, 0]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={0.4} color="#cfc4a9" position={[0, 1.5, -8]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={0.35} color="#4a3b2c" position={[0, -5, 0]} scale={[12, 12, 1]} />
      </Environment>

      {/* ---- furnishings + the collection ---- */}
      {benches.map((b, i) => (
        <Bench key={i} {...b} />
      ))}
      {placements.map((pl) => (
        <Painting key={pl.painting.slug} placement={pl} active={inspectSlug === pl.painting.slug} />
      ))}
    </>
  );
}

function SpotFor({
  position,
  target,
  wide,
}: {
  position: [number, number, number];
  target: [number, number, number];
  wide: number;
}) {
  const targetObj = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...target);
    return o;
  }, [target]);

  return (
    <>
      <primitive object={targetObj} />
      <spotLight
        position={position}
        target={targetObj}
        intensity={30}
        distance={9}
        angle={Math.min(0.32 + wide * 0.09, 0.75)}
        penumbra={0.55}
        decay={1.8}
        color="#ffe9c4"
      />
    </>
  );
}
