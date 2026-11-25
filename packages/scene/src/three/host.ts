// The part every Three.js World renderer shares: one WebGLRenderer on the World's canvas (made on the first resize, so
// the canvas exists), the World's capped pixel ratio, the tier ladder, render on demand, context loss, and one bin
// that frees every geometry, material, texture and render target the scene made.
import {
  Material,
  Mesh,
  Texture,
  WebGLRenderer,
  type Camera,
  type Object3D,
  type Scene,
  type ToneMapping,
} from "three"
import type { WorldController, WorldFrame } from "@aleeforoughi/feather-expression/core"
import { sceneLink, type SceneHooks, type SceneLink, type SceneStop } from "../shared/scene"
import { tierOf, type Tier } from "./maths"
import type { StudioPost } from "./post"
import { readTheme, type Theme } from "./theme"

type Size = Omit<WorldFrame, "time" | "delta">
type Disposable = { dispose(): void }

export interface HostSpec {
  toneMapping: ToneMapping
  exposure?: number
  post?: StudioPost
  /** Builds the scene once the renderer exists. Returns the scene and camera the host renders. */
  init(renderer: WebGLRenderer, theme: Theme, canvas: HTMLCanvasElement): { scene: Scene; camera: Camera }
  resize?(width: number, height: number, pixelRatio: number): void
  tier?(tier: Tier): void
  /** After a lost context comes back: rebuild what lived only on the GPU (the environment map). */
  restore?(renderer: WebGLRenderer): void
  hooks?: SceneHooks
}

export class ThreeHost {
  renderer: WebGLRenderer | null = null
  canvas: HTMLCanvasElement | null = null
  scene: Scene | null = null
  camera: Camera | null = null
  theme: Theme | null = null
  width = 0
  height = 0
  pixelRatio = 1
  quality: Size["quality"] = "high"
  level = 0
  lost = false
  failed = false
  disposed = false
  /** The shared scene state (idle, ready, lost, failed) and the World link: useScene puts the still back on a stop. */
  readonly link: SceneLink
  private readonly bin = new Set<Disposable>()
  private readonly cleanups: (() => void)[] = []
  private readonly spec: HostSpec

  constructor(spec: HostSpec) {
    this.spec = spec
    this.link = sceneLink(spec.hooks)
  }

  get tier(): Tier {
    return tierOf(this.quality, this.level)
  }

  /** Whether the scene can draw right now. */
  get live(): boolean {
    return this.renderer !== null && this.scene !== null && !this.lost && !this.disposed
  }

  connect(world: WorldController | null) {
    this.link.connect(world)
  }

  invalidate() {
    if (!this.disposed) this.link.invalidate()
  }

  stop(stop: SceneStop) {
    this.link.stop(stop)
  }

  track<T extends Disposable>(thing: T): T {
    this.bin.add(thing)
    return thing
  }

  /** Puts everything an object tree holds in the bin: geometries, materials and their textures. */
  trackObject(root: Object3D) {
    root.traverse((node) => {
      const mesh = node as Mesh
      if (mesh.geometry) this.track(mesh.geometry)
      const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []
      for (const material of materials) this.trackMaterial(material)
      if ("isInstancedMesh" in node || "isSkinnedMesh" in node) this.track(node as unknown as Disposable)
    })
  }

  trackMaterial(material: Material) {
    this.track(material)
    for (const value of Object.values(material)) if (value instanceof Texture) this.track(value)
  }

  /** Adds a listener that is removed on dispose. */
  listen<E extends Event = Event>(target: EventTarget, type: string, handler: (event: E) => void, options?: AddEventListenerOptions) {
    const listener = handler as EventListener
    target.addEventListener(type, listener, options)
    this.cleanups.push(() => target.removeEventListener(type, listener, options))
  }

  onDispose(cleanup: () => void) {
    this.cleanups.push(cleanup)
  }

  /** Makes the renderer and the scene on the first call with a canvas. False when WebGL is not available. */
  ensure(size: Size): boolean {
    if (this.disposed || this.failed) return false
    this.quality = size.quality
    if (!this.renderer) {
      const canvas = size.canvas
      let renderer: WebGLRenderer
      try {
        renderer = new WebGLRenderer({ canvas, antialias: tierOf(size.quality) === "high", alpha: true, powerPreference: "high-performance" })
      } catch (error) {
        this.failed = true
        this.link.stop({ reason: "no-webgl", error: error instanceof Error ? error : undefined })
        return false
      }
      this.renderer = renderer
      this.canvas = canvas
      renderer.toneMapping = this.spec.toneMapping
      renderer.toneMappingExposure = this.spec.exposure ?? 1
      renderer.setClearColor(0x000000, 0)
      this.listen(canvas, "webglcontextlost", (event) => {
        event.preventDefault()
        this.lost = true
        this.link.stop({ reason: "context-lost" })
      })
      this.listen(canvas, "webglcontextrestored", () => {
        this.lost = false
        this.link.set("idle")
        this.spec.restore?.(renderer)
        this.invalidate()
      })
      this.theme = readTheme(canvas)
      const { scene, camera } = this.spec.init(renderer, this.theme, canvas)
      this.scene = scene
      this.camera = camera
      this.applySize(size)
      this.spec.post?.attach(renderer, scene, camera)
      this.spec.post?.setTier(this.tier)
      this.spec.post?.resize(this.width, this.height, this.pixelRatio)
      this.spec.tier?.(this.tier)
    }
    return !this.lost
  }

  resize(size: Size) {
    if (!this.ensure(size)) return
    this.applySize(size)
    this.spec.post?.resize(this.width, this.height, this.pixelRatio)
  }

  private applySize(size: Size) {
    this.width = Math.max(1, size.width)
    this.height = Math.max(1, size.height)
    // The World has already capped the ratio (tier and pixel budget); the renderer takes it as given.
    this.pixelRatio = size.pixelRatio
    if (!this.renderer) return
    this.renderer.setPixelRatio(size.pixelRatio)
    this.renderer.setSize(this.width, this.height, false)
    this.spec.resize?.(this.width, this.height, this.pixelRatio)
  }

  setLevel(level: number) {
    const before = this.tier
    this.level = Math.max(0, level)
    if (this.tier === before) return
    this.spec.post?.setTier(this.tier)
    this.spec.tier?.(this.tier)
    this.invalidate()
  }

  /** One frame: through the post chain when it is active, straight to the screen otherwise. */
  render(time: number, moving: boolean) {
    if (!this.live || !this.renderer || !this.scene || !this.camera) return
    const post = this.spec.post
    if (post?.active) post.render(time, moving)
    else this.renderer.render(this.scene, this.camera)
    this.link.set("ready")
  }

  /** Prewarm: compile every material and upload every texture, each as its own task. */
  compileTask = () => {
    if (this.live && this.renderer && this.scene && this.camera) this.renderer.compile(this.scene, this.camera)
  }

  uploadTask = () => {
    if (!this.live || !this.renderer || !this.scene) return
    const renderer = this.renderer
    this.scene.traverse((node) => {
      const material = (node as Mesh).material
      for (const m of material ? (Array.isArray(material) ? material : [material]) : []) for (const value of Object.values(m)) if (value instanceof Texture && value.image) renderer.initTexture(value)
    })
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    for (const cleanup of this.cleanups.splice(0)) cleanup()
    this.spec.post?.dispose()
    for (const thing of this.bin) thing.dispose()
    this.bin.clear()
    this.renderer?.dispose()
    this.renderer = null
    this.scene = null
    this.camera = null
    this.link.connect(null)
  }
}
