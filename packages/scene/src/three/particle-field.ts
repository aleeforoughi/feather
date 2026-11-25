// particleField: one THREE.Points, one draw call (Qooler file 27 §4 C15, C18, C19). Three modes: ambient dust drifting
// in a volume, a field that yields to the pointer (falloff 1 - (d/r)², the DOM PointerField's law), or points that
// morph between two shapes sampled from geometry (a sphere and a torus by default, or any mesh or GLB through
// MeshSurfaceSampler). The count follows the tier (high 60k, mid 20k, low 6k) by draw range, so a ladder step never
// rebuilds anything. Size and the three-stop colour ramp come from the theme; shaders are mediump.
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  Plane,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
  type Object3D,
} from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js"
import type { FrameTask } from "@aleeforoughi/feather-expression/core"
import type { SceneHooks, SceneRenderer } from "../shared/scene"
import { ThreeHost } from "./host"
import { clamp, seeded, smoothDamp, settled, type Spring, type Tier } from "./maths"
import type { StudioPost } from "./post"
import { themeColor, type Theme } from "./theme"

export type ParticleMode = "dust" | "field" | "morph"
/** A morph target: a named primitive, a geometry, a mesh tree, or a GLB URL. */
export type ShapeSource = "sphere" | "torus" | BufferGeometry | Object3D | string

/** Points per tier (high 60k, mid 20k, low 6k). */
export const PARTICLE_COUNTS: Record<Tier, number> = { high: 60_000, mid: 20_000, low: 6_000 }

export interface ParticleFieldOptions extends SceneHooks {
  mode?: ParticleMode
  /** Overrides the count per tier. */
  counts?: Partial<Record<Tier, number>>
  /** Point size in CSS pixels at the field's depth (default 1.4 for dust and the field, 2 for a morph). */
  size?: number
  /** The colour ramp, three stops: theme variables or CSS colours (default `--primary`, `--accent`, `--block-1`). */
  colors?: [string, string, string]
  /** Opacity of each point (default 0.55 for dust, 0.75 otherwise). */
  opacity?: number
  /** Drift speed, 0 for none (default 1 for dust, 0.35 otherwise). */
  drift?: number
  /** Whether points yield to the pointer (default true in "field" mode). */
  pointer?: boolean
  /** The pointer's reach as a share of the view's height (default 0.22). */
  radius?: number
  /** Morph shapes (default a sphere to a torus). */
  morph?: { from?: ShapeSource; to?: ShapeSource }
  /** Seconds the morph takes to settle on a new progress (default 0.6). */
  morphDamping?: number
  /** Random seed: the same points on every visit (default 7). */
  seed?: number
  post?: StudioPost
}

export interface ParticleField extends SceneRenderer {
  readonly levels: 3
  /** Morph progress, 0 (the first shape) to 1 (the second); eased toward. */
  setMorph(progress: number): void
  /** How many points draw right now. */
  readonly count: number
}

/** The count a tier draws, given overrides. */
export function particleCount(tier: Tier, counts: Partial<Record<Tier, number>> = {}): number {
  return Math.max(0, Math.floor(counts[tier] ?? PARTICLE_COUNTS[tier]))
}

/** Evenly spread points on a unit sphere (a Fibonacci lattice): deterministic, no clumps. */
export function spherePoints(count: number, out: Float32Array = new Float32Array(count * 3)): Float32Array {
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) / count) * 2
    const r = Math.sqrt(1 - y * y)
    out[i * 3] = Math.cos(golden * i) * r
    out[i * 3 + 1] = y
    out[i * 3 + 2] = Math.sin(golden * i) * r
  }
  return out
}

/** Points sampled evenly over the surfaces of every mesh in a tree (weighted by area), fitted to a unit sphere. */
export function surfacePoints(source: Object3D | BufferGeometry, count: number, random: () => number, out: Float32Array = new Float32Array(count * 3)): Float32Array {
  const meshes: Mesh[] = []
  let temporary: Mesh | null = null
  if ((source as BufferGeometry).isBufferGeometry) meshes.push((temporary = new Mesh(source as BufferGeometry)))
  else {
    ;(source as Object3D).updateMatrixWorld(true)
    ;(source as Object3D).traverse((node) => {
      if ((node as Mesh).isMesh) meshes.push(node as Mesh)
    })
  }
  if (meshes.length === 0 || count === 0) return out
  const areas = meshes.map((m) => surfaceArea(m.geometry))
  const total = areas.reduce((a, b) => a + b, 0) || 1
  const p = new Vector3()
  let written = 0
  meshes.forEach((mesh, index) => {
    const share = index === meshes.length - 1 ? count - written : Math.round((areas[index] / total) * count)
    if (share <= 0) return
    const sampler = new MeshSurfaceSampler(mesh) as MeshSurfaceSampler & { setRandomGenerator(fn: () => number): MeshSurfaceSampler }
    sampler.setRandomGenerator(random)
    sampler.build()
    for (let i = 0; i < share && written < count; i++, written++) {
      sampler.sample(p)
      p.applyMatrix4(mesh.matrixWorld)
      out[written * 3] = p.x
      out[written * 3 + 1] = p.y
      out[written * 3 + 2] = p.z
    }
  })
  ;(temporary?.material as { dispose?(): void } | undefined)?.dispose?.()
  return normalise(out, written)
}

function surfaceArea(geometry: BufferGeometry): number {
  const pos = geometry.getAttribute("position")
  if (!pos) return 0
  const index = geometry.getIndex()
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const triangles = index ? index.count / 3 : pos.count / 3
  let area = 0
  for (let t = 0; t < triangles; t++) {
    const [i, j, k] = index ? [index.getX(t * 3), index.getX(t * 3 + 1), index.getX(t * 3 + 2)] : [t * 3, t * 3 + 1, t * 3 + 2]
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, j)
    c.fromBufferAttribute(pos, k)
    area += b.sub(a).cross(c.sub(a)).length() / 2
  }
  return area
}

/** Centres points and scales them to fit a unit sphere. */
function normalise(points: Float32Array, count: number): Float32Array {
  if (count === 0) return points
  const center = new Vector3()
  for (let i = 0; i < count; i++) center.set(center.x + points[i * 3], center.y + points[i * 3 + 1], center.z + points[i * 3 + 2])
  center.divideScalar(count)
  let radius = 0
  for (let i = 0; i < count; i++) {
    points[i * 3] -= center.x
    points[i * 3 + 1] -= center.y
    points[i * 3 + 2] -= center.z
    radius = Math.max(radius, Math.hypot(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]))
  }
  if (radius > 0) for (let i = 0; i < count * 3; i++) points[i] /= radius
  return points
}

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uDrift;
  uniform float uRadius;
  uniform float uStrength;
  uniform vec3 uPointer;
  attribute vec3 aTarget;
  attribute float aSeed;
  varying float vSeed;
  varying float vNear;
  void main() {
    // Each point starts its morph a little later than the last, so the shape pours rather than snaps.
    float t = clamp(uProgress * 1.25 - aSeed * 0.25, 0.0, 1.0);
    vec3 p = mix(position, aTarget, t * t * (3.0 - 2.0 * t));
    float d = uTime * uDrift;
    p += vec3(sin(d * 0.61 + aSeed * 31.0), cos(d * 0.53 + aSeed * 17.0), sin(d * 0.47 + aSeed * 7.0)) * 0.035;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vec3 away = world.xyz - uPointer;
    float dist = length(away);
    float push = uStrength * max(0.0, 1.0 - (dist * dist) / (uRadius * uRadius));
    world.xyz += (dist > 0.0001 ? away / dist : vec3(0.0)) * push * uRadius * 0.45;
    vec4 view = viewMatrix * world;
    gl_PointSize = uSize * uPixelRatio * (0.55 + aSeed * 0.9) * (5.0 / -view.z);
    gl_Position = projectionMatrix * view;
    vSeed = aSeed;
    // Far points fade, so a volume reads as depth rather than noise.
    vNear = smoothstep(9.0, 3.5, -view.z);
  }`

const FRAGMENT = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uOpacity;
  varying float vSeed;
  varying float vNear;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    vec3 color = vSeed < 0.5 ? mix(uColorA, uColorB, vSeed * 2.0) : mix(uColorB, uColorC, vSeed * 2.0 - 1.0);
    gl_FragColor = vec4(color, smoothstep(0.5, 0.15, r) * uOpacity * mix(0.2, 1.0, vNear));
    #include <colorspace_fragment>
  }`

/** A field of points as a World renderer. */
export function particleField(options: ParticleFieldOptions = {}): ParticleField {
  const mode = options.mode ?? "dust"
  const random = seeded(options.seed ?? 7)
  const usePointer = options.pointer ?? mode === "field"
  const drift = options.drift ?? (mode === "dust" ? 1 : 0.35)
  const morphDamping = options.morphDamping ?? 0.6
  let capacity = 0
  let drawn = 0
  let geometry: BufferGeometry | null = null
  let material: ShaderMaterial | null = null
  let points: Points | null = null
  let camera: PerspectiveCamera | null = null
  let progress: Spring = { value: 0, velocity: 0 }
  let progressTarget = 0
  let strength: Spring = { value: 0, velocity: 0 }
  let strengthTarget = 0
  const pointer = new Vector3(0, 0, 1e3)
  const raycaster = new Raycaster()
  const plane = new Plane(new Vector3(0, 0, 1), 0)
  const ndc = new Vector2()
  let halfHeight = 1
  let halfWidth = 1

  const fillShape = (attribute: BufferAttribute, source: ShapeSource) => {
    const array = attribute.array as Float32Array
    if (source === "sphere") spherePoints(capacity, array)
    else if (source === "torus") {
      const torus = new TorusGeometry(1, 0.38, 48, 160)
      surfacePoints(torus, capacity, random, array)
      torus.dispose()
    } else if (typeof source === "string") {
      new GLTFLoader().loadAsync(source).then(
        (gltf) => {
          if (host.disposed) return
          surfacePoints(gltf.scene, capacity, random, array)
          attribute.needsUpdate = true
          host.trackObject(gltf.scene)
          host.invalidate()
        },
        (error: unknown) => host.stop({ reason: "asset", error: error instanceof Error ? error : undefined }),
      )
      return
    } else surfacePoints(source, capacity, random, array)
    attribute.needsUpdate = true
  }

  const build = (tier: Tier, theme: Theme) => {
    capacity = particleCount(tier, options.counts)
    drawn = capacity
    geometry = host.track(new BufferGeometry())
    const position = new BufferAttribute(new Float32Array(capacity * 3), 3)
    const target = new BufferAttribute(new Float32Array(capacity * 3), 3)
    const seeds = new Float32Array(capacity)
    for (let i = 0; i < capacity; i++) seeds[i] = random()
    if (mode === "morph") {
      fillShape(position, options.morph?.from ?? "sphere")
      fillShape(target, options.morph?.to ?? "torus")
    } else if (mode === "field") {
      // A jittered sheet that fills the view (scaled to it in resize), with a little depth.
      const side = Math.ceil(Math.sqrt(capacity))
      for (let i = 0; i < capacity; i++) {
        const x = ((i % side) + random()) / side
        const y = (Math.floor(i / side) + random()) / side
        position.setXYZ(i, x * 2 - 1, y * 2 - 1, (random() - 0.5) * 0.3)
      }
      target.copy(position)
    } else {
      // Dust fills a deep volume, from just in front of the field to well behind it.
      for (let i = 0; i < capacity; i++) position.setXYZ(i, random() * 2 - 1, random() * 2 - 1, 1.5 - random() * 4.5)
      target.copy(position)
    }
    geometry.setAttribute("position", position)
    geometry.setAttribute("aTarget", target)
    geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1))
    const [a, b, c] = options.colors ?? ["--primary", "--accent", theme.blocks[0] ? "--block-1" : "--foreground"]
    const scope = host.canvas
    material = host.track(
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uProgress: { value: 0 },
          uSize: { value: options.size ?? (mode === "morph" ? 2 : 1.4) },
          uPixelRatio: { value: 1 },
          uDrift: { value: drift },
          uRadius: { value: 1 },
          uStrength: { value: 0 },
          uPointer: { value: pointer },
          uOpacity: { value: clamp(options.opacity ?? (mode === "dust" ? 0.55 : 0.75), 0, 1) },
          uColorA: { value: themeColor(theme, a, scope) },
          uColorB: { value: themeColor(theme, b, scope) },
          uColorC: { value: themeColor(theme, c, scope) },
        },
      }),
    )
    material.precision = "mediump"
    points = new Points(geometry, material)
    points.frustumCulled = false
    // A morph leans back a little, so a ring reads as a ring in depth rather than a flat disc.
    if (mode === "morph") points.rotation.set(-0.45, 0.25, 0)
  }

  const host = new ThreeHost({
    hooks: options,
    // Brand colours exactly as the theme gives them: no tone curve on flat points.
    toneMapping: NoToneMapping,
    post: options.post,
    init(_renderer, theme, canvas) {
      const scene = new Scene()
      camera = new PerspectiveCamera(35, 1, 0.1, 50)
      camera.position.set(0, 0, 5)
      build(host.tier, theme)
      if (points) scene.add(points)
      if (usePointer) {
        host.listen<PointerEvent>(canvas, "pointermove", (e) => {
          const rect = canvas.getBoundingClientRect()
          if (!camera || rect.width === 0) return
          ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
          raycaster.setFromCamera(ndc, camera)
          raycaster.ray.intersectPlane(plane, pointer)
          strengthTarget = 1
          host.invalidate()
        })
        host.listen(canvas, "pointerleave", () => {
          strengthTarget = 0
          host.invalidate()
        })
      }
      return { scene, camera }
    },
    resize(width, height, pixelRatio) {
      if (!camera || !points || !material) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      halfHeight = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z
      halfWidth = halfHeight * camera.aspect
      if (mode === "morph") points.scale.setScalar(Math.min(halfWidth, halfHeight) * 0.72)
      else points.scale.set(halfWidth * 1.08, halfHeight * 1.08, 1)
      material.uniforms.uPixelRatio.value = pixelRatio
      material.uniforms.uRadius.value = halfHeight * 2 * clamp(options.radius ?? 0.22, 0.02, 1)
    },
    tier(tier) {
      drawn = Math.min(capacity, particleCount(tier, options.counts))
      geometry?.setDrawRange(0, drawn)
    },
  })

  return {
    levels: 3,
    get count() {
      return drawn
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
    setMorph(p) {
      progressTarget = clamp(p, 0, 1)
      host.invalidate()
    },
    resize: (frame) => host.resize(frame),
    setLevel: (level) => host.setLevel(level),
    frame(frame) {
      if (!host.ensure(frame) || !material) return false
      const delta = Math.min(frame.delta, 50) / 1000
      const time = frame.time / 1000
      progress = smoothDamp(progress, progressTarget, morphDamping, delta)
      strength = smoothDamp(strength, strengthTarget, 0.3, delta)
      material.uniforms.uTime.value = time
      material.uniforms.uProgress.value = progress.value
      material.uniforms.uStrength.value = Math.max(0, strength.value)
      const moving = drift > 0 || !settled(progress, progressTarget) || !settled(strength, strengthTarget)
      host.render(time, moving)
      return moving
    },
    prewarm(): FrameTask[] {
      return [host.compileTask]
    },
    dispose() {
      host.dispose()
      geometry = null
      material = null
      points = null
      camera = null
    },
  }
}

