// depthImage: a photo and its depth map as a World renderer. Each pixel's uv shifts by its depth against a focus
// depth, times the pointer (or the device's tilt once the person turns motion on, else a slow idle drift), so the
// picture gains a little real parallax. The depth map is made offline by the caller (Qooler's media pipeline); this
// renderer never estimates depth. Values from the award catalog (Qooler file 27, section 4 I: uv offset by depth ×
// pointer, strength, focal depth, smoothing); the code is Feather's own.

import type { FrameTask } from "@aleeforoughi/feather-expression/core"
import { createProgram, createTexture, fullScreenTriangle, FULLSCREEN_VERTEX, uniforms, type FullScreenTriangle, type GL, type Uniforms } from "../shared/gl"
import { damp, trackPointer, type PointerTrack } from "../shared/pointer"
import { clampOption, sceneLink, type SceneHooks, type SceneRenderer } from "../shared/scene"
import { createSurface } from "../shared/surface"
import { DEPTH } from "./shaders"

export interface DepthImageOptions extends SceneHooks {
  /** The photo. */
  image: string
  /** Its depth map, the same size: white near, black far (unless `invert`). Soften its edges when you make it. */
  depth: string
  /** 0 to 1 (default 0.4): at 0.4 the nearest and farthest depths part by about 2% of the width. */
  strength?: number
  /** The depth that stays still, 0 far to 1 near (default 0.5). */
  focus?: number
  /** A depth map where white is far. */
  invert?: boolean
  /** The share of the World's pixel ratio it draws at (0.5 to 1, default 1: a photo keeps its detail). */
  resolution?: number
  /** For images on another origin (default "anonymous"; the server must allow it). */
  crossOrigin?: "anonymous" | "use-credentials"
}

export interface DepthImage extends SceneRenderer {
  /** Follows the device's tilt instead of drifting. Call it from the person's own gesture (a motion toggle): iOS asks
   * for permission then. Resolves false when tilt is refused or missing. */
  enableTilt(): Promise<boolean>
  disableTilt(): void
}

/** The largest texture a scene uploads (the catalog's GPU budget, section 6); larger photos are scaled down first. */
export const MAX_TEXTURE = 2048
/** The share of the width the full depth range parts by, per unit of strength (0.4 → 2%). */
const SHIFT_PER_STRENGTH = 0.05

/** What each quality level keeps: its share of the resolution and the refinement steps per pixel. */
export const DEPTH_LEVELS = { share: [1, 0.8, 0.65], steps: [5, 3, 1] } as const

interface Resources {
  gl: GL
  program: WebGLProgram
  u: Uniforms
  triangle: FullScreenTriangle
  image: WebGLTexture | null
  depth: WebGLTexture | null
}

type Source = HTMLImageElement | HTMLCanvasElement

interface Tilt {
  listener: (e: DeviceOrientationEvent) => void
  /** The first reading: the lean is measured from how the person held the device. */
  base: [number, number] | null
  x: number
  y: number
}

/** An image element ready to upload, at most MAX_TEXTURE on its long side. */
function loadImage(src: string, crossOrigin: string): Promise<{ source: Source; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = crossOrigin
    img.decoding = "async"
    img.onload = () => {
      const width = img.naturalWidth || img.width
      const height = img.naturalHeight || img.height
      const long = Math.max(width, height)
      if (long <= MAX_TEXTURE) return resolve({ source: img, width, height })
      const k = MAX_TEXTURE / long
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(width * k)
      canvas.height = Math.round(height * k)
      const ctx = canvas.getContext("2d")
      if (!ctx) return resolve({ source: img, width, height })
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve({ source: canvas, width: canvas.width, height: canvas.height })
    }
    img.onerror = () => reject(new Error(`feather-scene: the depth image could not load ${src.slice(0, 80)}`))
    img.src = src
  })
}

export function depthImage(options: DepthImageOptions): DepthImage {
  const strength = clampOption(options.strength, 0, 1, 0.4)
  const focus = clampOption(options.focus, 0, 1, 0.5)
  const resolution = clampOption(options.resolution, 0.5, 1, 1)
  const link = sceneLink(options)
  let res: Resources | null = null
  let level = 0
  let dirty = true
  let wall = 0
  let pointer: PointerTrack | null = null
  let images: { image: Awaited<ReturnType<typeof loadImage>>; depth: Awaited<ReturnType<typeof loadImage>> } | null = null
  let loading: Promise<void> | null = null
  const view = { x: 0, y: 0 }
  let tilt: Tilt | null = null

  const surface = createSurface({
    onLost() {
      res = null
      link.stop({ reason: "context-lost" })
    },
    onRestored() {
      link.set("idle")
      dirty = true
      link.invalidate()
    },
  })

  const load = (): Promise<void> => {
    loading ??= Promise.all([loadImage(options.image, options.crossOrigin ?? "anonymous"), loadImage(options.depth, options.crossOrigin ?? "anonymous")]).then(
      ([image, depth]) => {
        images = { image, depth }
        dirty = true
        link.invalidate()
      },
      (error: Error) => {
        // No photo, no scene: the page keeps its still.
        link.stop({ reason: "asset", error })
      }
    )
    return loading
  }

  const release = () => {
    const gl = surface.gl
    if (res && gl && !surface.lost) {
      gl.deleteTexture(res.image)
      gl.deleteTexture(res.depth)
      res.triangle.dispose()
      gl.deleteProgram(res.program)
    }
    res = null
  }

  const bind = (canvas: HTMLCanvasElement): GL | null => {
    if (link.state === "failed") return null
    if (surface.canvas !== canvas) {
      release()
      const gl = surface.attach(canvas)
      if (!gl && !surface.lost) {
        link.stop({ reason: "no-webgl" })
        return null
      }
      pointer ??= trackPointer(() => link.invalidate())
      void load()
    }
    return surface.lost ? null : surface.gl
  }

  const upload = (gl: GL, unit: number, source: Source) => {
    const texture = createTexture(gl, unit)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    return texture
  }

  /** The program (compiled once per context), and the textures once the images are in. */
  const ensure = (canvas: HTMLCanvasElement): Resources | null => {
    const gl = bind(canvas)
    if (!gl) return null
    if (!res) {
      try {
        const program = createProgram(gl, FULLSCREEN_VERTEX, DEPTH, "depth-image")
        res = { gl, program, u: uniforms(gl, program), triangle: fullScreenTriangle(gl), image: null, depth: null }
      } catch (error) {
        link.stop({ reason: "shader", error: error instanceof Error ? error : new Error(String(error)) })
        return null
      }
      dirty = true
    }
    if (images && !res.image) {
      res.image = upload(gl, 0, images.image.source)
      res.depth = upload(gl, 1, images.depth.source)
      dirty = true
      link.set("ready")
    }
    return res
  }

  /** Where the view should lean, -1..1 each way: the device's tilt, else a fine pointer, else a slow drift. */
  const target = (canvas: HTMLCanvasElement): [number, number] => {
    if (tilt) return [tilt.x, tilt.y]
    if (pointer?.fine) {
      if (!pointer.active) return [0, 0]
      const [u, v] = pointer.uv(canvas.getBoundingClientRect())
      return [Math.max(-1, Math.min(1, u * 2 - 1)), Math.max(-1, Math.min(1, v * 2 - 1))]
    }
    return [0.7 * Math.sin((wall * Math.PI * 2) / 14), 0.4 * Math.sin((wall * Math.PI * 2) / 9.5 + 0.8)]
  }
  const drifting = () => !tilt && !pointer?.fine

  const draw = (r: Resources, canvas: HTMLCanvasElement) => {
    if (!images || !r.image) return
    const { gl, u } = r
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(r.program)
    // Cover fit: the share of the photo the canvas shows on each axis.
    const canvasAspect = canvas.width / Math.max(1, canvas.height)
    const imageAspect = images.image.width / Math.max(1, images.image.height)
    const cover: [number, number] = canvasAspect > imageAspect ? [1, imageAspect / canvasAspect] : [canvasAspect / imageAspect, 1]
    // The shift for a full step of depth, as a share of the visible width (so it is the same in pixels both ways).
    const k = strength * SHIFT_PER_STRENGTH
    const reach = Math.max(focus, 1 - focus)
    // Zoom in just enough that the largest shift never samples past an edge: no clamped smear, no seam.
    // The shown half-extent plus the largest shift must stay within 0.5 of the centre on each axis.
    const zoom = Math.min(1, 0.5 / (cover[0] * (0.5 + k * reach)), 0.5 / (cover[1] * (0.5 + k * reach * canvasAspect)))
    const shown: [number, number] = [cover[0] * zoom, cover[1] * zoom]
    u.vec2("u_cover", shown[0], shown[1])
    u.vec2("u_shift", -view.x * k * shown[0], -view.y * k * canvasAspect * shown[1])
    u.float("u_focus", focus)
    u.float("u_invert", options.invert ? 1 : 0)
    u.float("u_steps", DEPTH_LEVELS.steps[level])
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, r.image)
    u.int("u_image", 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, r.depth)
    u.int("u_depth", 1)
    r.triangle.draw()
    dirty = false
  }

  const fit = (frame: { width: number; height: number; pixelRatio: number }) => {
    const ratio = frame.pixelRatio * resolution * DEPTH_LEVELS.share[level]
    if (surface.fit(frame.width * ratio, frame.height * ratio)) dirty = true
  }

  return {
    levels: DEPTH_LEVELS.share.length,
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
      // Until the photo is in there is nothing to draw: wait for the load to ask for a frame (or poll unconnected).
      if (!r || !r.image) return !!r && link.world === null && link.state !== "failed"
      fit(frame)
      wall += frame.delta / 1000
      const [tx, ty] = target(frame.canvas)
      const nx = damp(view.x, tx, 0.08, frame.delta)
      const ny = damp(view.y, ty, 0.08, frame.delta)
      const moving = Math.abs(nx - view.x) + Math.abs(ny - view.y) > 1e-5 || Math.abs(tx - nx) + Math.abs(ty - ny) > 5e-4
      view.x = nx
      view.y = ny
      if (moving || dirty) draw(r, frame.canvas)
      // Drift and tilt are animations; a pointer settles, then rests until it moves again (it asks for a frame).
      return drifting() || !!tilt || moving || link.world === null
    },
    setLevel(next) {
      const l = Math.min(DEPTH_LEVELS.share.length - 1, Math.max(0, Math.round(next)))
      if (l === level) return
      level = l
      dirty = true
    },
    prewarm(): FrameTask[] {
      return [() => load(), () => void (surface.canvas && ensure(surface.canvas))]
    },
    async enableTilt() {
      if (tilt) return true
      if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") return false
      const ask = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> }).requestPermission
      if (ask) {
        try {
          if ((await ask()) !== "granted") return false
        } catch {
          return false
        }
      }
      const state: Tilt = {
        base: null,
        x: 0,
        y: 0,
        listener: (e) => {
          if (e.gamma === null || e.beta === null) return
          state.base ??= [e.gamma, e.beta]
          // About 20 degrees of tilt from where the person held the phone reaches the full lean.
          state.x = Math.max(-1, Math.min(1, (e.gamma - state.base[0]) / 20))
          state.y = Math.max(-1, Math.min(1, -(e.beta - state.base[1]) / 20))
        },
      }
      tilt = state
      window.addEventListener("deviceorientation", state.listener, { passive: true })
      link.invalidate()
      return true
    },
    disableTilt() {
      if (!tilt) return
      window.removeEventListener("deviceorientation", tilt.listener)
      tilt = null
      link.invalidate()
    },
    dispose() {
      release()
      surface.detach()
      pointer?.dispose()
      pointer = null
      if (tilt) window.removeEventListener("deviceorientation", tilt.listener)
      tilt = null
      if (link.state === "ready") link.set("idle")
      dirty = true
    },
  }
}
