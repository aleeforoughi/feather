// studioPost: the one post chain any Three.js scene here can take. Render, bloom (UnrealBloomPass), the output pass
// (the scene's tone mapping and sRGB, once), then film grain and vignette merged in one finishing pass. Bloom runs at
// half resolution on the mid tier; the low tier has no post at all and the scene renders straight to the screen with
// the same tone mapping, so the look holds across tiers. Starting values from the pmndrs postprocessing docs (Qooler
// file 27 §4): bloom intensity 0.5–2, threshold 0.8–1, radius 0.5–1; grain re-seeded at 24 fps only while the scene
// moves (a still frame never flickers).
import { Vector2, type Camera, type Scene, type WebGLRenderer } from "three"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"
import { clamp, type Tier } from "./maths"

export interface StudioPostOptions {
  /** Bloom, or false for none. Each value is held inside its range. The threshold defaults to 1, the top of its range:
   * only light brighter than white (emissive parts, speculars) blooms, so a light theme's ground never washes out. */
  bloom?: false | { intensity?: number; threshold?: number; radius?: number }
  /** Film grain amplitude, 0 to 0.08 (default 0.025, a 2–3% grain). */
  grain?: number
  /** Vignette strength at the corners, 0 to 1 (default 0.3). */
  vignette?: number
}

/** The ranges every option is held to. */
export const POST_RANGES = { intensity: [0.5, 2], threshold: [0.8, 1], radius: [0.5, 1], grain: [0, 0.08], vignette: [0, 1] } as const

export interface ResolvedPost {
  bloom: { intensity: number; threshold: number; radius: number } | null
  grain: number
  vignette: number
}

export interface StudioPost {
  readonly options: ResolvedPost
  /** Whether the chain renders this frame (false on the low tier, or before a scene attaches it). */
  readonly active: boolean
  /** Called by the scene renderer once its renderer, scene and camera exist. */
  attach(renderer: WebGLRenderer, scene: Scene, camera: Camera): void
  resize(width: number, height: number, pixelRatio: number): void
  setTier(tier: Tier): void
  /** Renders one frame through the chain. `time` in seconds; `moving` re-seeds the grain. */
  render(time: number, moving: boolean): void
  dispose(): void
}

/** The options, held inside their ranges. */
export function resolvePost(options: StudioPostOptions = {}): ResolvedPost {
  const r = POST_RANGES
  const bloom = options.bloom === false ? null : options.bloom ?? {}
  return {
    bloom: bloom ? { intensity: clamp(bloom.intensity ?? 0.9, ...r.intensity), threshold: clamp(bloom.threshold ?? 1, ...r.threshold), radius: clamp(bloom.radius ?? 0.6, ...r.radius) } : null,
    grain: clamp(options.grain ?? 0.025, ...r.grain),
    vignette: clamp(options.vignette ?? 0.3, ...r.vignette),
  }
}

/** Grain and vignette in one pass, in display space (after the output pass), so the grain's amplitude is perceptual. */
const FINISH = {
  name: "FeatherFinish",
  uniforms: { tDiffuse: { value: null }, uGrain: { value: 0.025 }, uVignette: { value: 0.3 }, uSeed: { value: 0 }, uResolution: { value: new Vector2(1, 1) } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    precision mediump float;
    uniform sampler2D tDiffuse;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uSeed;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float hash(vec2 p) {
      p = fract(p * vec2(0.1031, 0.1030));
      p += dot(p, p.yx + 33.33);
      return fract((p.x + p.y) * p.x);
    }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float edge = length((vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0)) / length(vec2(uResolution.x / uResolution.y, 1.0) * 0.5);
      color.rgb *= 1.0 - uVignette * smoothstep(0.45, 1.0, edge);
      color.rgb += (hash(vUv * uResolution + uSeed) - 0.5) * uGrain;
      gl_FragColor = color;
    }`,
}

/** One post chain for a scene: pass it as the scene's `post` option. */
export function studioPost(options: StudioPostOptions = {}): StudioPost {
  const resolved = resolvePost(options)
  let renderer: WebGLRenderer | null = null
  let scene: Scene | null = null
  let camera: Camera | null = null
  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  let finish: ShaderPass | null = null
  let output: OutputPass | null = null
  let tier: Tier = "high"
  let size = { width: 1, height: 1, pixelRatio: 1 }
  let seed = 0

  const teardown = () => {
    bloom?.dispose()
    output?.dispose()
    finish?.dispose()
    composer?.dispose()
    composer = bloom = finish = output = null
  }
  const build = () => {
    if (!renderer || !scene || !camera || tier === "low" || composer) return
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    if (resolved.bloom) {
      bloom = new UnrealBloomPass(new Vector2(size.width, size.height), resolved.bloom.intensity, resolved.bloom.radius, resolved.bloom.threshold)
      composer.addPass(bloom)
    }
    output = new OutputPass()
    composer.addPass(output)
    finish = new ShaderPass(FINISH)
    finish.uniforms.uGrain.value = resolved.grain
    finish.uniforms.uVignette.value = resolved.vignette
    composer.addPass(finish)
    applySize()
  }
  const applySize = () => {
    if (!composer) return
    composer.setPixelRatio(size.pixelRatio)
    composer.setSize(size.width, size.height)
    // The mid tier's bloom works at half the resolution (it roughly doubles the frame rate when fill-bound).
    if (bloom && tier === "mid") bloom.setSize((size.width * size.pixelRatio) / 2, (size.height * size.pixelRatio) / 2)
    finish?.uniforms.uResolution.value.set(size.width * size.pixelRatio, size.height * size.pixelRatio)
  }

  return {
    options: resolved,
    get active() {
      return composer !== null
    },
    attach(r, s, c) {
      renderer = r
      scene = s
      camera = c
      teardown()
      build()
    },
    resize(width, height, pixelRatio) {
      size = { width: Math.max(1, width), height: Math.max(1, height), pixelRatio }
      applySize()
    },
    setTier(next) {
      if (next === tier) return
      tier = next
      if (tier === "low") teardown()
      else if (composer) applySize()
      else build()
    },
    render(time, moving) {
      if (!composer) return
      if (finish && moving) {
        const step = Math.floor(time * 24)
        if (step !== seed) finish.uniforms.uSeed.value = (seed = step) % 997
      }
      composer.render()
    },
    dispose() {
      teardown()
      renderer = scene = camera = null
    },
  }
}
