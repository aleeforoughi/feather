// objectViewer: a GLB product on a studio stage (Qooler file 27 §4 A1–A5, B8). The environment is RoomEnvironment
// through a PMREM (nothing downloaded), one key and one rim light tinted from the theme, a contact shadow from a
// radial gradient (one quad), a real key-light shadow on the high and mid tiers, and fog from the ground. The model is
// fitted and centred from its bounding box. Drag (or the arrow keys, through attachKeys) orbits with damping inside
// angle limits; hotspots are projected every frame for the React layer to place real buttons; variants swap colours
// on named materials without reloading anything.
import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  DataTexture,
  DirectionalLight,
  Fog,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  Sphere,
  SRGBColorSpace,
  Vector3,
  type Object3D,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import type { FrameTask } from "@aleeforoughi/feather-expression/core"
import type { SceneHooks, SceneRenderer } from "../shared/scene"
import { ThreeHost } from "./host"
import { clamp, fitDistance, settled, smoothDamp, toRadians, type Spring, type Tier } from "./maths"
import type { StudioPost } from "./post"
import { themeColor, tint } from "./theme"

export interface Hotspot {
  id: string
  /** In the model's own coordinates (as authored in the GLB). */
  position: [number, number, number]
  /** The button's accessible name and visible text. */
  label: string
}

export interface ScreenHotspot {
  id: string
  label: string
  /** CSS pixels from the canvas's top left. */
  x: number
  y: number
  /** Inside the view and in front of the camera. */
  visible: boolean
  /** On the side of the model that faces the camera (dim or hide it otherwise). */
  facing: boolean
}

export interface ViewPreset {
  id: string
  label: string
  /** Degrees around the vertical axis; 0 looks at the model's front (+z). */
  azimuth: number
  /** Degrees from straight above; 90 is level with the model. */
  polar: number
}

export interface Variant {
  id: string
  label: string
  /** Material (or mesh) name in the GLB → a colour: a theme variable (`--accent`, `var(--block-2)`) or any CSS colour. */
  colors: Record<string, string>
}

export interface OrbitOptions {
  /** Azimuth limits in degrees (default unlimited). */
  azimuth?: [number, number]
  /** Polar limits in degrees from above (default 25 to 100). */
  polar?: [number, number]
  /** Seconds the camera takes to settle (default 0.25). */
  damping?: number
  /** Degrees per CSS pixel of drag (default 0.4). */
  sensitivity?: number
}

export interface ObjectViewerOptions extends SceneHooks {
  /** A GLB or glTF URL, or an object already built. */
  model: string | Object3D
  /** Turntable speed in degrees a second; 0 holds it still (default 12). It pauses while the person inspects. */
  turntable?: number
  /** Drag to inspect (default true), or its limits and feel; false turns it off. */
  orbit?: boolean | OrbitOptions
  /** Named angles the keys and buttons go to (default front, side, back and above). */
  presets?: ViewPreset[]
  hotspots?: Hotspot[]
  variants?: Variant[]
  /** The variant shown first (default the first). */
  variant?: string
  /** Tone-mapping exposure (default 1). */
  exposure?: number
  /** "transparent" lets the section show through (default); "theme" paints `--background`. */
  background?: "transparent" | "theme"
  /** Vertical field of view in degrees (default 30: a product lens). */
  fov?: number
  post?: StudioPost
  onLoad?(model: Object3D): void
  onError?(error: unknown): void
}

export interface ObjectViewer extends SceneRenderer {
  readonly levels: 3
  /** Screen positions of the hotspots, after every frame that moved them. Returns the unsubscribe. */
  onHotspots(callback: (hotspots: ScreenHotspot[]) => void): () => void
  setVariant(id: string): void
  readonly variant: string | null
  readonly variants: readonly Variant[]
  readonly presets: readonly ViewPreset[]
  /** Turns to a preset, or to face a hotspot, by id. */
  view(id: string): void
  /** Turns by degrees (held inside the limits). */
  orbitBy(azimuth: number, polar: number): void
  setTurntable(degreesPerSecond: number): void
  /** Settles when the model is loaded and on the stage. */
  readonly ready: Promise<Object3D>
}

export const DEFAULT_PRESETS: readonly ViewPreset[] = [
  { id: "front", label: "Front", azimuth: 0, polar: 78 },
  { id: "side", label: "Side", azimuth: 90, polar: 78 },
  { id: "back", label: "Back", azimuth: 180, polar: 78 },
  { id: "above", label: "Above", azimuth: 30, polar: 35 },
]

/** The seconds the turntable waits after the person last touched the view. */
export const TURNTABLE_RESUME = 2.5

/** Centres an object on the origin and scales it to a bounding sphere of radius 1. Returns the box it had. */
export function fitObject(object: Object3D, holder: Object3D): { box: Box3; radius: number; floor: number; footprint: number } {
  object.updateMatrixWorld(true)
  const box = new Box3().setFromObject(object)
  const sphere = box.getBoundingSphere(new Sphere())
  const radius = sphere.radius > 0 ? sphere.radius : 1
  const center = box.getCenter(new Vector3())
  object.position.sub(center)
  holder.scale.setScalar(1 / radius)
  holder.updateMatrixWorld(true)
  const size = box.getSize(new Vector3())
  return { box, radius, floor: -size.y / 2 / radius, footprint: Math.max(size.x, size.z) / radius }
}

/** Hotspots in screen space: model coordinates through the model's matrix and the camera. */
export function projectHotspots(hotspots: readonly Hotspot[], model: Object3D, camera: PerspectiveCamera, width: number, height: number): ScreenHotspot[] {
  const world = new Vector3()
  const ndc = new Vector3()
  const toCamera = new Vector3()
  const center = new Vector3().setFromMatrixPosition(model.parent?.matrixWorld ?? model.matrixWorld)
  return hotspots.map((h) => {
    world.set(...h.position).applyMatrix4(model.matrixWorld)
    ndc.copy(world).project(camera)
    toCamera.copy(camera.position).sub(center)
    const facing = world.clone().sub(center).dot(toCamera) >= 0
    const visible = ndc.z > -1 && ndc.z < 1 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1
    return { id: h.id, label: h.label, x: (ndc.x * 0.5 + 0.5) * width, y: (-ndc.y * 0.5 + 0.5) * height, visible, facing }
  })
}

/** A soft round shadow as a texture: alpha falls off with the square of the distance. No canvas needed. */
export function contactShadowTexture(size = 64): DataTexture {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2)
      const i = (y * size + x) * 4
      data[i] = data[i + 1] = data[i + 2] = 255
      data[i + 3] = Math.round(255 * clamp(1 - d, 0, 1) ** 2)
    }
  }
  const texture = new DataTexture(data, size, size)
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

const SHADOW_MAP: Record<Tier, number> = { high: 1024, mid: 512, low: 0 }

/** A product on a studio stage, as a World renderer. */
export function objectViewer(options: ObjectViewerOptions): ObjectViewer {
  const orbit: Required<OrbitOptions> & { enabled: boolean } = {
    enabled: options.orbit !== false,
    azimuth: [-Infinity, Infinity],
    polar: [25, 100],
    damping: 0.25,
    sensitivity: 0.4,
    ...(typeof options.orbit === "object" ? options.orbit : {}),
  }
  const presets = options.presets ?? DEFAULT_PRESETS
  const hotspots = options.hotspots ?? []
  const variants = options.variants ?? []
  const fov = options.fov ?? 30
  let turntable = options.turntable ?? 12
  let variant: string | null = options.variant ?? variants[0]?.id ?? null
  const listeners = new Set<(h: ScreenHotspot[]) => void>()
  let lastEmitted = ""

  const start = presets[0] ?? DEFAULT_PRESETS[0]
  let azimuth: Spring = { value: start.azimuth, velocity: 0 }
  let polar: Spring = { value: start.polar, velocity: 0 }
  let azimuthTarget = start.azimuth
  let polarTarget = clamp(start.polar, ...orbit.polar)
  let lastTouch = -Infinity
  let now = 0
  let dragging: { id: number; x: number; y: number } | null = null

  let camera: PerspectiveCamera | null = null
  let holder: Group | null = null
  let model: Object3D | null = null
  let fit = { radius: 1, floor: -0.5, footprint: 1 }
  let key: DirectionalLight | null = null
  let rim: DirectionalLight | null = null
  let ground: Mesh | null = null
  let blob: Mesh | null = null
  let environment: WebGLRenderTarget | null = null
  let distance = 4
  const byName = new Map<string, Material[]>()
  let loading: Promise<Object3D> | null = null
  let resolveReady: (o: Object3D) => void = () => {}
  let rejectReady: (e: unknown) => void = () => {}
  const ready = new Promise<Object3D>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  ready.catch(() => {})

  const makeEnvironment = (renderer: WebGLRenderer, scene: Scene) => {
    environment?.dispose()
    const pmrem = new PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    environment = pmrem.fromScene(room, 0.04)
    scene.environment = environment.texture
    room.dispose()
    pmrem.dispose()
  }

  const host = new ThreeHost({
    hooks: options,
    toneMapping: ACESFilmicToneMapping,
    exposure: options.exposure ?? 1,
    post: options.post,
    init(renderer, theme, canvas) {
      const scene = new Scene()
      makeEnvironment(renderer, scene)
      scene.environmentIntensity = 0.8
      if (options.background === "theme") scene.background = theme.background.clone()
      scene.fog = new Fog(theme.background.clone(), 3, 12)
      camera = new PerspectiveCamera(fov, 1, 0.01, 100)
      holder = new Group()
      scene.add(holder)
      // One key, one rim: two dynamic lights (the budget is three), tinted from the brand.
      key = new DirectionalLight(tint(theme.primary, 0.92), 2.2)
      key.position.set(2.5, 4, 3)
      key.shadow.camera.near = 0.5
      key.shadow.camera.far = 12
      key.shadow.camera.left = key.shadow.camera.bottom = -1.6
      key.shadow.camera.right = key.shadow.camera.top = 1.6
      key.shadow.radius = 4
      key.shadow.bias = -0.0005
      rim = new DirectionalLight(tint(theme.accent, 0.7), 1.6)
      rim.position.set(-3, 2, -3.5)
      scene.add(key, rim)
      const shadowTexture = host.track(contactShadowTexture())
      blob = new Mesh(host.track(new PlaneGeometry(1, 1)), host.track(new MeshBasicMaterial({ map: shadowTexture, color: theme.foreground.clone(), transparent: true, opacity: 0.4, depthWrite: false })))
      blob.rotation.x = -Math.PI / 2
      blob.renderOrder = -1
      blob.visible = false
      ground = new Mesh(host.track(new PlaneGeometry(6, 6)), host.track(new ShadowMaterial({ color: theme.foreground.clone(), opacity: 0.18, depthWrite: false })))
      ground.rotation.x = -Math.PI / 2
      ground.receiveShadow = true
      ground.visible = false
      scene.add(blob, ground)
      if (orbit.enabled) bindPointer(canvas)
      void load()
      return { scene, camera }
    },
    resize(width, height) {
      if (!camera) return
      camera.aspect = width / height
      distance = fitDistance(1, fov, camera.aspect)
      camera.near = distance / 50
      camera.far = distance * 10
      camera.updateProjectionMatrix()
      const fog = host.scene?.fog as Fog | undefined
      if (fog) {
        fog.near = distance * 1.1
        fog.far = distance * 3.2
      }
      lastEmitted = ""
    },
    tier(tier) {
      const renderer = host.renderer
      if (!renderer || !key) return
      const size = SHADOW_MAP[tier]
      renderer.shadowMap.enabled = size > 0
      key.castShadow = size > 0
      if (size > 0 && key.shadow.mapSize.x !== size) {
        key.shadow.map?.dispose()
        key.shadow.map = null
        key.shadow.mapSize.set(size, size)
      }
      if (ground) ground.visible = size > 0 && model !== null
    },
    restore(renderer) {
      if (host.scene) makeEnvironment(renderer, host.scene)
    },
  })
  host.onDispose(() => environment?.dispose())

  const touch = () => {
    lastTouch = now
    host.invalidate()
  }

  const bindPointer = (canvas: HTMLCanvasElement) => {
    const previousTouch = canvas.style.getPropertyValue("touch-action")
    // Vertical swipes still scroll the page on touch; only a sideways drag turns the model.
    canvas.style.setProperty("touch-action", "pan-y")
    canvas.dataset.cursor = "drag"
    host.onDispose(() => {
      if (previousTouch) canvas.style.setProperty("touch-action", previousTouch)
      else canvas.style.removeProperty("touch-action")
      delete canvas.dataset.cursor
    })
    host.listen<PointerEvent>(canvas, "pointerdown", (e) => {
      if (e.button !== 0) return
      dragging = { id: e.pointerId, x: e.clientX, y: e.clientY }
      canvas.setPointerCapture?.(e.pointerId)
      touch()
    })
    host.listen<PointerEvent>(canvas, "pointermove", (e) => {
      if (!dragging || e.pointerId !== dragging.id) return
      const dx = e.clientX - dragging.x
      const dy = e.clientY - dragging.y
      dragging = { id: e.pointerId, x: e.clientX, y: e.clientY }
      viewer.orbitBy(-dx * orbit.sensitivity, -dy * orbit.sensitivity)
    })
    const release = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== dragging.id) return
      dragging = null
      canvas.releasePointerCapture?.(e.pointerId)
      touch()
    }
    host.listen<PointerEvent>(canvas, "pointerup", release)
    host.listen<PointerEvent>(canvas, "pointercancel", release)
  }

  const collectMaterials = (root: Object3D) => {
    root.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of materials) {
        for (const name of [m.name, mesh.name]) {
          if (!name) continue
          const list = byName.get(name) ?? []
          if (!list.includes(m)) list.push(m)
          byName.set(name, list)
        }
      }
    })
  }

  const applyVariant = () => {
    const chosen = variants.find((v) => v.id === variant)
    const theme = host.theme
    if (!chosen || !theme || !model) return
    for (const [name, ref] of Object.entries(chosen.colors)) {
      const color = themeColor(theme, ref, host.canvas)
      for (const m of byName.get(name) ?? []) {
        const coloured = m as Material & { color?: Color }
        if (coloured.color instanceof Color) coloured.color.copy(color)
      }
    }
  }

  const place = (object: Object3D) => {
    if (!holder || host.disposed) return
    model = object
    holder.add(object)
    host.trackObject(object)
    collectMaterials(object)
    fit = fitObject(object, holder)
    if (blob) {
      blob.position.y = fit.floor + 0.002
      blob.scale.setScalar(fit.footprint * 1.5)
      blob.visible = true
    }
    if (ground) {
      ground.position.y = fit.floor + 0.001
      ground.visible = key?.castShadow === true
    }
    applyVariant()
    lastEmitted = ""
    options.onLoad?.(object)
    resolveReady(object)
    host.invalidate()
  }

  const load = (): Promise<Object3D> => {
    if (loading) return loading
    const source = options.model
    loading = (typeof source === "string" ? new GLTFLoader().loadAsync(source).then((gltf) => gltf.scene as Object3D) : Promise.resolve(source)).then(
      (object) => {
        place(object)
        return object
      },
      (error: unknown) => {
        options.onError?.(error)
        host.stop({ reason: "asset", error: error instanceof Error ? error : undefined })
        rejectReady(error)
        throw error
      },
    )
    loading.catch(() => {})
    return loading
  }

  const emit = () => {
    if (listeners.size === 0 || !model || !camera || hotspots.length === 0) return
    const screen = projectHotspots(hotspots, model, camera, host.width, host.height)
    const signature = screen.map((h) => `${Math.round(h.x * 2)},${Math.round(h.y * 2)},${h.visible ? 1 : 0}${h.facing ? 1 : 0}`).join(";")
    if (signature === lastEmitted) return
    lastEmitted = signature
    for (const listener of listeners) listener(screen)
  }

  const placeCamera = () => {
    if (!camera) return
    const a = toRadians(azimuth.value)
    const p = toRadians(polar.value)
    camera.position.set(distance * Math.sin(p) * Math.sin(a), distance * Math.cos(p), distance * Math.sin(p) * Math.cos(a))
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
  }

  const viewer: ObjectViewer = {
    levels: 3,
    get variant() {
      return variant
    },
    variants,
    presets,
    ready,
    get state() {
      return host.link.state
    },
    /** The World keeps its still up until this is true (docs/scene.md). */
    get drawn() {
      return (host.link.state) === "ready"
    },
    subscribe: (listener) => host.link.subscribe(listener),
    connect: (world) => host.connect(world),
    onHotspots(callback) {
      listeners.add(callback)
      lastEmitted = ""
      host.invalidate()
      return () => listeners.delete(callback)
    },
    setVariant(id) {
      if (!variants.some((v) => v.id === id)) return
      variant = id
      applyVariant()
      host.invalidate()
    },
    view(id) {
      const preset = presets.find((p) => p.id === id)
      if (preset) {
        azimuthTarget = nearestTurn(azimuth.value, preset.azimuth)
        polarTarget = clamp(preset.polar, ...orbit.polar)
      } else {
        const spot = hotspots.find((h) => h.id === id)
        if (!spot || !model) return
        const p = new Vector3(...spot.position).applyMatrix4(model.matrixWorld)
        if (p.lengthSq() < 1e-8) return
        azimuthTarget = nearestTurn(azimuth.value, (Math.atan2(p.x, p.z) * 180) / Math.PI)
        polarTarget = clamp((Math.acos(clamp(p.y / p.length(), -1, 1)) * 180) / Math.PI, ...orbit.polar)
      }
      azimuthTarget = clamp(azimuthTarget, ...orbit.azimuth)
      touch()
    },
    orbitBy(da, dp) {
      azimuthTarget = clamp(azimuthTarget + da, ...orbit.azimuth)
      polarTarget = clamp(polarTarget + dp, ...orbit.polar)
      touch()
    },
    setTurntable(speed) {
      turntable = Math.max(0, speed)
      host.invalidate()
    },
    resize: (frame) => host.resize(frame),
    setLevel: (level) => host.setLevel(level),
    frame(frame) {
      if (!host.ensure(frame)) return false
      const delta = Math.min(frame.delta, 50) / 1000
      now = frame.time / 1000
      const spinning = turntable > 0 && model !== null && dragging === null && now - lastTouch > TURNTABLE_RESUME
      if (spinning) azimuthTarget = clamp(azimuthTarget + turntable * delta, ...orbit.azimuth)
      azimuth = smoothDamp(azimuth, azimuthTarget, orbit.damping, delta)
      polar = smoothDamp(polar, polarTarget, orbit.damping, delta)
      placeCamera()
      const settling = !settled(azimuth, azimuthTarget, 100) || !settled(polar, polarTarget, 100)
      const moving = model !== null && (settling || turntable > 0)
      host.render(now, moving)
      emit()
      return moving
    },
    prewarm(): FrameTask[] {
      return [() => (host.live ? load().catch(() => {}) : undefined), host.compileTask, host.uploadTask]
    },
    dispose() {
      listeners.clear()
      byName.clear()
      host.dispose()
      model = holder = camera = key = rim = ground = blob = null
      environment = null
    },
  }
  return viewer
}

/** The target angle closest to where the camera is now, so a preset never spins the long way round. */
function nearestTurn(current: number, target: number): number {
  return target + Math.round((current - target) / 360) * 360
}

/**
 * Keyboard inspection on any element (the wrapper around the World, never the aria-hidden World itself): arrows turn
 * the view 15° (up and down 10°), Home goes to the first preset and the digits 1–9 to each preset. The element becomes
 * focusable if it was not and states its shortcuts. Returns the detach.
 */
export function attachKeys(el: HTMLElement, viewer: Pick<ObjectViewer, "orbitBy" | "view" | "presets">, step = 15): () => void {
  const hadTabIndex = el.hasAttribute("tabindex")
  const previousShortcuts = el.getAttribute("aria-keyshortcuts")
  if (!hadTabIndex) el.tabIndex = 0
  el.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown Home")
  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target !== el) return
    const vertical = (step * 2) / 3
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -vertical], ArrowDown: [0, vertical] }
    const move = moves[e.key]
    if (move) viewer.orbitBy(...move)
    else if (e.key === "Home" && viewer.presets[0]) viewer.view(viewer.presets[0].id)
    else if (/^[1-9]$/.test(e.key) && viewer.presets[Number(e.key) - 1]) viewer.view(viewer.presets[Number(e.key) - 1].id)
    else return
    e.preventDefault()
  }
  el.addEventListener("keydown", onKey)
  return () => {
    el.removeEventListener("keydown", onKey)
    if (!hadTabIndex) el.removeAttribute("tabindex")
    if (previousShortcuts === null) el.removeAttribute("aria-keyshortcuts")
    else el.setAttribute("aria-keyshortcuts", previousShortcuts)
  }
}

