// shaderBackground: a full-screen shader field as a World renderer, on raw WebGL (WebGL2, else WebGL1), no
// dependency. One triangle, one program per preset compiled once, drawn at the World's capped pixel ratio times a
// resolution share, in the brand's colours. Values from the award catalog (Qooler file 27, section 4 D: one
// full-screen triangle, fbm over 3 to 5 palette stops, 0.5 to 1.0 resolution, mediump); the code is Feather's own.

import type { FrameTask, WorldFrame } from "@aleeforoughi/feather-expression/core"
import { createProgram, fullScreenTriangle, FULLSCREEN_VERTEX, uniforms, type FullScreenTriangle, type GL, type Uniforms } from "../shared/gl"
import { paletteUniform, resolvePalette } from "../shared/palette"
import { damp, trackPointer, type PointerTrack } from "../shared/pointer"
import { clampOption, sceneLink, type SceneHooks, type SceneRenderer } from "../shared/scene"
import { createSurface } from "../shared/surface"
import { createFlowmap, type Flowmap } from "./flowmap"
import { AURORA, FLOW, GRADIENT_NOISE, GRAIN_FIELD } from "./shaders"

export type ShaderPreset = "gradient-noise" | "aurora" | "grain-field" | "flow"

export const SHADER_PRESETS: readonly ShaderPreset[] = ["gradient-noise", "aurora", "grain-field", "flow"]

export interface ShaderBackgroundOptions extends SceneHooks {
  /** gradient-noise (default): fbm flowing over the palette. aurora: soft layered ribbons. grain-field: a quiet
   * stepped grain over a two-colour ground. flow: the gradient bent by a pointer flowmap (drifting on touch). */
  preset?: ShaderPreset
  /** CSS colours, ground first (3 to 5 read best; grain-field uses the first two). Default: the theme's
   * --background, --primary, --accent and the brand's --block-N, read where the canvas is, when the scene starts. */
  palette?: readonly string[]
  /** 0 to 2 (default 1). 0 draws once and rests. */
  speed?: number
  /** The size of the field's features: above 1 finer, below 1 broader (0.25 to 4, default 1). */
  scale?: number
  /** How far the field departs from the ground colour, or how much grain (0 to 1, default 0.7). */
  intensity?: number
  /** The share of the World's pixel ratio the field draws at (0.5 to 1, default 0.75): a soft field loses nothing. */
  resolution?: number
}

export interface ShaderBackground extends SceneRenderer {
  readonly preset: ShaderPreset
  /** Changes the look without recompiling; the next frame shows it. */
  update(options: Pick<ShaderBackgroundOptions, "palette" | "speed" | "scale" | "intensity">): void
}

/** What each quality level keeps (0 the richest): its share of the resolution, and the noise octaves per preset. */
export const SHADER_LEVELS = {
  share: [1, 0.75, 0.55],
  octaves: { "gradient-noise": [5, 4, 3], aurora: [4, 3, 2], "grain-field": [3, 2, 1], flow: [4, 3, 2] } as Record<ShaderPreset, readonly number[]>,
  bands: [3, 3, 2],
  flowmap: [128, 96, 64],
} as const

/** One loop of the field at speed 1, in seconds; every motion term is a whole multiple of it, so it never seams. */
export const LOOP_SECONDS = 72
/** The grain-field's step rate (film flickers at 8 to 12 a second). */
export const GRAIN_FPS = 10
/** How long the flow keeps drawing after the pointer stops, in seconds (until its trail has faded). */
const FLOW_SETTLE = 2.5
/** Pointer speed (uv a second) to the velocity a frame splats: a brisk sweep across the hero reaches about a quarter. */
const FLOW_GAIN = 0.06

const FRAGMENT: Record<ShaderPreset, string> = { "gradient-noise": GRADIENT_NOISE, aurora: AURORA, "grain-field": GRAIN_FIELD, flow: FLOW }

interface Resources {
  gl: GL
  program: WebGLProgram
  u: Uniforms
  triangle: FullScreenTriangle
  flow: Flowmap | null
}

export function shaderBackground(options: ShaderBackgroundOptions = {}): ShaderBackground {
  const preset: ShaderPreset = options.preset && SHADER_PRESETS.includes(options.preset) ? options.preset : "gradient-noise"
  const resolution = clampOption(options.resolution, 0.5, 1, 0.75)
  let speed = clampOption(options.speed, 0, 2, 1)
  let scale = clampOption(options.scale, 0.25, 4, 1)
  let intensity = clampOption(options.intensity, 0, 1, 0.7)
  let colors = options.palette
  let paletteDirty = true

  const link = sceneLink(options)
  let res: Resources | null = null
  let level = 0
  let elapsed = 0
  let wall = 0
  let lastStep = -1
  let dirty = true
  let pointer: PointerTrack | null = null
  const flowState = { point: [0.5, 0.5] as [number, number], prev: null as [number, number] | null, quiet: Infinity }

  const surface = createSurface({
    onLost() {
      // Every GL object died with the context: forget them (deleting would be a no-op) and stop.
      res = null
      link.stop({ reason: "context-lost" })
    },
    onRestored() {
      link.set("idle")
      dirty = paletteDirty = true
      link.invalidate()
    },
  })

  const release = () => {
    const gl = surface.gl
    if (res && gl && !surface.lost) {
      res.flow?.dispose()
      res.triangle.dispose()
      gl.deleteProgram(res.program)
    }
    res = null
  }

  /** Binds the canvas the World hands over (cheap: the context, no compiling). */
  const bind = (canvas: HTMLCanvasElement): GL | null => {
    if (link.state === "failed") return null
    if (surface.canvas !== canvas) {
      release()
      const gl = surface.attach(canvas)
      if (!gl && !surface.lost) {
        link.stop({ reason: "no-webgl" })
        return null
      }
      if (preset === "flow" && !pointer) pointer = trackPointer(() => link.invalidate())
    }
    return surface.lost ? null : surface.gl
  }

  /** The program and its buffers, built once per context. */
  const ensure = (canvas: HTMLCanvasElement): Resources | null => {
    const gl = bind(canvas)
    if (!gl) return null
    if (res) return res
    try {
      const program = createProgram(gl, FULLSCREEN_VERTEX, FRAGMENT[preset], preset)
      const triangle = fullScreenTriangle(gl)
      const flow = preset === "flow" ? createFlowmap(gl, SHADER_LEVELS.flowmap[level], triangle) : null
      res = { gl, program, u: uniforms(gl, program), triangle, flow }
    } catch (error) {
      link.stop({ reason: "shader", error: error instanceof Error ? error : new Error(String(error)) })
      return null
    }
    dirty = paletteDirty = true
    link.set("ready")
    return res
  }

  const fit = (frame: Pick<WorldFrame, "width" | "height" | "pixelRatio">) => {
    const ratio = frame.pixelRatio * resolution * SHADER_LEVELS.share[level]
    if (surface.fit(frame.width * ratio, frame.height * ratio)) dirty = true
  }

  const uploadPalette = (r: Resources) => {
    const palette = resolvePalette(colors, surface.canvas, 5)
    r.u.vec3s("u_rgb", paletteUniform(palette, 5, "linear"))
    r.u.vec3s("u_lab", paletteUniform(palette, 5, "oklab"))
    r.u.float("u_stops", Math.min(5, Math.max(2, palette.length)))
    paletteDirty = false
  }

  /** Moves the flowmap one frame; true while it still has something to show. */
  const stepFlow = (r: Resources, canvas: HTMLCanvasElement, deltaMs: number): boolean => {
    if (!r.flow || !pointer) return false
    const dt = Math.max(deltaMs, 1) / 1000
    let target: [number, number] | null = null
    if (pointer.fine) {
      if (pointer.active) target = pointer.uv(canvas.getBoundingClientRect())
    } else if (speed > 0) {
      // Touch has no hover: the point drifts on its own, a slow figure that never repeats exactly.
      target = [0.5 + 0.3 * Math.sin(wall * 0.41), 0.5 + 0.22 * Math.sin(wall * 0.27 + 1.3)]
    }
    let velocity: [number, number] = [0, 0]
    if (target) {
      const s = flowState.point
      s[0] = damp(s[0], target[0], 0.3, deltaMs)
      s[1] = damp(s[1], target[1], 0.3, deltaMs)
      if (flowState.prev) {
        const v = (d: number) => Math.max(-1, Math.min(1, (d / dt) * FLOW_GAIN))
        velocity = [v(s[0] - flowState.prev[0]), v(s[1] - flowState.prev[1])]
      }
      flowState.prev = [s[0], s[1]]
    } else flowState.prev = null
    const moving = Math.hypot(velocity[0], velocity[1]) > 1e-4
    flowState.quiet = moving ? 0 : flowState.quiet + dt
    if (flowState.quiet > FLOW_SETTLE) return false
    const aspect = canvas.width / Math.max(1, canvas.height)
    r.flow.step({ point: flowState.point, velocity, aspect })
    return true
  }

  const draw = (r: Resources, canvas: HTMLCanvasElement) => {
    const { gl, u } = r
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(r.program)
    if (paletteDirty) uploadPalette(r)
    const theta = ((elapsed % LOOP_SECONDS) / LOOP_SECONDS) * Math.PI * 2
    u.vec2("u_resolution", canvas.width, canvas.height)
    u.vec4("u_loop", Math.cos(theta), Math.sin(theta), Math.cos(2 * theta), Math.sin(2 * theta))
    u.vec4("u_loop2", Math.cos(3 * theta), Math.sin(3 * theta), Math.cos(5 * theta), Math.sin(5 * theta))
    u.float("u_scale", scale)
    u.float("u_intensity", intensity)
    u.float("u_octaves", SHADER_LEVELS.octaves[preset][level])
    if (preset === "aurora") u.float("u_bands", SHADER_LEVELS.bands[level])
    if (preset === "grain-field") u.float("u_seed", lastStep % 61)
    if (r.flow) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, r.flow.texture)
      u.int("u_flow", 0)
    }
    r.triangle.draw()
    dirty = false
  }

  const renderer: ShaderBackground = {
    preset,
    levels: SHADER_LEVELS.share.length,
    get state() {
      return link.state
    },
    /** The World keeps its still up until this is true (docs/scene.md). */
    get drawn() {
      return (link.state) === "ready"
    },
    subscribe: link.subscribe,
    connect: link.connect,
    resize(frame) {
      if (!bind(frame.canvas)) return
      fit(frame)
      dirty = true
    },
    frame(frame) {
      const r = ensure(frame.canvas)
      if (!r) return false
      fit(frame)
      if (r.flow && r.flow.size !== SHADER_LEVELS.flowmap[level]) r.flow.resize(SHADER_LEVELS.flowmap[level])
      const dt = frame.delta / 1000
      if (speed > 0) {
        elapsed += dt * speed
        wall += dt
      }
      let paint = dirty
      if (preset === "grain-field") {
        const step = Math.floor(wall * GRAIN_FPS)
        if (step !== lastStep) {
          lastStep = step
          paint = true
        }
      } else if (speed > 0) paint = true
      const flowing = stepFlow(r, frame.canvas, frame.delta)
      if (flowing) paint = true
      if (paint) draw(r, frame.canvas)
      return speed > 0 || flowing
    },
    setLevel(next) {
      const l = Math.min(SHADER_LEVELS.share.length - 1, Math.max(0, Math.round(next)))
      if (l === level) return
      level = l
      dirty = true
    },
    prewarm(): FrameTask[] {
      return [() => void (surface.canvas && ensure(surface.canvas))]
    },
    update(next) {
      if (next.palette !== undefined) {
        colors = next.palette
        paletteDirty = true
      }
      if (next.speed !== undefined) speed = clampOption(next.speed, 0, 2, speed)
      if (next.scale !== undefined) scale = clampOption(next.scale, 0.25, 4, scale)
      if (next.intensity !== undefined) intensity = clampOption(next.intensity, 0, 1, intensity)
      dirty = true
      link.invalidate()
    },
    dispose() {
      release()
      surface.detach()
      pointer?.dispose()
      pointer = null
      flowState.prev = null
      flowState.quiet = Infinity
      if (link.state === "ready") link.set("idle")
      dirty = paletteDirty = true
    },
  }
  return renderer
}
