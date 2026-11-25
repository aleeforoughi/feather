// A pointer flowmap: a small square texture of velocities, ping-ponged between two framebuffers. Each frame the last
// state fades and the pointer adds its velocity where it is; the background reads it to push its uv. 8-bit RGBA, so
// it renders in every WebGL1 context (float targets need extensions).

import { createProgram, createTexture, FULLSCREEN_VERTEX, uniforms, type FullScreenTriangle, type GL } from "../shared/gl"
import { FLOWMAP } from "./shaders"

export interface Flowmap {
  readonly size: number
  /** Reallocates both targets at a new size (cleared): the quality ladder's lower levels use a smaller map. */
  resize(size: number): void
  /** The newest state, to sample from. */
  readonly texture: WebGLTexture | null
  step(input: { point: readonly [number, number]; velocity: readonly [number, number]; aspect: number }): void
  dispose(): void
}

/** How far a splat reaches (in the flowmap's height) and how much of the last frame survives each frame. */
export const FLOW_RADIUS = 0.22
export const FLOW_DISSIPATION = 0.94

/** The flowmap, or null where this context cannot render to an 8-bit texture (the background then runs unbent). */
export function createFlowmap(gl: GL, initial: number, triangle: FullScreenTriangle): Flowmap | null {
  const program = createProgram(gl, FULLSCREEN_VERTEX, FLOWMAP, "flowmap")
  const u = uniforms(gl, program)
  let size = initial
  // Zero velocity is 128 in a byte (the shader decodes around 128/255).
  const clear = (texture: WebGLTexture | null, n: number) => {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(n * n * 4).fill(128))
  }
  const targets = [0, 1].map(() => {
    const texture = createTexture(gl, 0)
    clear(texture, size)
    const framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    return { texture, framebuffer }
  })
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  const free = () => {
    for (const t of targets) {
      gl.deleteFramebuffer(t.framebuffer)
      gl.deleteTexture(t.texture)
    }
    gl.deleteProgram(program)
  }
  if (!complete) {
    free()
    return null
  }
  let current = 0
  return {
    get size() {
      return size
    },
    resize(next) {
      if (next === size) return
      size = next
      for (const t of targets) clear(t.texture, size)
    },
    get texture() {
      return targets[current].texture
    },
    step({ point, velocity, aspect }) {
      const next = 1 - current
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[next].framebuffer)
      gl.viewport(0, 0, size, size)
      gl.useProgram(program)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, targets[current].texture)
      u.int("u_prev", 0)
      u.vec2("u_point", point[0], point[1])
      u.vec2("u_velocity", velocity[0], velocity[1])
      u.float("u_aspect", aspect)
      u.float("u_radius", FLOW_RADIUS)
      u.float("u_dissipation", FLOW_DISSIPATION)
      triangle.draw()
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      current = next
    },
    dispose: free,
  }
}
