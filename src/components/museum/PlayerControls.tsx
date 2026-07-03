"use client";

// First-person movement and look. Prefers the Pointer Lock API (mouse-look);
// when a browser refuses the lock (iframes, remote sessions, some devices) it
// degrades to drag-to-look so the museum stays walkable. Also owns the
// crosshair raycast that decides which painting is under the visitor's eye,
// and the click that inspects it.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Placement, MuseumLayout } from "./layout";
import { EYE_HEIGHT } from "./layout";
import { PAINTING_NAME_PREFIX } from "./Painting";

const WALK_SPEED = 3.1;
const SPRINT_SPEED = 5.2;
const LOOK_SPEED = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.02;
const INSPECT_RANGE = 7;
const PLAYER_RADIUS = 0.42;
const BENCH_HALF = { x: 0.95, z: 0.32 }; // bench AABB (before rotation)
const CLICK_SLOP_PX = 5; // drag-look mode: bigger moves aren't clicks
// walking into the atlas doorway on the entry wall leaves the museum
const DOOR_HALF_W = 0.8;
const DOOR_TRIGGER = 0.58; // distance from the entry wall that counts as "through"

type Mode = "none" | "locked" | "drag";

export interface PlayerApi {
  lock: () => void;
  unlock: () => void;
}

interface Props {
  layout: MuseumLayout;
  /** movement + raycast run only while walking */
  enabled: boolean;
  onLockChange: (locked: boolean) => void;
  onTarget: (placement: Placement | null) => void;
  onInspect: (placement: Placement) => void;
  /** the visitor walked into the atlas doorway on the entry wall */
  onExitDoor: () => void;
}

const PlayerControls = forwardRef<PlayerApi, Props>(function PlayerControls(
  { layout, enabled, onLockChange, onTarget, onInspect, onExitDoor },
  ref,
) {
  const { camera, gl, scene } = useThree();
  const mode = useRef<Mode>("none");
  const keys = useRef<Record<string, boolean>>({});
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const velocity = useRef(new THREE.Vector3());
  const targeted = useRef<Placement | null>(null);
  const dragButton = useRef(false);
  const downAt = useRef<[number, number] | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // The inspect flight rotates the camera behind our back; re-seed the look
  // euler from wherever the camera is pointing when control resumes.
  const syncEuler = useCallback(() => {
    euler.current.setFromQuaternion(camera.quaternion);
  }, [camera]);

  const enterDrag = useCallback(() => {
    if (mode.current === "none") {
      mode.current = "drag";
      syncEuler();
      onLockChange(true);
    }
  }, [onLockChange, syncEuler]);

  const lock = useCallback(() => {
    const el = gl.domElement;
    // One retry before giving up: a relock right after exiting pointer lock
    // can hit Chrome's unlock cooldown and reject spuriously.
    const attempt = (retriesLeft: number) => {
      let settled = false;
      const fail = () => {
        if (settled) {
          return;
        }
        settled = true;
        if (retriesLeft > 0) {
          setTimeout(() => attempt(retriesLeft - 1), 600);
        } else {
          // The environment refuses the lock: degrade to drag-look rather
          // than stranding the visitor at the door.
          enterDrag();
        }
      };
      try {
        const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
        if (p && typeof p.catch === "function") {
          p.then(() => {
            settled = true;
          }).catch(fail);
        } else {
          // Older engines: only the error event tells us.
          const onErr = () => fail();
          document.addEventListener("pointerlockerror", onErr, { once: true });
          setTimeout(() => {
            document.removeEventListener("pointerlockerror", onErr);
            if (!document.pointerLockElement) {
              fail();
            }
          }, 350);
        }
      } catch {
        fail();
      }
    };
    attempt(1);
  }, [gl, enterDrag]);

  const unlock = useCallback(() => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
      // pointerlockchange listener does the bookkeeping
    } else if (mode.current !== "none") {
      mode.current = "none";
      onLockChange(false);
    }
  }, [onLockChange]);

  useImperativeHandle(ref, () => ({ lock, unlock }), [lock, unlock]);

  // Spawn once.
  useEffect(() => {
    camera.position.set(...layout.spawn);
    euler.current.set(0, 0, 0); // face the far wall (-z)
    camera.quaternion.setFromEuler(euler.current);
  }, [camera, layout]);

  // Pointer-lock lifecycle.
  useEffect(() => {
    const el = gl.domElement;
    const onChange = () => {
      if (document.pointerLockElement === el) {
        mode.current = "locked";
        syncEuler();
        onLockChange(true);
      } else if (mode.current === "locked") {
        mode.current = "none";
        onLockChange(false);
      }
    };
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, [gl, onLockChange, syncEuler]);

  // Keyboard.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      // In drag mode there's no browser Esc-unlock, so provide our own.
      if (e.code === "Escape" && mode.current === "drag" && enabledRef.current) {
        unlock();
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [unlock]);

  // Mouse look + click-to-inspect.
  useEffect(() => {
    const el = gl.domElement;

    const applyLook = (dx: number, dy: number) => {
      euler.current.y -= dx * LOOK_SPEED;
      euler.current.x = THREE.MathUtils.clamp(euler.current.x - dy * LOOK_SPEED, -MAX_PITCH, MAX_PITCH);
      camera.quaternion.setFromEuler(euler.current);
    };

    const onMove = (e: MouseEvent) => {
      if (!enabledRef.current) {
        return;
      }
      if (mode.current === "locked") {
        applyLook(e.movementX, e.movementY);
      } else if (mode.current === "drag" && dragButton.current) {
        applyLook(e.movementX, e.movementY);
      }
    };

    const onDown = (e: MouseEvent) => {
      if (!enabledRef.current || e.button !== 0) {
        return;
      }
      if (mode.current === "locked") {
        if (targeted.current) {
          onInspect(targeted.current);
        }
        return;
      }
      if (mode.current === "drag") {
        dragButton.current = true;
        downAt.current = [e.clientX, e.clientY];
      }
    };

    const onUp = (e: MouseEvent) => {
      if (mode.current !== "drag" || e.button !== 0) {
        return;
      }
      dragButton.current = false;
      if (enabledRef.current && downAt.current && targeted.current) {
        const dx = e.clientX - downAt.current[0];
        const dy = e.clientY - downAt.current[1];
        if (dx * dx + dy * dy <= CLICK_SLOP_PX * CLICK_SLOP_PX) {
          onInspect(targeted.current);
        }
      }
      downAt.current = null;
    };

    document.addEventListener("mousemove", onMove);
    el.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      el.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
    };
  }, [gl, camera, onInspect]);

  useFrame((_, rawDelta) => {
    if (!enabled || mode.current === "none") {
      return;
    }
    const delta = Math.min(rawDelta, 0.05);
    const k = keys.current;

    // -- move --
    const speed = k.ShiftLeft || k.ShiftRight ? SPRINT_SPEED : WALK_SPEED;
    const input = new THREE.Vector3(
      (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0),
      0,
      (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0),
    );
    const wish = new THREE.Vector3();
    if (input.lengthSq() > 0) {
      input.normalize();
      const yaw = new THREE.Euler(0, euler.current.y, 0, "YXZ");
      // camera-space input rotated into the world, flattened to the floor
      wish.copy(input).applyEuler(yaw).setY(0).normalize().multiplyScalar(speed);
    }
    velocity.current.lerp(wish, 1 - Math.pow(0.0001, delta));
    camera.position.addScaledVector(velocity.current, delta);
    camera.position.y = EYE_HEIGHT;

    // -- collide: room bounds --
    const bx = layout.width / 2 - PLAYER_RADIUS;
    const bz = layout.length / 2 - PLAYER_RADIUS;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -bx, bx);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -bz, bz);

    // -- the way out: pressing into the doorway on the entry wall (+z).
    // Must be facing the door, so backing into it (the spawn point sits in
    // the door lane) doesn't eject the visitor by surprise. --
    if (camera.position.z > layout.length / 2 - DOOR_TRIGGER && Math.abs(camera.position.x) < DOOR_HALF_W) {
      const fwd = camera.getWorldDirection(new THREE.Vector3());
      if (fwd.z > 0.35) {
        onExitDoor();
      }
    }

    // -- collide: benches (rotated 90°, so swap the AABB axes) --
    for (const bench of layout.benches) {
      const hx = BENCH_HALF.z + PLAYER_RADIUS;
      const hz = BENCH_HALF.x + PLAYER_RADIUS;
      const dx = camera.position.x - bench.position[0];
      const dz = camera.position.z - bench.position[2];
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        const pushX = hx - Math.abs(dx);
        const pushZ = hz - Math.abs(dz);
        if (pushX < pushZ) {
          camera.position.x += Math.sign(dx || 1) * pushX;
        } else {
          camera.position.z += Math.sign(dz || 1) * pushZ;
        }
      }
    }

    // -- crosshair raycast --
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.far = INSPECT_RANGE;
    const hits = raycaster.intersectObjects(scene.children, true);
    const hit = hits.find((h) => h.object.name.startsWith(PAINTING_NAME_PREFIX));
    const next: Placement | null =
      hit && hit.object === hits[0]?.object ? (hit.object.userData.placement as Placement) : null;

    if (next?.painting.slug !== targeted.current?.painting.slug) {
      // dim the old highlight, warm the new one
      if (targeted.current) {
        const prev = scene.getObjectByName(`${PAINTING_NAME_PREFIX}${targeted.current.painting.slug}`);
        if (prev) {
          (prev.userData.frameMaterial as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        }
      }
      if (next && hit) {
        (hit.object.userData.frameMaterial as THREE.MeshStandardMaterial).emissiveIntensity = 0.22;
      }
      targeted.current = next;
      onTarget(next);
    }
  });

  return null;
});

export default PlayerControls;
