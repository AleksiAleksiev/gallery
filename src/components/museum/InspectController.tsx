"use client";

// The inspect flight: when a painting is chosen the camera glides to a
// head-on, gallery-lit framing of it. From there the scroll wheel leans in
// and out along the wall normal and dragging pans across the canvas (clamped
// to its edges). A clean click (no drag) asks to close; closing glides back
// to exactly where the visitor stood.

import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { framingDistance, type Placement } from "./layout";

const MIN_DISTANCE = 0.42;
const PANEL_SHIFT = 0.11; // fraction of view width the painting sits left of center
const CLICK_SLOP_PX = 5; // bigger mouse travel than this is a pan, not a click

interface Basis {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  right: THREE.Vector3; // screen-right along the wall
  canvasW: number;
  canvasH: number;
}

interface Props {
  inspect: Placement | null;
  /** a clean click on the scene while inspecting — close me */
  onRequestClose: () => void;
  /** the return flight has landed; hand control back to walking */
  onReturned: () => void;
}

export default function InspectController({ inspect, onRequestClose, onReturned }: Props) {
  const { camera, gl } = useThree();
  const saved = useRef<{ pos: THREE.Vector3; quat: THREE.Quaternion } | null>(null);
  const basis = useRef<Basis | null>(null);
  const view = useRef({ dist: 1, fit: 1, u: 0, v: 0 }); // lateral pan u, vertical pan v
  const active = useRef<Placement | null>(null);

  const hFovOf = useCallback(() => {
    const persp = camera as THREE.PerspectiveCamera;
    return 2 * Math.atan(Math.tan((persp.fov * Math.PI) / 360) * persp.aspect);
  }, [camera]);

  // Camera pose for the current view state: head-on at `dist`, nudged
  // screen-left of center so the wall-label panel doesn't cover the painting,
  // plus whatever the visitor has panned.
  const poseFor = useCallback(() => {
    const b = basis.current!;
    const shift = 2 * view.current.dist * Math.tan(hFovOf() / 2) * PANEL_SHIFT;
    const look = b.center
      .clone()
      .addScaledVector(b.right, shift + view.current.u)
      .add(new THREE.Vector3(0, view.current.v, 0));
    const pos = look.clone().addScaledVector(b.normal, view.current.dist);
    return { pos, look };
  }, [hFovOf]);

  // Photo-viewer clamp: you can only pan as far as there is canvas hidden
  // off-screen (plus a whisker of breathing room), so the view never drifts
  // onto bare wall. The bounds apply to the absolute look-point (shift + u),
  // not to u alone — the resting pose is offset by the panel shift, and
  // clamping u symmetrically would leave the left edge unreachable by
  // exactly that shift. The upper bound never squeezes below the resting
  // shift itself, so zooming doesn't snap the settled view sideways.
  const clampPan = useCallback(() => {
    const b = basis.current!;
    const persp = camera as THREE.PerspectiveCamera;
    const halfVisW = view.current.dist * Math.tan(hFovOf() / 2);
    const halfVisH = view.current.dist * Math.tan((persp.fov * Math.PI) / 360);
    const maxU = Math.max(0, b.canvasW / 2 - halfVisW) + 0.08;
    const maxV = Math.max(0, b.canvasH / 2 - halfVisH) + 0.08;
    const shift = 2 * view.current.dist * Math.tan(hFovOf() / 2) * PANEL_SHIFT;
    view.current.u = THREE.MathUtils.clamp(view.current.u, -maxU - shift, Math.max(maxU, shift) - shift);
    view.current.v = THREE.MathUtils.clamp(view.current.v, -maxV, maxV);
  }, [camera, hFovOf]);

  const glide = useCallback(
    (duration: number, rotate: boolean, onComplete?: () => void) => {
      const { pos, look } = poseFor();
      gsap.to(camera.position, {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        duration,
        ease: "power3.inOut",
        overwrite: "auto",
        onComplete: rotate ? undefined : onComplete,
      });
      if (rotate) {
        const lookAt = new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0));
        const toQuat = new THREE.Quaternion().setFromRotationMatrix(lookAt);
        const fromQuat = camera.quaternion.clone();
        const spin = { t: 0 };
        gsap.to(spin, {
          t: 1,
          duration,
          ease: "power3.inOut",
          overwrite: "auto",
          onUpdate: () => {
            camera.quaternion.slerpQuaternions(fromQuat, toQuat, spin.t);
          },
          onComplete,
        });
      }
    },
    [camera, poseFor],
  );

  // Entry / exit flights.
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    if (inspect) {
      if (!active.current) {
        saved.current = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
      }
      active.current = inspect;
      basis.current = {
        center: new THREE.Vector3(...inspect.position),
        normal: new THREE.Vector3(...inspect.normal),
        right: new THREE.Vector3()
          .crossVectors(new THREE.Vector3(...inspect.normal).negate(), new THREE.Vector3(0, 1, 0))
          .normalize(),
        canvasW: inspect.canvasW,
        canvasH: inspect.canvasH,
      };
      const fit = framingDistance(inspect.canvasW, inspect.canvasH, persp.fov, persp.aspect);
      view.current = { dist: fit, fit, u: 0, v: 0 };
      glide(1.1, true);
      return;
    }
    // Closed: glide back to the saved standing point.
    if (active.current && saved.current) {
      const { pos, quat } = saved.current;
      const fromQuat = camera.quaternion.clone();
      const spin = { t: 0 };
      gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: 0.9, ease: "power3.inOut", overwrite: "auto" });
      gsap.to(spin, {
        t: 1,
        duration: 0.9,
        ease: "power3.inOut",
        overwrite: "auto",
        onUpdate: () => {
          camera.quaternion.slerpQuaternions(fromQuat, quat, spin.t);
        },
        onComplete: onReturned,
      });
      active.current = null;
      saved.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspect, camera]);

  // Scroll leans in / out while inspecting.
  useEffect(() => {
    if (!inspect) {
      return;
    }
    const wheel = (e: WheelEvent) => {
      // let the wall-label panel scroll its own text
      if ((e.target as HTMLElement).closest?.("[data-inspect-panel]")) {
        return;
      }
      e.preventDefault();
      const next = THREE.MathUtils.clamp(
        view.current.dist * Math.pow(1.0016, e.deltaY),
        MIN_DISTANCE,
        view.current.fit,
      );
      if (Math.abs(next - view.current.dist) > 1e-4) {
        view.current.dist = next;
        clampPan();
        glide(0.45, false);
      }
    };
    window.addEventListener("wheel", wheel, { passive: false });
    return () => window.removeEventListener("wheel", wheel);
  }, [inspect, clampPan, glide]);

  // Drag pans across the canvas; a clean click closes.
  useEffect(() => {
    if (!inspect) {
      return;
    }
    let panning = false;
    let travel = 0;

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest?.("[data-inspect-panel]")) {
        return;
      }
      panning = true;
      travel = 0;
    };

    const onMove = (e: MouseEvent) => {
      if (!panning) {
        return;
      }
      travel += Math.abs(e.movementX) + Math.abs(e.movementY);
      const el = gl.domElement;
      const visibleH = 2 * view.current.dist * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360);
      const visibleW = 2 * view.current.dist * Math.tan(hFovOf() / 2);
      // grab semantics: the canvas follows the cursor
      view.current.u -= e.movementX * (visibleW / el.clientWidth);
      view.current.v += e.movementY * (visibleH / el.clientHeight);
      clampPan();
      gsap.killTweensOf(camera.position);
      camera.position.copy(poseFor().pos);
    };

    const onUp = () => {
      if (!panning) {
        return;
      }
      panning = false;
      if (travel <= CLICK_SLOP_PX) {
        onRequestClose();
      }
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [inspect, camera, gl, hFovOf, clampPan, poseFor, onRequestClose]);

  return null;
}
