// cameraRail: the camera flies along a CatmullRomCurve3 through waypoints, looking at targets, driven by a progress
// value the caller sets (scroll, a range input), eased toward it as a damped spring (0.2 s: drei ScrollControls'
// damping; Qooler file 27 §4 F33). It rests the moment it arrives. The scene is the caller's (`build`), or a default
// abstract corridor of instanced columns and rings in the palette: three draw calls. Shaders compile in prewarm,
// before the first scroll, so the flight never hitches.
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  TorusGeometry,
  Vector3,
} from "three"
import type { FrameTask } from "@aleeforoughi/feather-expression/core"
import type { SceneHooks, SceneRenderer } from "../shared/scene"
import { ThreeHost } from "./host"
import { clamp, seeded, settled, smoothDamp, type Spring, type Tier } from "./maths"
import type { StudioPost } from "./post"
import { tint, type Theme } from "./theme"

type Point = [number, number, number]

export interface CameraRailOptions extends SceneHooks {
  /** The camera's path, at least two points (default a flight down the corridor). */
  waypoints?: Point[]
  /** One target for the whole flight, or one per waypoint (a second curve). Default: the path just ahead. */
  lookAt?: Point | Point[]
  /** Seconds the camera takes to settle on a new progress (default 0.2). */
  damping?: number
  /** Vertical field of view in degrees (default 45). */
  fov?: number
  /** Builds the caller's scene. Everything added is freed on dispose; return a cleanup for anything else. */
  build?(scene: Scene, theme: Theme): void | (() => void)
  /** "theme" paints `--background` (default); "transparent" lets the page show. */
  background?: "transparent" | "theme"
  exposure?: number
  post?: StudioPost
}

export interface CameraRail extends SceneRenderer {
  readonly levels: 3
  /** Where on the rail to go, 0 to 1. */
  setProgress(progress: number): void
  /** Where the camera is now, 0 to 1 (eased toward the last setProgress). */
  readonly progress: number
}

export const RAIL_DAMPING = 0.2

export const DEFAULT_WAYPOINTS: readonly Point[] = [
  [0, 1.7, 8],
  [1.4, 1.9, -6],
  [-1.2, 1.5, -22],
  [0.9, 2.6, -38],
  [0, 6, -52],
]

/** Columns per tier in the default scene. */
export const RAIL_COLUMNS: Record<Tier, number> = { high: 64, mid: 40, low: 20 }

/** Where the camera is and looks at a point of the flight. */
export function railPose(path: CatmullRomCurve3, look: CatmullRomCurve3 | Vector3 | null, u: number, position = new Vector3(), target = new Vector3()) {
  const t = clamp(u, 0, 1)
  path.getPointAt(t, position)
  if (look instanceof Vector3) target.copy(look)
  else if (look) look.getPointAt(t, target)
  else if (t < 0.99) path.getPointAt(Math.min(1, t + 0.01), target)
  else target.copy(position).add(path.getTangentAt(t))
  return { position, target }
}

/** The default scene: two rows of instanced columns, instanced rings and a floor, in the palette. */
function corridor(scene: Scene, theme: Theme, host: ThreeHost): (tier: Tier) => void {
  const random = seeded(11)
  const palette = theme.blocks.length > 0 ? theme.blocks : [theme.primary, theme.accent]
  const columns = new InstancedMesh(host.track(new BoxGeometry(0.5, 1, 0.5)), host.track(new MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 })), RAIL_COLUMNS.high)
  const dummy = new Object3D()
  const color = new Color()
  for (let i = 0; i < RAIL_COLUMNS.high; i++) {
    // Interleaved so a lower count still spans the whole corridor.
    const row = i % 2 === 0 ? -1 : 1
    const z = 6 - ((i * 37) % RAIL_COLUMNS.high) * (64 / RAIL_COLUMNS.high)
    const height = 1.5 + random() * 4
    dummy.position.set(row * (2.6 + random() * 1.6), height / 2, z)
    dummy.scale.set(1, height, 1)
    dummy.updateMatrix()
    columns.setMatrixAt(i, dummy.matrix)
    columns.setColorAt(i, color.copy(palette[i % palette.length]))
  }
  const rings = new InstancedMesh(host.track(new TorusGeometry(2.4, 0.035, 8, 96)), host.track(new MeshStandardMaterial({ color: theme.accent.clone(), emissive: theme.accent.clone(), emissiveIntensity: 3, roughness: 0.4 })), 8)
  for (let i = 0; i < 8; i++) {
    dummy.position.set(0, 2, -4 - i * 7)
    dummy.scale.setScalar(1)
    dummy.updateMatrix()
    rings.setMatrixAt(i, dummy.matrix)
  }
  const floor = new Mesh(host.track(new PlaneGeometry(16, 96)), host.track(new MeshStandardMaterial({ color: theme.background.clone().lerp(theme.foreground, 0.06), roughness: 0.9 })))
  floor.rotation.x = -Math.PI / 2
  floor.position.z = -24
  host.track(columns)
  host.track(rings)
  scene.add(columns, rings, floor)
  return (tier) => {
    columns.count = RAIL_COLUMNS[tier]
  }
}

/** A camera on rails as a World renderer. */
export function cameraRail(options: CameraRailOptions = {}): CameraRail {
  const waypoints = (options.waypoints && options.waypoints.length >= 2 ? options.waypoints : DEFAULT_WAYPOINTS).map((p) => new Vector3(...p))
  const path = new CatmullRomCurve3(waypoints, false, "centripetal")
  const look = !options.lookAt
    ? null
    : typeof options.lookAt[0] === "number"
      ? new Vector3(...(options.lookAt as Point))
      : (options.lookAt as Point[]).length >= 2
        ? new CatmullRomCurve3((options.lookAt as Point[]).map((p) => new Vector3(...p)), false, "centripetal")
        : new Vector3(...(options.lookAt as Point[])[0])
  const damping = options.damping ?? RAIL_DAMPING
  let progress: Spring = { value: 0, velocity: 0 }
  let target = 0
  let camera: PerspectiveCamera | null = null
  let onTier: ((tier: Tier) => void) | null = null
  const pose = { position: new Vector3(), target: new Vector3() }

  const host = new ThreeHost({
    hooks: options,
    toneMapping: ACESFilmicToneMapping,
    exposure: options.exposure ?? 1,
    post: options.post,
    init(_renderer, theme) {
      const scene = new Scene()
      if (options.background !== "transparent") scene.background = theme.background.clone()
      scene.fog = new Fog(theme.background.clone(), 10, 46)
      camera = new PerspectiveCamera(options.fov ?? 45, 1, 0.1, 120)
      const sky = new HemisphereLight(tint(theme.background, 0.95), theme.foreground.clone(), 1.4)
      const key = new DirectionalLight(tint(theme.primary, 0.9), 1.8)
      key.position.set(4, 10, 6)
      scene.add(sky, key)
      if (options.build) {
        const cleanup = options.build(scene, theme)
        if (typeof cleanup === "function") host.onDispose(cleanup)
      } else onTier = corridor(scene, theme, host)
      // The caller's objects are freed with everything else.
      host.onDispose(() => host.trackObject(scene))
      railPose(path, look, progress.value, pose.position, pose.target)
      camera.position.copy(pose.position)
      camera.lookAt(pose.target)
      return { scene, camera }
    },
    resize(width, height) {
      if (!camera) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },
    tier(tier) {
      onTier?.(tier)
    },
  })

  return {
    levels: 3,
    get progress() {
      return progress.value
    },
    get state() {
      return host.link.state
    },
    /** The World keeps its still up until this is true (docs/scene.md). */
    get drawn() {
      return (host.link.state) === "ready"
    },
    subscribe: (listener) => host.link.subscribe(listener),
    connect: (world) => host.connect(world),
    setProgress(p) {
      const next = clamp(Number.isFinite(p) ? p : 0, 0, 1)
      if (next === target) return
      target = next
      host.invalidate()
    },
    resize: (frame) => host.resize(frame),
    setLevel: (level) => host.setLevel(level),
    frame(frame) {
      if (!host.ensure(frame) || !camera) return false
      const delta = Math.min(frame.delta, 50) / 1000
      progress = smoothDamp(progress, target, damping, delta)
      const moving = !settled(progress, target)
      if (!moving) progress = { value: target, velocity: 0 }
      railPose(path, look, progress.value, pose.position, pose.target)
      camera.position.copy(pose.position)
      camera.lookAt(pose.target)
      host.render(frame.time / 1000, moving)
      return moving
    },
    prewarm(): FrameTask[] {
      return [host.compileTask, host.uploadTask]
    },
    dispose() {
      host.dispose()
      camera = null
      onTier = null
    },
  }
}
