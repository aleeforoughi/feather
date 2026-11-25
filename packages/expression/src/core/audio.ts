// The mixer (wave 3, docs/proposals/2026-11-24-range.md section 5 I): one AudioContext for the page, started only on
// a gesture after the person turns sound on, with three buses (bed, effects, ui) into a master gain, a low-pass (for
// overlays) and a compressor (threshold -6 dB, ratio 12), then an analyser for audio-reactive visuals. It is bound to
// the sound preference (core/sound.ts): off by default, remembered, the master fades in and out over 500ms as the
// preference changes, and goes silent at once while the tab is hidden. Files are fetched only once sound is on and
// decoded once. Without Web Audio (a server render, tests, an old browser) every call is a no-op with a safe answer.
// Feather's own code on the Web Audio API: no library.
import { sound as sharedSound, type SoundPreference } from "./sound"
import { isHidden } from "./visibility"

export type Bus = "bed" | "effects" | "ui"
export const BUSES: readonly Bus[] = ["bed", "effects", "ui"]

/** The mixer's measured defaults. */
export const MIXER = {
  /** The master's fade as the preference changes, and a loop's default fade (ms). */
  fade: 500,
  /** The low-pass sweep when an overlay opens or closes (ms), between these two frequencies (Hz). */
  muffle: 400,
  open: 20000,
  muffled: 100,
  /** The master compressor. */
  threshold: -6,
  ratio: 12,
  /** One-shots of one name allowed per second. */
  perSecond: 5,
  /** Bus levels (0..1). The bed sits low under everything. */
  volumes: { master: 1, bed: 0.4, effects: 0.8, ui: 0.5 } as Record<Bus | "master", number>,
  /** The analyser's FFT size (128 bins). */
  fftSize: 256,
} as const

export type AudioSource = string | AudioBuffer

export interface PlayOptions {
  /** Default "effects". */
  bus?: Bus
  /** 0..1, default 1 (on top of the bus level). */
  volume?: number
  /** Playback rate, default 1. */
  rate?: number
}

export interface LoopOptions {
  /** Default "bed". */
  bus?: Bus
  /** 0..1, default 1. A loop at 0 holds no source until it is faded up. */
  volume?: number
}

export interface LoopHandle {
  /** The volume the loop is heading to. */
  readonly volume: number
  /** Fades to `to` (0..1) over `ms` (default 500). At 0 the source is released once the fade ends. */
  fade(to: number, ms?: number): void
  /** Stops the loop (a 50ms fade, so it never clicks). */
  stop(): void
}

export interface Mixer {
  /** Whether Web Audio exists here. When false, every call is a no-op. */
  readonly supported: boolean
  /** The preference the mixer follows. */
  readonly preference: SoundPreference
  /** Whether the AudioContext exists (it is created on the first gesture after sound is turned on). */
  readonly started: boolean
  /** Whether sound is coming out: the preference is audible and the context runs. */
  readonly audible: boolean
  /** Toggles the preference. Call it from a click or key handler: turning sound on there starts the context. */
  toggle(): void
  /** Creates and resumes the context if sound is on. Call it only from a gesture handler (the mixer does, itself, on
   * the first pointerdown or keydown after sound is turned on). */
  unlock(): void
  /** Registers a sound by name. A URL is fetched only once sound is on and decoded once; an AudioBuffer is used as is.
   * Resolves true when it is ready, false when it cannot be (no Web Audio, a failed fetch or decode). */
  load(name: string, source: AudioSource): Promise<boolean>
  /** Plays a one-shot. Rate-limited per name (5 a second); false when nothing played. */
  play(name: string, options?: PlayOptions): boolean
  /** Starts a looping sound, fading it in. It begins once the context and the sound are ready. */
  loop(name: string, options?: LoopOptions): LoopHandle
  /** Lowers every other bus by `amount` (0..1, default 0.6) over `ms` (default 300) while `bus` plays (a voice);
   * returns the release, which brings them back over the same time. */
  duck(bus: Bus, amount?: number, ms?: number): () => void
  /** Sweeps the master low-pass down to 100 Hz (on) or back up to 20 kHz (off) over 400ms: overlays and dialogs. */
  muffle(on: boolean): void
  /** A reader of `count` normalised (0..1) frequency bands, log-spaced, for audio-reactive visuals. It returns the
   * same array each call; all zeros while nothing is audible. */
  bands(count: number): () => readonly number[]
  /** Calls back when `audible` or `started` changes; returns the unsubscribe. */
  subscribe(listener: (audible: boolean) => void): () => void
  dispose(): void
}

export interface MixerOptions {
  /** The preference to follow (default the page's `sound`). */
  preference?: SoundPreference
  /** Makes the AudioContext (tests pass a fake). `null` means no Web Audio. Default: the browser's. */
  context?: (() => AudioContext | null) | null
  /** Where the unlocking gesture is listened for (default window). */
  target?: EventTarget | null
  fetch?: (url: string) => Promise<Pick<Response, "ok" | "arrayBuffer">>
  /** A millisecond clock for the rate limit (default performance.now). */
  now?: () => number
  volumes?: Partial<Record<Bus | "master", number>>
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

function browserContext(): (() => AudioContext | null) | null {
  if (typeof window === "undefined") return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (typeof Ctor !== "function") return null
  return () => {
    try {
      return new Ctor()
    } catch {
      return null
    }
  }
}

/** Moves a parameter from where it is now to `to` over `ms` (at once when ms is 0). */
function ramp(param: AudioParam, to: number, ms: number, at: number, curve: "linear" | "exponential" = "linear") {
  const from = param.value
  param.cancelScheduledValues(at)
  param.setValueAtTime(from, at)
  if (ms <= 0) param.setValueAtTime(to, at)
  else if (curve === "exponential") param.exponentialRampToValueAtTime(to, at + ms / 1000)
  else param.linearRampToValueAtTime(to, at + ms / 1000)
}

interface Entry {
  source: AudioSource
  buffer: AudioBuffer | null
  bytes: Promise<ArrayBuffer | null> | null
  decoding: boolean
  ready: Promise<boolean>
  settle: (ok: boolean) => void
}

interface Graph {
  master: GainNode
  filter: BiquadFilterNode
  compressor: DynamicsCompressorNode
  analyser: AnalyserNode
  buses: Record<Bus, { level: GainNode; duck: GainNode }>
}

interface LoopState {
  name: string
  bus: Bus
  target: number
  source: AudioBufferSourceNode | null
  gain: GainNode | null
  timer: ReturnType<typeof setTimeout> | null
  stopped: boolean
}

const inert: LoopHandle = { volume: 0, fade() {}, stop() {} }

export function createMixer(options: MixerOptions = {}): Mixer {
  const preference = options.preference ?? sharedSound
  const factory = options.context === undefined ? browserContext() : options.context
  const volumes = { ...MIXER.volumes, ...options.volumes }
  const now = options.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()))
  const fetchBytes = options.fetch ?? (typeof fetch === "function" ? (url: string) => fetch(url) : null)
  const target = options.target === undefined ? (typeof window === "undefined" ? null : window) : options.target

  let supported = factory !== null
  let disposed = false
  let ctx: AudioContext | null = null
  let graph: Graph | null = null
  let muffled = false
  let suspendTimer: ReturnType<typeof setTimeout> | null = null
  let armed = false
  let lastAudible = false
  let lastStarted = false
  const entries = new Map<string, Entry>()
  const plays = new Map<string, number[]>()
  const loops = new Set<LoopState>()
  const shots = new Set<AudioBufferSourceNode>()
  const ducks = new Set<{ bus: Bus; amount: number }>()
  const duckLevel: Record<Bus, number> = { bed: 1, effects: 1, ui: 1 }
  const listeners = new Set<(audible: boolean) => void>()

  const running = () => ctx !== null && ctx.state === "running"
  const isAudible = () => supported && !disposed && preference.audible && running()

  const notify = () => {
    const audible = isAudible()
    const started = ctx !== null
    if (audible === lastAudible && started === lastStarted) return
    lastAudible = audible
    lastStarted = started
    for (const l of [...listeners]) l(audible)
  }

  // The gesture that starts the context: armed while sound is on and the context is not running.
  const onGesture = () => mixer.unlock()
  const arm = () => {
    if (armed || !target || disposed) return
    armed = true
    target.addEventListener("pointerdown", onGesture, { capture: true, passive: true })
    target.addEventListener("keydown", onGesture, { capture: true, passive: true })
  }
  const disarm = () => {
    if (!armed || !target) return
    armed = false
    target.removeEventListener("pointerdown", onGesture, { capture: true })
    target.removeEventListener("keydown", onGesture, { capture: true })
  }

  const clearSuspend = () => {
    if (suspendTimer) clearTimeout(suspendTimer)
    suspendTimer = null
  }
  const suspend = () => {
    clearSuspend()
    if (ctx && ctx.state === "running") void ctx.suspend().then(notify, () => {})
  }
  const resume = () => {
    if (!ctx || ctx.state === "running" || ctx.state === "closed") return
    void ctx.resume().then(
      () => {
        if (running()) disarm()
        notify()
      },
      () => arm(),
    )
  }

  // Staged loading: a URL is fetched only once sound is on, and decoded once there is a context.
  const stage = (name: string, entry: Entry) => {
    if (entry.buffer || typeof entry.source !== "string") return
    if (!entry.bytes && preference.state === "on" && fetchBytes) {
      const url = entry.source
      entry.bytes = fetchBytes(url).then(
        (r) => (r.ok ? r.arrayBuffer() : null),
        () => null,
      )
    }
    if (!entry.bytes || !ctx || entry.decoding) return
    entry.decoding = true
    const context = ctx
    entry.bytes
      .then((bytes) => (bytes ? context.decodeAudioData(bytes) : null))
      .then(
        (buffer) => {
          if (entries.get(name) !== entry) return
          if (!buffer) return entry.settle(false)
          entry.buffer = buffer
          entry.settle(true)
          for (const l of loops) if (l.name === name) applyLoop(l, MIXER.fade)
        },
        () => entry.settle(false),
      )
  }
  const stageAll = () => {
    for (const [name, entry] of entries) stage(name, entry)
  }

  const build = (context: AudioContext): Graph => {
    const master = context.createGain()
    master.gain.value = 0
    const filter = context.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = muffled ? MIXER.muffled : MIXER.open
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = MIXER.threshold
    compressor.ratio.value = MIXER.ratio
    const analyser = context.createAnalyser()
    analyser.fftSize = MIXER.fftSize
    master.connect(filter)
    filter.connect(compressor)
    compressor.connect(analyser)
    analyser.connect(context.destination)
    const buses = {} as Graph["buses"]
    for (const bus of BUSES) {
      const level = context.createGain()
      level.gain.value = clamp01(volumes[bus])
      const duck = context.createGain()
      duck.gain.value = duckLevel[bus]
      level.connect(duck)
      duck.connect(master)
      buses[bus] = { level, duck }
    }
    return { master, filter, compressor, analyser, buses }
  }

  // The master follows the preference: a 500ms fade, or silent at once when the tab is hidden.
  const sync = () => {
    if (!supported || disposed) return
    if (preference.state === "on") stageAll()
    if (!ctx || !graph) {
      if (preference.state === "on") arm()
      else disarm()
      notify()
      return
    }
    const gain = graph.master.gain
    const at = ctx.currentTime
    if (preference.audible) {
      clearSuspend()
      resume()
      ramp(gain, clamp01(volumes.master), MIXER.fade, at)
    } else if (isHidden()) {
      ramp(gain, 0, 0, at)
      suspend()
    } else {
      ramp(gain, 0, MIXER.fade, at)
      clearSuspend()
      suspendTimer = setTimeout(suspend, MIXER.fade + 50)
    }
    if (preference.state !== "on") disarm()
    notify()
  }

  const releaseLoop = (l: LoopState) => {
    if (l.timer) clearTimeout(l.timer)
    l.timer = null
    try {
      l.source?.stop()
    } catch {
      // Never started.
    }
    l.source?.disconnect()
    l.gain?.disconnect()
    l.source = null
    l.gain = null
  }

  const applyLoop = (l: LoopState, ms: number) => {
    if (l.stopped || !ctx || !graph) return
    const buffer = entries.get(l.name)?.buffer
    if (!buffer) return
    if (!l.source && l.target > 0) {
      const gain = ctx.createGain()
      gain.gain.value = 0
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(gain)
      gain.connect(graph.buses[l.bus].level)
      source.start()
      l.source = source
      l.gain = gain
    }
    if (!l.gain) return
    if (l.timer) clearTimeout(l.timer)
    l.timer = null
    ramp(l.gain.gain, l.target, ms, ctx.currentTime)
    if (l.target === 0) l.timer = setTimeout(() => releaseLoop(l), ms + 50)
  }

  const applyDucks = (ms: number) => {
    for (const bus of BUSES) {
      let depth = 0
      for (const d of ducks) if (d.bus !== bus) depth = Math.max(depth, d.amount)
      const level = 1 - depth
      if (level === duckLevel[bus]) continue
      duckLevel[bus] = level
      if (ctx && graph) ramp(graph.buses[bus].duck.gain, level, ms, ctx.currentTime)
    }
  }

  const stopPreference = supported ? preference.subscribe(() => sync()) : () => {}
  if (supported && preference.state === "on") arm()

  const mixer: Mixer = {
    get supported() {
      return supported && !disposed
    },
    preference,
    get started() {
      return ctx !== null
    },
    get audible() {
      return isAudible()
    },
    toggle() {
      preference.toggle()
      if (preference.state === "on") mixer.unlock()
    },
    unlock() {
      if (!supported || disposed || preference.state !== "on") return
      if (!ctx) {
        ctx = factory?.() ?? null
        if (!ctx) {
          supported = false
          disarm()
          return
        }
        graph = build(ctx)
        ctx.onstatechange = () => {
          // Another app or the system can interrupt the context; the next gesture resumes it.
          if (!running() && preference.audible) arm()
          notify()
        }
        sync()
        for (const l of loops) applyLoop(l, MIXER.fade)
      }
      if (!isHidden()) resume()
      if (running()) disarm()
      notify()
    },
    load(name, source) {
      if (!supported || disposed) return Promise.resolve(false)
      const known = entries.get(name)
      if (known && known.source === source) return known.ready
      let settle: (ok: boolean) => void = () => {}
      const ready = new Promise<boolean>((resolve) => {
        settle = resolve
      })
      const entry: Entry = { source, buffer: typeof source === "string" ? null : source, bytes: null, decoding: false, ready, settle }
      entries.set(name, entry)
      if (entry.buffer) {
        entry.settle(true)
        for (const l of loops) if (l.name === name) applyLoop(l, MIXER.fade)
      } else stage(name, entry)
      return ready
    },
    play(name, { bus = "effects", volume = 1, rate = 1 } = {}) {
      if (!isAudible() || !ctx || !graph) return false
      const buffer = entries.get(name)?.buffer
      if (!buffer) return false
      const t = now()
      const recent = (plays.get(name) ?? []).filter((at) => t - at < 1000)
      if (recent.length >= MIXER.perSecond) {
        plays.set(name, recent)
        return false
      }
      recent.push(t)
      plays.set(name, recent)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = rate > 0 && Number.isFinite(rate) ? rate : 1
      const gain = ctx.createGain()
      gain.gain.value = clamp01(volume)
      source.connect(gain)
      gain.connect(graph.buses[bus].level)
      source.onended = () => {
        source.disconnect()
        gain.disconnect()
        shots.delete(source)
      }
      source.start()
      shots.add(source)
      return true
    },
    loop(name, { bus = "bed", volume = 1 } = {}) {
      if (!supported || disposed) return inert
      const state: LoopState = { name, bus, target: clamp01(volume), source: null, gain: null, timer: null, stopped: false }
      loops.add(state)
      applyLoop(state, MIXER.fade)
      return {
        get volume() {
          return state.target
        },
        fade(to, ms = MIXER.fade) {
          if (state.stopped) return
          state.target = clamp01(to)
          applyLoop(state, Math.max(0, ms))
        },
        stop() {
          if (state.stopped) return
          state.target = 0
          applyLoop(state, 50)
          state.stopped = true
          loops.delete(state)
        },
      }
    },
    duck(bus, amount = 0.6, ms = 300) {
      if (!supported || disposed) return () => {}
      const token = { bus, amount: clamp01(amount) }
      ducks.add(token)
      applyDucks(ms)
      let released = false
      return () => {
        if (released) return
        released = true
        ducks.delete(token)
        applyDucks(ms)
      }
    },
    muffle(on) {
      if (!supported || disposed || on === muffled) return
      muffled = on
      if (ctx && graph) ramp(graph.filter.frequency, on ? MIXER.muffled : MIXER.open, MIXER.muffle, ctx.currentTime, "exponential")
    },
    bands(count) {
      const n = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1))
      const out = new Array<number>(n).fill(0)
      let data: Uint8Array<ArrayBuffer> | null = null
      return () => {
        if (!isAudible() || !graph) {
          out.fill(0)
          return out
        }
        const analyser = graph.analyser
        const bins = analyser.frequencyBinCount
        if (!data || data.length !== bins) data = new Uint8Array(bins)
        analyser.getByteFrequencyData(data)
        // Log-spaced, so the low end (where most of the energy is) gets its own bands.
        let lo = 0
        for (let i = 0; i < n; i++) {
          const hi = Math.min(bins, Math.max(lo + 1, Math.round(bins ** ((i + 1) / n))))
          let sum = 0
          for (let b = lo; b < hi; b++) sum += data[b] ?? 0
          out[i] = hi > lo ? sum / ((hi - lo) * 255) : 0
          lo = Math.min(bins - 1, hi)
        }
        return out
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      if (disposed) return
      stopPreference()
      disarm()
      clearSuspend()
      for (const l of loops) {
        l.stopped = true
        releaseLoop(l)
      }
      loops.clear()
      for (const s of shots) {
        try {
          s.stop()
        } catch {
          // Already ended.
        }
      }
      shots.clear()
      if (ctx) {
        ctx.onstatechange = null
        void ctx.close().catch(() => {})
      }
      disposed = true
      ctx = null
      graph = null
      notify()
      listeners.clear()
    },
  }
  return mixer
}

let shared: Mixer | null = null

/** The page's one mixer, bound to the page's `sound` preference, made on first use. */
export function getMixer(): Mixer {
  shared ??= createMixer()
  return shared
}
