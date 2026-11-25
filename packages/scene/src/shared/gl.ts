// The raw WebGL plumbing every scene shares: a context (WebGL2, else WebGL1), shaders compiled with errors a person
// can read, programs linked with the full-screen triangle's attribute fixed at location 0, and uniform setters that
// look each location up once. GLSL ES 1.00 runs in both contexts, so every shader here is written in it.

export type GL = WebGLRenderingContext | WebGL2RenderingContext

/** The attributes a decorative scene asks for: no alpha (the canvas is opaque, cheaper to composite), no depth,
 * stencil or antialiasing (a full-screen field needs none), and the low-power GPU where there is a choice. */
export const SCENE_CONTEXT: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  powerPreference: "low-power",
}

export interface SceneContext {
  gl: GL
  webgl2: boolean
}

/** A WebGL2 context, else WebGL1, else null (no WebGL, or a canvas that already holds a 2D context). */
export function getContext(canvas: HTMLCanvasElement, attributes: WebGLContextAttributes = SCENE_CONTEXT): SceneContext | null {
  try {
    const gl2 = canvas.getContext("webgl2", attributes)
    if (gl2) return { gl: gl2, webgl2: true }
    const gl1 = canvas.getContext("webgl", attributes) ?? (canvas.getContext("experimental-webgl" as "webgl", attributes) as WebGLRenderingContext | null)
    return gl1 ? { gl: gl1, webgl2: false } : null
  } catch {
    return null
  }
}

export type ShaderStage = "vertex" | "fragment" | "link"

/** A shader that did not compile or a program that did not link, with the driver's log and the lines it points at. */
export class ShaderError extends Error {
  readonly label: string
  readonly stage: ShaderStage
  readonly log: string
  constructor(label: string, stage: ShaderStage, log: string, source?: string) {
    super(readable(label, stage, log, source))
    this.name = "ShaderError"
    this.label = label
    this.stage = stage
    this.log = log
  }
}

/** The log with the source lines it names (`ERROR: 0:12: …` → line 12 with a line either side). */
function readable(label: string, stage: ShaderStage, log: string, source?: string): string {
  const head = stage === "link" ? `feather-scene: the ${label} program did not link` : `feather-scene: the ${stage} shader of ${label} did not compile`
  const text = log.trim() || "(the driver gave no log)"
  if (!source) return `${head}:\n${text}`
  const lines = source.split("\n")
  const named = [...new Set([...text.matchAll(/\b\d+:(\d+)\b/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n <= lines.length))]
  const context = named
    .slice(0, 3)
    .map((n) =>
      [n - 1, n, n + 1]
        .filter((i) => i >= 1 && i <= lines.length)
        .map((i) => `${i === n ? ">" : " "} ${String(i).padStart(4)} | ${lines[i - 1]}`)
        .join("\n")
    )
    .join("\n  …\n")
  return context ? `${head}:\n${text}\n${context}` : `${head}:\n${text}`
}

/** Compiles one shader; throws a ShaderError with the offending lines when it fails (and the context is not lost). */
export function compileShader(gl: GL, stage: "vertex" | "fragment", source: string, label = "scene"): WebGLShader {
  const shader = gl.createShader(stage === "vertex" ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER)
  if (!shader) throw new ShaderError(label, stage, "createShader returned null (the context may be lost)")
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader) ?? ""
    gl.deleteShader(shader)
    throw new ShaderError(label, stage, log, source)
  }
  return shader
}

/** The attribute every full-screen program reads, bound to location 0 before linking. */
export const POSITION_ATTRIBUTE = "a_position"

/** Compiles both shaders and links them; the shaders are freed once linked, so the program is the only object. */
export function createProgram(gl: GL, vertex: string, fragment: string, label = "scene"): WebGLProgram {
  const vs = compileShader(gl, "vertex", vertex, label)
  let fs: WebGLShader
  try {
    fs = compileShader(gl, "fragment", fragment, label)
  } catch (error) {
    gl.deleteShader(vs)
    throw error
  }
  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    throw new ShaderError(label, "link", "createProgram returned null (the context may be lost)")
  }
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.bindAttribLocation(program, 0, POSITION_ATTRIBUTE)
  gl.linkProgram(program)
  gl.detachShader(program, vs)
  gl.detachShader(program, fs)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    const log = gl.getProgramInfoLog(program) ?? ""
    gl.deleteProgram(program)
    throw new ShaderError(label, "link", log)
  }
  return program
}

/** Uniform setters for one program; each location is looked up once (a missing uniform is a silent no-op, since a
 * driver drops the ones a shader never reads). */
export interface Uniforms {
  location(name: string): WebGLUniformLocation | null
  float(name: string, x: number): void
  vec2(name: string, x: number, y: number): void
  vec3(name: string, x: number, y: number, z: number): void
  vec4(name: string, x: number, y: number, z: number, w: number): void
  int(name: string, x: number): void
  /** A vec3 array (`uniform vec3 u_palette[5]`), flat. */
  vec3s(name: string, data: Float32Array): void
}

export function uniforms(gl: GL, program: WebGLProgram): Uniforms {
  const cache = new Map<string, WebGLUniformLocation | null>()
  const location = (name: string) => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name))
    return cache.get(name) ?? null
  }
  const at = (name: string, set: (l: WebGLUniformLocation) => void) => {
    const l = location(name)
    if (l) set(l)
  }
  return {
    location,
    float: (name, x) => at(name, (l) => gl.uniform1f(l, x)),
    vec2: (name, x, y) => at(name, (l) => gl.uniform2f(l, x, y)),
    vec3: (name, x, y, z) => at(name, (l) => gl.uniform3f(l, x, y, z)),
    vec4: (name, x, y, z, w) => at(name, (l) => gl.uniform4f(l, x, y, z, w)),
    int: (name, x) => at(name, (l) => gl.uniform1i(l, x)),
    // An array uniform answers to its name and to `name[0]`, depending on the driver.
    vec3s: (name, data) => {
      const l = location(name) ?? location(`${name}[0]`)
      if (l) gl.uniform3fv(l, data)
    },
  }
}

/** The vertex shader of every full-screen pass: a uv from 0 to 1, origin bottom left. */
export const FULLSCREEN_VERTEX = `attribute vec2 ${POSITION_ATTRIBUTE};
varying vec2 v_uv;
void main() {
  v_uv = ${POSITION_ATTRIBUTE} * 0.5 + 0.5;
  gl_Position = vec4(${POSITION_ATTRIBUTE}, 0.0, 1.0);
}
`

/** One triangle that covers the viewport (no diagonal seam, a third fewer vertices than a quad). */
export interface FullScreenTriangle {
  draw(): void
  dispose(): void
}

export function fullScreenTriangle(gl: GL): FullScreenTriangle {
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  return {
    draw() {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() {
      gl.deleteBuffer(buffer)
    },
  }
}

/** A texture for a full-screen field or a photo: clamped at the edges (no seams, and legal for any size in WebGL1),
 * linear, no mipmaps. */
export function createTexture(gl: GL, unit = 0): WebGLTexture | null {
  const texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return texture
}
