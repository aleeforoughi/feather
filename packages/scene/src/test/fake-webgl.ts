// A hand-written fake WebGL2 context for jsdom: every call is recorded, objects are plain tokens, compiling and
// linking succeed (or fail on demand), and the canvas can lose and restore it. Enough to prove what a renderer asks of
// the GPU, never how it looks.
import { vi } from "vitest"

export interface Call {
  name: string
  args: unknown[]
}

export interface FakeGL {
  gl: WebGL2RenderingContext
  calls: Call[]
  /** The calls named `name`. */
  named(name: string): Call[]
  /** The value last set on a uniform, by its name. */
  uniform(name: string): unknown[] | undefined
  /** Objects created and not yet deleted, by kind. */
  live(kind: "program" | "shader" | "buffer" | "texture" | "framebuffer"): number
  /** The next compile of a fragment shader fails with this log. */
  failNextCompile(log: string): void
  lose(): void
  restore(): void
}

const CONSTANTS: Record<string, number> = {
  VERTEX_SHADER: 0x8b31,
  FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81,
  LINK_STATUS: 0x8b82,
  ARRAY_BUFFER: 0x8892,
  STATIC_DRAW: 0x88e4,
  FLOAT: 0x1406,
  TRIANGLES: 0x0004,
  TEXTURE_2D: 0x0de1,
  TEXTURE0: 0x84c0,
  TEXTURE1: 0x84c1,
  TEXTURE_WRAP_S: 0x2802,
  TEXTURE_WRAP_T: 0x2803,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_MAG_FILTER: 0x2800,
  CLAMP_TO_EDGE: 0x812f,
  LINEAR: 0x2601,
  RGBA: 0x1908,
  UNSIGNED_BYTE: 0x1401,
  FRAMEBUFFER: 0x8d40,
  COLOR_ATTACHMENT0: 0x8ce0,
  FRAMEBUFFER_COMPLETE: 0x8cd5,
  UNPACK_FLIP_Y_WEBGL: 0x9240,
}

export function fakeWebGL(canvas: HTMLCanvasElement): FakeGL {
  const calls: Call[] = []
  const objects = new Map<object, string>()
  const uniformValues = new Map<string, unknown[]>()
  const shaderType = new Map<object, number>()
  let lost = false
  let failLog: string | null = null
  let id = 0
  const make = (kind: string) => {
    const o = { kind, id: ++id }
    objects.set(o, kind)
    return o
  }
  const free = (o: unknown) => void (o && objects.delete(o as object))
  const methods: Record<string, (...args: never[]) => unknown> = {
    createShader: (type: number) => {
      const s = make("shader")
      shaderType.set(s, type)
      return s
    },
    createProgram: () => make("program"),
    createBuffer: () => make("buffer"),
    createTexture: () => make("texture"),
    createFramebuffer: () => make("framebuffer"),
    deleteShader: free,
    deleteProgram: free,
    deleteBuffer: free,
    deleteTexture: free,
    deleteFramebuffer: free,
    getShaderParameter: (shader: object) => {
      if (failLog !== null && shaderType.get(shader) === CONSTANTS.FRAGMENT_SHADER) return false
      return true
    },
    getShaderInfoLog: () => {
      const log = failLog
      failLog = null
      return log
    },
    getProgramParameter: () => true,
    getProgramInfoLog: () => "",
    getUniformLocation: (_program: object, name: string) => ({ uniform: name }),
    checkFramebufferStatus: () => CONSTANTS.FRAMEBUFFER_COMPLETE,
    isContextLost: () => lost,
    getExtension: () => null,
  }
  const record = (name: string, args: unknown[]) => {
    calls.push({ name, args })
    if (/^uniform/.test(name) && args[0] && typeof args[0] === "object" && "uniform" in (args[0] as object)) uniformValues.set((args[0] as { uniform: string }).uniform, args.slice(1))
  }
  const gl = new Proxy({ canvas } as Record<string, unknown>, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined
      if (prop in target) return target[prop]
      if (prop in CONSTANTS) return CONSTANTS[prop]
      if (/^[A-Z0-9_]+$/.test(prop)) return 0
      return (...args: unknown[]) => {
        record(prop, args)
        const method = methods[prop] as ((...a: unknown[]) => unknown) | undefined
        return method ? method(...args) : undefined
      }
    },
  }) as unknown as WebGL2RenderingContext

  return {
    gl,
    calls,
    named: (name) => calls.filter((c) => c.name === name),
    uniform: (name) => uniformValues.get(name),
    live: (kind) => [...objects.values()].filter((k) => k === kind).length,
    failNextCompile(log) {
      failLog = log
    },
    lose() {
      lost = true
      objects.clear()
      const event = new Event("webglcontextlost", { cancelable: true })
      canvas.dispatchEvent(event)
    },
    restore() {
      lost = false
      canvas.dispatchEvent(new Event("webglcontextrestored"))
    },
  }
}

/** Every canvas's getContext("webgl2") answers with its own fake; the fakes are kept by canvas. */
export function installFakeWebGL() {
  const fakes = new Map<HTMLCanvasElement, FakeGL>()
  const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, type: string) {
    if (type !== "webgl2") return null
    let fake = fakes.get(this)
    if (!fake) {
      fake = fakeWebGL(this)
      fakes.set(this, fake)
    }
    return fake.gl
  } as typeof HTMLCanvasElement.prototype.getContext)
  return {
    of: (canvas: HTMLCanvasElement) => fakes.get(canvas),
    restore: () => spy.mockRestore(),
  }
}
