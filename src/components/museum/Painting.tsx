"use client";

// One painting hung on the museum wall: gilded frame, canvas at real scale,
// and a linen placeholder when the image is not freely licensed. While the
// visitor inspects it, the canvas quietly upgrades to the high-res tier.

import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Placement } from "./layout";
import { FRAME_DEPTH } from "./layout";
import { makePlaceholderTexture } from "./placeholder";
import { frameShadowTexture } from "./textures";

export const PAINTING_NAME_PREFIX = "painting:";

const textureLoader = new THREE.TextureLoader();

function prepare(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

interface Props {
  placement: Placement;
  /** true while this painting is the one being inspected */
  active: boolean;
}

export default function Painting({ placement, active }: Props) {
  const { painting, canvasW, canvasH, frameW, frameH } = placement;
  const canvasMat = useRef<THREE.MeshBasicMaterial>(null);
  const inspectMap = useRef<THREE.Texture | null>(null);

  const isFree = painting.imageStatus !== "placeholder" && painting.gallery;

  // Assign the map imperatively (effects run after mount, so the ref is set):
  // swapping null → texture must flag needsUpdate so the shader recompiles
  // with a map channel, which the declarative prop path doesn't reliably do.
  const applyMap = useCallback((tex: THREE.Texture | null) => {
    const mat = canvasMat.current;
    if (!mat) {
      return;
    }
    mat.map = tex;
    mat.color.set(tex ? "#ffffff" : "#2a251c");
    mat.needsUpdate = true;
  }, []);

  // Gallery-tier texture (tracked by the default loading manager, so the
  // vestibule progress bar includes it).
  useEffect(() => {
    if (!isFree) {
      return;
    }
    let disposed = false;
    let tex: THREE.Texture | null = null;
    textureLoader.load(painting.gallery!, (t) => {
      if (disposed) {
        t.dispose();
        return;
      }
      tex = prepare(t);
      applyMap(tex);
    });
    return () => {
      disposed = true;
      tex?.dispose();
    };
  }, [isFree, painting.gallery, applyMap]);

  // Placeholder canvases are drawn locally; redraw once webfonts are in.
  useEffect(() => {
    if (isFree) {
      return;
    }
    let disposed = false;
    let tex: THREE.Texture = makePlaceholderTexture(painting, canvasW, canvasH);
    applyMap(tex);
    document.fonts.ready.then(() => {
      if (disposed) {
        return;
      }
      tex.dispose();
      tex = makePlaceholderTexture(painting, canvasW, canvasH);
      applyMap(tex);
    });
    return () => {
      disposed = true;
      tex.dispose();
    };
  }, [isFree, painting, canvasW, canvasH, applyMap]);

  // First inspect: swap in the ~3000px tier and keep it for the session.
  useEffect(() => {
    if (!active || !painting.inspect || inspectMap.current) {
      return;
    }
    let disposed = false;
    textureLoader.load(painting.inspect, (t) => {
      if (disposed) {
        t.dispose();
        return;
      }
      inspectMap.current = prepare(t);
      applyMap(inspectMap.current);
    });
    return () => {
      disposed = true;
    };
  }, [active, painting.inspect, applyMap]);

  // The kept inspect tier is released only when the painting unmounts.
  useEffect(
    () => () => {
      inspectMap.current?.dispose();
      inspectMap.current = null;
    },
    [],
  );

  const frameMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#8f6e30",
        metalness: 0.85,
        roughness: 0.36,
        clearcoat: 0.3,
        clearcoatRoughness: 0.3,
        envMapIntensity: 1.2,
        emissive: "#96742f",
        emissiveIntensity: 0,
      }),
    [],
  );

  useEffect(() => () => frameMaterial.dispose(), [frameMaterial]);

  // Both meshes carry the same name + userData so the crosshair raycast can
  // hit either the canvas or the moulding.
  const userData = useMemo(() => ({ placement, frameMaterial }), [placement, frameMaterial]);
  const name = `${PAINTING_NAME_PREFIX}${painting.slug}`;

  return (
    <group position={placement.position} rotation={[0, placement.rotationY, 0]}>
      {/* drop shadow on the wall behind the frame: a pre-drawn gradient decal
          (real per-spotlight shadow maps would blow the texture-unit budget) */}
      <mesh position={[0, -0.05, 0.004]}>
        <planeGeometry args={[frameW + 0.26, frameH + 0.26]} />
        <meshBasicMaterial map={frameShadowTexture()} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* frame: four mitred mouldings would be nicer; one slab reads fine at
          walking distance and keeps draw calls low per painting */}
      <mesh name={name} userData={userData} position={[0, 0, FRAME_DEPTH / 2]} material={frameMaterial}>
        <boxGeometry args={[frameW, frameH, FRAME_DEPTH]} />
      </mesh>
      <mesh name={name} userData={userData} position={[0, 0, FRAME_DEPTH + 0.002]}>
        <planeGeometry args={[canvasW, canvasH]} />
        {/* unlit AND untonemapped on purpose: the spotlight pools on the wall
            and gilds the frame, but the artwork itself must reproduce
            faithfully — a lit material would paint the light's hotspot across
            the canvas, and tone mapping would shift the reproduction's colors */}
        <meshBasicMaterial ref={canvasMat} color="#2a251c" toneMapped={false} />
      </mesh>
      {/* varnish: a purely additive gloss film over free images. Black base +
          additive blending means it contributes only specular reflections —
          the environment's sheen and the spotlight's glancing glare — and can
          never darken or diffusely wash the reproduction underneath. */}
      {isFree && (
        <mesh name={name} userData={userData} position={[0, 0, FRAME_DEPTH + 0.0045]}>
          <planeGeometry args={[canvasW, canvasH]} />
          <meshStandardMaterial
            color="#000000"
            metalness={1}
            roughness={0.26}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            envMapIntensity={0.45}
          />
        </mesh>
      )}
    </group>
  );
}
