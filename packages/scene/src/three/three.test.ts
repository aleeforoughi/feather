import { afterEach, describe, expect, it, vi } from "vitest"
import { BoxGeometry, CatmullRomCurve3, Color, Group, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, Texture, Vector3 } from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

// The GPU is not in jsdom: WebGLRenderer and the PMREM generator are fakes that record what the scenes ask of them.
const gpu = vi.hoisted(() => {
  const renderers: FakeRenderer[] = []
  const pmrems: { dispose: ReturnType<typeof vi.fn>; target: { texture: unknown; dispose: ReturnType<typeof vi.fn> } }[] = []
  class FakeRenderer {
    params: Record<string, unknown>
    pixelRatio = 1
    width = 0
    height = 0
    toneMapping = 0
    toneMappingExposure = 1
    shadowMap = { enabled: false, type: 1 }
    calls: string[] = []
    constructor(params: Record<string, unknown>) {
      this.params = params
      renderers.push(this)
    }
    setPixelRatio(ratio: number) {
      this.pixelRatio = ratio
    }
    getPixelRatio() {
      return this.pixelRatio
    }
    setSize(width: number, height: number) {
      this.width = width
      this.height = height
    }
    getSize(target: { set(x: number, y: number): unknown }) {
      return target.set(this.width, this.height)
    }
    setClearColor() {}
    scene: { traverse(fn: (node: unknown) => void): void } | null = null
    render(scene: { traverse(fn: (node: unknown) => void): void }) {
      this.calls.push("render")
      this.scene = scene
    }
    compile() {
      this.calls.push("compile")
    }
    initTexture() {
      this.calls.push("initTexture")
    }
    disposed = 0
    dispose() {
      this.disposed++
    }
  }
  return { renderers, pmrems, FakeRenderer }
})

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>()
  class FakePMREM {
    dispose = vi.fn()
    fromScene() {
      const target = { texture: new actual.Texture(), dispose: vi.fn() }
      gpu.pmrems.push({ dispose: this.dispose, target })
      return target
    }
  }
  return { ...actual, WebGLRenderer: gpu.FakeRenderer, PMREMGenerator: FakePMREM }
})

import { attachKeys, contactShadowTexture, fitObject, objectViewer, projectHotspots } from "./object-viewer"
import { cameraRail, railPose, RAIL_COLUMNS } from "./camera-rail"
import { falloff, fitDistance, seeded, settled, smoothDamp, tierOf } from "./maths"
import { PARTICLE_COUNTS, particleCount, particleField, spherePoints, surfacePoints } from "./particle-field"
import { resolvePost, studioPost } from "./post"
import { themeColor, readTheme } from "./theme"

type Quality = "high" | "medium" | "low"
const canvasWithTheme = () => {
  const canvas = document.createElement("canvas")
  canvas.style.setProperty("--background", "#f7f7f5")
  canvas.style.setProperty("--foreground", "#18181b")
  canvas.style.setProperty("--primary", "#18181b")
  canvas.style.setProperty("--accent", "#e4572e")
  canvas.style.setProperty("--block-1", "#2e7d5b")
  canvas.style.setProperty("--block-2", "#3355ff")
  document.body.appendChild(canvas)
  return canvas
}
const sized = (canvas: HTMLCanvasElement, quality: Quality = "high") => ({ canvas, width: 400, height: 300, pixelRatio: 1.5, quality })
let clock = 0
const tick = (canvas: HTMLCanvasElement, quality: Quality = "high", delta = 16) => ({ ...sized(canvas, quality), time: (clock += delta), delta })

afterEach(() => {
  gpu.renderers.length = 0
  gpu.pmrems.length = 0
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})

describe("tiers", () => {
  it("starts at the World's quality and steps down one tier per ladder level", () => {
    expect(tierOf("high")).toBe("high")
    expect(tierOf("high", 1)).toBe("mid")
    expect(tierOf("high", 2)).toBe("low")
    expect(tierOf("medium")).toBe("mid")
    expect(tierOf("medium", 1)).toBe("low")
    expect(tierOf("low")).toBe("low")
    expect(tierOf("high", 9)).toBe("low")
  })
  it("counts 60k, 20k and 6k points, or the caller's", () => {
    expect(PARTICLE_COUNTS).toEqual({ high: 60_000, mid: 20_000, low: 6_000 })
    expect(particleCount("mid")).toBe(20_000)
    expect(particleCount("low", { low: 1500 })).toBe(1500)
  })
})

describe("damping", () => {
  it("approaches the target without overshoot and settles", () => {
    let s = { value: 0, velocity: 0 }
    let last = 0
    for (let i = 0; i < 120; i++) {
      s = smoothDamp(s, 1, 0.2, 1 / 60)
      expect(s.value).toBeGreaterThanOrEqual(last - 1e-12)
      expect(s.value).toBeLessThanOrEqual(1 + 1e-9)
      last = s.value
    }
    expect(settled(s, 1)).toBe(true)
  })
  it("is frame-rate independent: two half steps land where one whole step does", () => {
    const start = { value: 0.2, velocity: 0.5 }
    const whole = smoothDamp(start, 1, 0.2, 1 / 30)
    const halves = smoothDamp(smoothDamp(start, 1, 0.2, 1 / 60), 1, 0.2, 1 / 60)
    expect(halves.value).toBeCloseTo(whole.value, 12)
    expect(halves.velocity).toBeCloseTo(whole.velocity, 12)
  })
  it("uses the pointer field's falloff, 1 - (d/r)²", () => {
    expect(falloff(0, 300)).toBe(1)
    expect(falloff(150, 300)).toBeCloseTo(0.75)
    expect(falloff(300, 300)).toBe(0)
  })
})

describe("fitting", () => {
  it("backs the camera off until the sphere fits the narrower field of view", () => {
    expect(fitDistance(1, 90, 1, 1)).toBeCloseTo(Math.SQRT2)
    // A tall, narrow view: the horizontal field decides, so the camera goes further.
    expect(fitDistance(1, 90, 0.5, 1)).toBeGreaterThan(fitDistance(1, 90, 1, 1))
    expect(fitDistance(2, 30, 16 / 9)).toBeCloseTo((2 * 1.15) / Math.sin(Math.PI / 12))
  })
  it("centres an object and scales it to a unit sphere", () => {
    const holder = new Group()
    const mesh = new Mesh(new BoxGeometry(2, 4, 2))
    mesh.position.set(5, 5, 5)
    holder.add(mesh)
    const fit = fitObject(mesh, holder)
    expect(fit.radius).toBeCloseTo(Math.sqrt(1 + 4 + 1))
    const center = new Vector3()
    mesh.geometry.computeBoundingBox()
    mesh.updateMatrixWorld(true)
    expect(new Vector3().setFromMatrixPosition(mesh.matrixWorld).distanceTo(center)).toBeLessThan(1e-9)
    expect(fit.floor).toBeCloseTo(-2 / fit.radius)
  })
})

describe("hotspots", () => {
  const camera = new PerspectiveCamera(40, 400 / 300, 0.1, 100)
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  const holder = new Group()
  const model = new Object3D()
  holder.add(model)
  holder.updateMatrixWorld(true)

  it("projects model points to CSS pixels and says which face the camera", () => {
    const [front, back, off] = projectHotspots(
      [
        { id: "cap", position: [0, 0, 0.5], label: "Cap" },
        { id: "base", position: [0, 0, -0.5], label: "Base" },
        { id: "far", position: [50, 0, 0], label: "Off screen" },
      ],
      model,
      camera,
      400,
      300,
    )
    expect(front.x).toBeCloseTo(200)
    expect(front.y).toBeCloseTo(150)
    expect(front).toMatchObject({ visible: true, facing: true, label: "Cap" })
    expect(back).toMatchObject({ visible: true, facing: false })
    expect(off.visible).toBe(false)
  })
  it("puts a point above the centre higher on the screen", () => {
    const [up] = projectHotspots([{ id: "up", position: [0, 1, 0], label: "Up" }], model, camera, 400, 300)
    expect(up.y).toBeLessThan(150)
  })
})

describe("theme", () => {
  it("reads the palette from the CSS variables in scope", () => {
    const canvas = canvasWithTheme()
    const theme = readTheme(canvas)
    expect(theme.accent.getHexString()).toBe("e4572e")
    expect(theme.blocks.map((c) => c.getHexString())).toEqual(["2e7d5b", "3355ff"])
    expect(themeColor(theme, "var(--block-2)").getHexString()).toBe("3355ff")
    expect(themeColor(theme, "#00ff00").getHexString()).toBe("00ff00")
  })
  it("stands in neutral colours on a page with no theme", () => {
    const theme = readTheme(document.createElement("canvas"))
    expect(theme.background.getHexString()).toBe("f7f7f5")
    expect(theme.blocks).toEqual([])
  })
})

function product() {
  const group = new Group()
  const body = new MeshStandardMaterial({ name: "body" })
  body.map = new Texture()
  const cap = new MeshStandardMaterial({ name: "cap" })
  group.add(new Mesh(new BoxGeometry(1, 2, 1), body), new Mesh(new BoxGeometry(0.6, 0.3, 0.6), cap))
  group.children[1].position.y = 1.15
  return { group, body, cap }
}

describe("objectViewer", () => {
  it("makes one renderer on the World's canvas with the World's pixel ratio", () => {
    const canvas = canvasWithTheme()
    const viewer = objectViewer({ model: product().group })
    viewer.resize?.(sized(canvas))
    expect(gpu.renderers).toHaveLength(1)
    const [renderer] = gpu.renderers
    expect(renderer.params).toEqual({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" })
    expect(renderer.pixelRatio).toBe(1.5)
    expect([renderer.width, renderer.height]).toEqual([400, 300])
    viewer.dispose?.()
  })
  it("turns antialiasing off below the high tier", () => {
    const viewer = objectViewer({ model: product().group })
    viewer.resize?.(sized(canvasWithTheme(), "medium"))
    expect(gpu.renderers[0].params.antialias).toBe(false)
    viewer.dispose?.()
  })
  it("rests once the camera settles, and keeps going while the turntable spins", async () => {
    const canvas = canvasWithTheme()
    const still = objectViewer({ model: product().group, turntable: 0 })
    still.resize?.(sized(canvas))
    await still.ready
    let moving = true
    for (let i = 0; i < 400 && moving; i++) moving = still.frame(tick(canvas))
    expect(moving).toBe(false)
    still.orbitBy(30, 0)
    expect(still.frame(tick(canvas))).toBe(true)
    still.dispose?.()

    const spinning = objectViewer({ model: product().group, turntable: 12 })
    spinning.resize?.(sized(canvasWithTheme()))
    await spinning.ready
    expect(spinning.frame(tick(canvas))).toBe(true)
    spinning.dispose?.()
  })
  it("swaps a variant's colours on the named materials without loading again", async () => {
    const { group, body, cap } = product()
    const load = vi.spyOn(GLTFLoader.prototype, "loadAsync").mockResolvedValue({ scene: group } as never)
    const canvas = canvasWithTheme()
    const viewer = objectViewer({
      model: "/flask.glb",
      variants: [
        { id: "graphite", label: "Graphite", colors: { body: "--primary", cap: "--accent" } },
        { id: "moss", label: "Moss", colors: { body: "var(--block-1)", cap: "#ffffff" } },
      ],
    })
    viewer.resize?.(sized(canvas))
    await viewer.ready
    expect(body.color.getHexString()).toBe("18181b")
    expect(cap.color.getHexString()).toBe("e4572e")
    const bodyColor = body.color
    viewer.setVariant("moss")
    expect(viewer.variant).toBe("moss")
    expect(body.color).toBe(bodyColor)
    expect(body.color.getHexString()).toBe("2e7d5b")
    expect(cap.color.equals(new Color(1, 1, 1))).toBe(true)
    viewer.setVariant("nope")
    expect(viewer.variant).toBe("moss")
    expect(load).toHaveBeenCalledTimes(1)
    viewer.dispose?.()
  })
  it("reports hotspot positions after a frame, and turns to face one", async () => {
    const canvas = canvasWithTheme()
    const viewer = objectViewer({ model: product().group, turntable: 0, hotspots: [{ id: "cap", position: [0, 1.3, 0], label: "Twist cap" }] })
    const seen: { x: number; y: number }[][] = []
    viewer.onHotspots((h) => seen.push(h))
    viewer.resize?.(sized(canvas))
    await viewer.ready
    viewer.frame(tick(canvas))
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.at(-1)?.[0]).toMatchObject({ id: "cap", label: "Twist cap", visible: true })
    expect(seen.at(-1)?.[0].y).toBeLessThan(150)
    viewer.dispose?.()
  })
  it("prewarms: loads, compiles and uploads as separate tasks", async () => {
    const canvas = canvasWithTheme()
    const viewer = objectViewer({ model: product().group })
    viewer.resize?.(sized(canvas))
    const tasks = viewer.prewarm()
    expect(tasks).toHaveLength(3)
    for (const task of tasks) await task()
    expect(gpu.renderers[0].calls).toContain("compile")
    expect(gpu.renderers[0].calls).toContain("initTexture")
    viewer.dispose?.()
  })
  it("stops cleanly on a lost context and comes back on restore", async () => {
    const canvas = canvasWithTheme()
    const viewer = objectViewer({ model: product().group, turntable: 0 })
    const states: string[] = []
    viewer.subscribe((s) => states.push(s))
    viewer.resize?.(sized(canvas))
    await viewer.ready
    viewer.frame(tick(canvas))
    expect(viewer.state).toBe("ready")
    const lost = new Event("webglcontextlost", { cancelable: true })
    canvas.dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(viewer.state).toBe("lost")
    const renders = gpu.renderers[0].calls.filter((c) => c === "render").length
    expect(viewer.frame(tick(canvas))).toBe(false)
    expect(gpu.renderers[0].calls.filter((c) => c === "render").length).toBe(renders)
    canvas.dispatchEvent(new Event("webglcontextrestored"))
    viewer.frame(tick(canvas))
    expect(viewer.state).toBe("ready")
    expect(gpu.pmrems).toHaveLength(2)
    expect(states).toEqual(["ready", "lost", "idle", "ready"])
    viewer.dispose?.()
  })
  it("frees everything it made, and the renderer, on dispose", async () => {
    const { group, body, cap } = product()
    const geometries = group.children.map((m) => vi.spyOn((m as Mesh).geometry, "dispose"))
    const materials = [vi.spyOn(body, "dispose"), vi.spyOn(cap, "dispose")]
    const texture = vi.spyOn(body.map as Texture, "dispose")
    const canvas = canvasWithTheme()
    const viewer = objectViewer({ model: group })
    viewer.resize?.(sized(canvas))
    await viewer.ready
    viewer.frame(tick(canvas))
    expect(canvas.dataset.cursor).toBe("drag")
    viewer.dispose?.()
    for (const spy of [...geometries, ...materials, texture]) expect(spy).toHaveBeenCalled()
    expect(gpu.renderers[0].disposed).toBe(1)
    expect(gpu.pmrems[0].dispose).toHaveBeenCalled()
    expect(gpu.pmrems[0].target.dispose).toHaveBeenCalled()
    expect(canvas.dataset.cursor).toBeUndefined()
    expect(viewer.frame(tick(canvas))).toBe(false)
  })
  it("makes a soft round contact shadow without a canvas", () => {
    const texture = contactShadowTexture(16)
    const data = texture.image.data as Uint8Array
    const alpha = (x: number, y: number) => data[(y * 16 + x) * 4 + 3]
    expect(alpha(8, 8)).toBeGreaterThan(200)
    expect(alpha(0, 0)).toBe(0)
  })
})

describe("attachKeys", () => {
  it("turns with the arrows, goes to presets with Home and digits, and detaches cleanly", () => {
    const el = document.createElement("div")
    document.body.appendChild(el)
    const viewer = { orbitBy: vi.fn(), view: vi.fn(), presets: [{ id: "front", label: "Front", azimuth: 0, polar: 80 }, { id: "side", label: "Side", azimuth: 90, polar: 80 }] }
    const detach = attachKeys(el, viewer)
    expect(el.tabIndex).toBe(0)
    const press = (key: string) => {
      const event = new KeyboardEvent("keydown", { key, cancelable: true, bubbles: true })
      el.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(press("ArrowRight")).toBe(true)
    expect(viewer.orbitBy).toHaveBeenLastCalledWith(15, 0)
    press("ArrowUp")
    expect(viewer.orbitBy).toHaveBeenLastCalledWith(0, -10)
    press("Home")
    expect(viewer.view).toHaveBeenLastCalledWith("front")
    press("2")
    expect(viewer.view).toHaveBeenLastCalledWith("side")
    expect(press("a")).toBe(false)
    detach()
    expect(el.hasAttribute("tabindex")).toBe(false)
    press("ArrowLeft")
    expect(viewer.orbitBy).toHaveBeenCalledTimes(2)
  })
})

describe("particleField", () => {
  it("draws the tier's count in one Points, and lowers it by draw range on a ladder step", () => {
    const canvas = canvasWithTheme()
    const field = particleField({ mode: "field" })
    field.resize?.(sized(canvas))
    expect(field.count).toBe(60_000)
    field.setLevel(1)
    expect(field.count).toBe(20_000)
    field.setLevel(2)
    expect(field.count).toBe(6_000)
    field.setLevel(0)
    expect(field.count).toBe(60_000)
    field.dispose()
  })
  it("never draws more than it allocated when it started low", () => {
    const field = particleField()
    field.resize?.(sized(canvasWithTheme(), "low"))
    expect(field.count).toBe(6_000)
    field.setLevel(0)
    expect(field.count).toBe(6_000)
    field.dispose()
  })
  it("morphs toward a progress and rests when it arrives with no drift", () => {
    const canvas = canvasWithTheme()
    const field = particleField({ mode: "morph", drift: 0, counts: { high: 500 } })
    field.resize?.(sized(canvas))
    expect(field.frame(tick(canvas))).toBe(false)
    field.setMorph(1)
    let moving = field.frame(tick(canvas))
    expect(moving).toBe(true)
    for (let i = 0; i < 600 && moving; i++) moving = field.frame(tick(canvas))
    expect(moving).toBe(false)
    field.dispose()
  })
  it("samples shapes evenly: a sphere on its surface, a mesh fitted to the unit sphere", () => {
    const sphere = spherePoints(200)
    for (let i = 0; i < 200; i++) expect(Math.hypot(sphere[i * 3], sphere[i * 3 + 1], sphere[i * 3 + 2])).toBeCloseTo(1)
    const box = surfacePoints(new BoxGeometry(4, 2, 2), 300, seeded(3))
    let max = 0
    for (let i = 0; i < 300; i++) max = Math.max(max, Math.hypot(box[i * 3], box[i * 3 + 1], box[i * 3 + 2]))
    expect(max).toBeCloseTo(1)
  })
})

describe("cameraRail", () => {
  it("eases toward the progress it is given, then rests exactly there", () => {
    const canvas = canvasWithTheme()
    const rail = cameraRail()
    rail.resize?.(sized(canvas))
    expect(rail.frame(tick(canvas))).toBe(false)
    rail.setProgress(0.5)
    let last = rail.progress
    let moving = true
    let frames = 0
    while (moving && frames < 600) {
      moving = rail.frame(tick(canvas))
      expect(rail.progress).toBeGreaterThanOrEqual(last)
      last = rail.progress
      frames++
    }
    expect(rail.progress).toBe(0.5)
    // Damping 0.2: well under a second of frames to arrive.
    expect(frames).toBeLessThan(90)
    rail.setProgress(7)
    rail.frame(tick(canvas))
    expect(rail.progress).toBeLessThanOrEqual(1)
    rail.dispose()
  })
  it("frees the caller's scene and runs its cleanup on dispose", () => {
    const canvas = canvasWithTheme()
    const built = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    const geometry = vi.spyOn(built.geometry, "dispose")
    const cleanup = vi.fn()
    const own = cameraRail({
      build(scene) {
        scene.add(built)
        return cleanup
      },
    })
    own.resize?.(sized(canvas))
    own.dispose()
    expect(geometry).toHaveBeenCalled()
    expect(cleanup).toHaveBeenCalled()
  })
  it("thins the default corridor's columns on a ladder step", () => {
    const canvas = canvasWithTheme()
    const rail = cameraRail()
    rail.resize?.(sized(canvas))
    const columns = () => {
      let most = 0
      gpu.renderers[0].scene?.traverse((node) => {
        const mesh = node as { isInstancedMesh?: boolean; count: number }
        if (mesh.isInstancedMesh) most = Math.max(most, mesh.count)
      })
      return most
    }
    rail.frame(tick(canvas))
    expect(columns()).toBe(RAIL_COLUMNS.high)
    rail.setLevel(2)
    rail.frame(tick(canvas))
    expect(columns()).toBe(RAIL_COLUMNS.low)
    rail.dispose()
  })
  it("compiles its shaders in prewarm", () => {
    const canvas = canvasWithTheme()
    const rail = cameraRail()
    rail.resize?.(sized(canvas))
    for (const task of rail.prewarm()) task()
    expect(gpu.renderers[0].calls).toContain("compile")
    rail.dispose()
  })
  it("poses the camera from the curve: looking ahead along it, or at a fixed target", () => {
    const path = new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(0, 0, -10)])
    const start = railPose(path, null, 0)
    expect(start.position.z).toBeCloseTo(0)
    expect(start.target.z).toBeLessThan(0)
    const fixed = railPose(path, new Vector3(5, 0, 0), 1)
    expect(fixed.position.z).toBeCloseTo(-10)
    expect(fixed.target.x).toBe(5)
  })
})

describe("studioPost", () => {
  it("holds every option inside its range", () => {
    expect(resolvePost({ bloom: { intensity: 9, threshold: 0.1, radius: 3 }, grain: 1, vignette: -1 })).toEqual({ bloom: { intensity: 2, threshold: 0.8, radius: 1 }, grain: 0.08, vignette: 0 })
    expect(resolvePost({ bloom: false }).bloom).toBeNull()
  })
  it("runs on the high and mid tiers, is off on the low tier, and frees its targets", () => {
    const post = studioPost()
    const canvas = canvasWithTheme()
    const field = particleField({ counts: { high: 100, mid: 100, low: 100 }, post })
    field.resize?.(sized(canvas))
    expect(post.active).toBe(true)
    field.setLevel(1)
    expect(post.active).toBe(true)
    field.setLevel(2)
    expect(post.active).toBe(false)
    field.frame(tick(canvas))
    expect(gpu.renderers[0].calls).toContain("render")
    field.setLevel(0)
    expect(post.active).toBe(true)
    field.dispose()
    expect(post.active).toBe(false)
  })
})
