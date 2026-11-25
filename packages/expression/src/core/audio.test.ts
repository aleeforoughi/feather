import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMixer, MIXER } from "./audio"
import { createSoundPreference } from "./sound"

// A hand-written fake of the Web Audio graph: every node records what it is connected to, and every parameter
// records the automation it is given (a ramp jumps to its end value, so the next ramp starts from there).
type Event = [kind: "cancel" | "set" | "linear" | "exp", value: number, time: number]

class FakeParam {
  events: Event[] = []
  value: number
  constructor(value: number) {
    this.value = value
  }
  cancelScheduledValues(t: number) {
    this.events.push(["cancel", Number.NaN, t])
  }
  setValueAtTime(v: number, t: number) {
    this.events.push(["set", v, t])
    this.value = v
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push(["linear", v, t])
    this.value = v
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.events.push(["exp", v, t])
    this.value = v
  }
  /** The last ramp or set (not the cancel/hold pair before it). */
  get last() {
    return this.events.at(-1)
  }
}

class FakeNode {
  outputs: FakeNode[] = []
  connect<T extends FakeNode>(node: T) {
    this.outputs.push(node)
    return node
  }
  disconnect() {
    this.outputs = []
  }
}
class FakeGain extends FakeNode {
  gain = new FakeParam(1)
}
class FakeFilter extends FakeNode {
  type = "lowpass"
  frequency = new FakeParam(350)
}
class FakeCompressor extends FakeNode {
  threshold = new FakeParam(-24)
  ratio = new FakeParam(12)
}
class FakeAnalyser extends FakeNode {
  fftSize = 2048
  level = 0
  get frequencyBinCount() {
    return this.fftSize / 2
  }
  getByteFrequencyData(array: Uint8Array) {
    array.fill(this.level)
  }
}
class FakeSource extends FakeNode {
  buffer: unknown = null
  loop = false
  playbackRate = new FakeParam(1)
  started = 0
  stopped = 0
  onended: (() => void) | null = null
  start() {
    this.started++
  }
  stop() {
    this.stopped++
  }
}

class FakeContext {
  state: "suspended" | "running" | "closed" = "suspended"
  currentTime = 10
  destination = new FakeNode()
  onstatechange: (() => void) | null = null
  gains: FakeGain[] = []
  sources: FakeSource[] = []
  filter: FakeFilter | null = null
  compressor: FakeCompressor | null = null
  analyser: FakeAnalyser | null = null
  resume = vi.fn(() => {
    this.state = "running"
    this.onstatechange?.()
    return Promise.resolve()
  })
  suspend = vi.fn(() => {
    this.state = "suspended"
    this.onstatechange?.()
    return Promise.resolve()
  })
  close = vi.fn(() => {
    this.state = "closed"
    return Promise.resolve()
  })
  decodeAudioData = vi.fn(() => Promise.resolve({ duration: 2 }))
  createGain() {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createBiquadFilter() {
    return (this.filter = new FakeFilter())
  }
  createDynamicsCompressor() {
    return (this.compressor = new FakeCompressor())
  }
  createAnalyser() {
    return (this.analyser = new FakeAnalyser())
  }
  createBufferSource() {
    const s = new FakeSource()
    this.sources.push(s)
    return s
  }
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

const BUFFER = { duration: 1 } as unknown as AudioBuffer

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event("visibilitychange"))
}

function setup({ on = false } = {}) {
  const preference = createSoundPreference({ storage: null })
  if (on) preference.set("on")
  const contexts: FakeContext[] = []
  const context = vi.fn(() => {
    const c = new FakeContext()
    contexts.push(c)
    return c as unknown as AudioContext
  })
  const target = new EventTarget()
  const fetch = vi.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }))
  let time = 0
  const clock = { advance: (ms: number) => (time += ms) }
  const mixer = createMixer({ preference, context, target, fetch, now: () => time })
  const gesture = (type: "pointerdown" | "keydown" = "pointerdown") => target.dispatchEvent(new Event(type))
  /** The master is the gain the filter is fed by. */
  const master = () => contexts[0]!.gains[0]!
  const bus = (i: number) => ({ level: contexts[0]!.gains[1 + i * 2]!, duck: contexts[0]!.gains[2 + i * 2]! })
  return { preference, context, contexts, target, fetch, clock, mixer, gesture, master, bus }
}

async function started() {
  const s = setup()
  s.preference.set("on")
  s.gesture()
  await flush()
  return s
}

beforeEach(() => setHidden(false))
afterEach(() => {
  vi.useRealTimers()
  setHidden(false)
})

describe("createMixer", () => {
  it("is off by default and creates nothing before a gesture", async () => {
    const { mixer, context, fetch, gesture, preference } = setup()
    expect(preference.state).toBe("off")
    expect(mixer.audible).toBe(false)
    void mixer.load("bed", "/bed.mp3")
    gesture()
    gesture("keydown")
    expect(context).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    // Turned on: the files it needs are fetched, but the context still waits for a gesture.
    preference.set("on")
    expect(fetch).toHaveBeenCalledWith("/bed.mp3")
    expect(context).not.toHaveBeenCalled()
    expect(mixer.started).toBe(false)
  })

  it("starts one context on the first gesture after sound is turned on, and resumes it", async () => {
    const { mixer, context, contexts, gesture, preference } = setup()
    preference.set("on")
    gesture("keydown")
    await flush()
    expect(context).toHaveBeenCalledTimes(1)
    expect(contexts[0]!.resume).toHaveBeenCalled()
    expect(mixer.started).toBe(true)
    expect(mixer.audible).toBe(true)
    gesture()
    expect(context).toHaveBeenCalledTimes(1)
  })

  it("starts at once when toggled on from a press", async () => {
    const { mixer, context } = setup()
    mixer.toggle()
    await flush()
    expect(context).toHaveBeenCalledTimes(1)
    expect(mixer.audible).toBe(true)
  })

  it("routes three buses through a master, a low-pass and a compressor at -6 dB, ratio 12", async () => {
    const { contexts, master, bus } = await started()
    const c = contexts[0]!
    expect(c.compressor!.threshold.value).toBe(-6)
    expect(c.compressor!.ratio.value).toBe(12)
    expect(master().outputs).toEqual([c.filter])
    expect(c.filter!.outputs).toEqual([c.compressor])
    expect(c.compressor!.outputs).toEqual([c.analyser])
    expect(c.analyser!.outputs).toEqual([c.destination])
    for (let i = 0; i < 3; i++) {
      expect(bus(i).level.outputs).toEqual([bus(i).duck])
      expect(bus(i).duck.outputs).toEqual([master()])
    }
    expect(bus(0).level.gain.value).toBe(MIXER.volumes.bed)
    expect(c.filter!.frequency.value).toBe(20000)
  })

  it("fades the master in and out over 500ms as the preference changes", async () => {
    vi.useFakeTimers()
    const { contexts, master, preference, mixer } = await started()
    const c = contexts[0]!
    expect(master().gain.last).toEqual(["linear", 1, 10.5])
    const listener = vi.fn()
    mixer.subscribe(listener)
    preference.set("off")
    expect(master().gain.last).toEqual(["linear", 0, 10.5])
    expect(mixer.audible).toBe(false)
    expect(listener).toHaveBeenCalledWith(false)
    expect(c.suspend).not.toHaveBeenCalled()
    vi.advanceTimersByTime(600)
    expect(c.suspend).toHaveBeenCalled()
    preference.set("on")
    await flush()
    expect(c.resume).toHaveBeenCalledTimes(2)
    expect(master().gain.last).toEqual(["linear", 1, 10.5])
    expect(mixer.audible).toBe(true)
  })

  it("is silent at once while the tab is hidden, and comes back on return", async () => {
    const { contexts, master, mixer } = await started()
    const c = contexts[0]!
    setHidden(true)
    expect(master().gain.last).toEqual(["set", 0, 10])
    expect(master().gain.events.some(([k, v, t]) => k === "linear" && v === 0 && t > 10)).toBe(false)
    expect(c.suspend).toHaveBeenCalled()
    expect(mixer.audible).toBe(false)
    setHidden(false)
    await flush()
    expect(master().gain.last).toEqual(["linear", 1, 10.5])
    expect(mixer.audible).toBe(true)
  })

  it("plays nothing while sound is off", async () => {
    const { mixer } = setup()
    await mixer.load("click", BUFFER)
    expect(mixer.play("click")).toBe(false)
  })

  it("rate-limits one-shots to five a second per name", async () => {
    const { mixer, clock, contexts, bus } = await started()
    await mixer.load("tick", BUFFER)
    await mixer.load("tock", BUFFER)
    const results = Array.from({ length: 7 }, () => mixer.play("tick", { bus: "ui", volume: 0.5, rate: 1.2 }))
    expect(results).toEqual([true, true, true, true, true, false, false])
    expect(mixer.play("tock")).toBe(true)
    clock.advance(1001)
    expect(mixer.play("tick")).toBe(true)
    const first = contexts[0]!.sources[0]!
    expect(first.started).toBe(1)
    expect(first.playbackRate.value).toBe(1.2)
    // The one-shot's own gain feeds the ui bus.
    expect(first.outputs[0]!.outputs).toEqual([bus(2).level])
  })

  it("decodes a URL once, after sound is on and the context exists", async () => {
    const { mixer, contexts, fetch, preference, gesture } = setup()
    const ready = mixer.load("bed", "/bed.mp3")
    expect(fetch).not.toHaveBeenCalled()
    preference.set("on")
    gesture()
    expect(await ready).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(contexts[0]!.decodeAudioData).toHaveBeenCalledTimes(1)
    expect(await mixer.load("bed", "/bed.mp3")).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("resolves false when a file cannot be fetched", async () => {
    const preference = createSoundPreference({ storage: null })
    preference.set("on")
    const mixer = createMixer({ preference, context: () => new FakeContext() as unknown as AudioContext, target: null, fetch: () => Promise.resolve({ ok: false, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }) })
    const ready = mixer.load("x", "/missing.mp3")
    mixer.unlock()
    expect(await ready).toBe(false)
  })

  it("starts a loop once ready, fades it, and releases the source at 0", async () => {
    vi.useFakeTimers()
    const { mixer, contexts } = await started()
    const c = contexts[0]!
    const loop = mixer.loop("pad", { volume: 0.8 })
    expect(c.sources).toHaveLength(0)
    await mixer.load("pad", BUFFER)
    const source = c.sources[0]!
    expect(source.loop).toBe(true)
    expect(source.started).toBe(1)
    const gain = source.outputs[0] as FakeGain
    expect(gain.gain.last).toEqual(["linear", 0.8, 10.5])
    loop.fade(0.2, 300)
    expect(gain.gain.last).toEqual(["linear", 0.2, 10.3])
    loop.fade(0, 400)
    expect(source.stopped).toBe(0)
    vi.advanceTimersByTime(500)
    expect(source.stopped).toBe(1)
    loop.fade(0.5)
    expect(c.sources).toHaveLength(2)
    loop.stop()
    vi.advanceTimersByTime(200)
    expect(c.sources[1]!.stopped).toBe(1)
  })

  it("ducks the other buses while one plays, and brings them back", async () => {
    const { mixer, bus } = await started()
    const release = mixer.duck("effects", 0.7, 200)
    expect(bus(0).duck.gain.last).toEqual(["linear", 0.30000000000000004, 10.2])
    expect(bus(2).duck.gain.last).toEqual(["linear", 0.30000000000000004, 10.2])
    expect(bus(1).duck.gain.events).toEqual([])
    release()
    expect(bus(0).duck.gain.last).toEqual(["linear", 1, 10.2])
    expect(bus(2).duck.gain.last).toEqual(["linear", 1, 10.2])
    release()
    expect(bus(0).duck.gain.events.filter(([k]) => k === "linear")).toHaveLength(2)
  })

  it("muffles the master with a low-pass sweep to 100 Hz over 400ms, and opens it again", async () => {
    const { mixer, contexts } = await started()
    const f = contexts[0]!.filter!.frequency
    mixer.muffle(true)
    expect(f.last).toEqual(["exp", 100, 10.4])
    mixer.muffle(true)
    expect(f.events.filter(([k]) => k === "exp")).toHaveLength(1)
    mixer.muffle(false)
    expect(f.last).toEqual(["exp", 20000, 10.4])
  })

  it("holds a muffle asked for before the context exists", async () => {
    const s = setup()
    s.mixer.muffle(true)
    s.preference.set("on")
    s.gesture()
    expect(s.contexts[0]!.filter!.frequency.value).toBe(100)
  })

  it("reads normalised bands, and zeros while silent", async () => {
    const { mixer, contexts, preference } = await started()
    const read = mixer.bands(4)
    contexts[0]!.analyser!.level = 255
    expect(read()).toEqual([1, 1, 1, 1])
    contexts[0]!.analyser!.level = 51
    expect(read().every((v) => Math.abs(v - 0.2) < 1e-9)).toBe(true)
    preference.set("off")
    expect(read()).toEqual([0, 0, 0, 0])
    const quiet = setup().mixer.bands(3)
    expect(quiet()).toEqual([0, 0, 0])
  })

  it("is a no-op with safe answers without Web Audio", async () => {
    const preference = createSoundPreference({ storage: null })
    preference.set("on")
    const mixer = createMixer({ preference, context: null })
    expect(mixer.supported).toBe(false)
    mixer.unlock()
    expect(await mixer.load("a", "/a.mp3")).toBe(false)
    expect(mixer.play("a")).toBe(false)
    const loop = mixer.loop("a")
    loop.fade(1)
    loop.stop()
    expect(loop.volume).toBe(0)
    mixer.duck("bed")()
    mixer.muffle(true)
    expect(mixer.bands(2)()).toEqual([0, 0])
    expect(mixer.audible).toBe(false)
    mixer.toggle()
    expect(preference.state).toBe("off")
    mixer.dispose()
  })

  it("disposes: closes the context, stops what plays and stops listening", async () => {
    const { mixer, contexts, gesture, context } = await started()
    await mixer.load("pad", BUFFER)
    mixer.loop("pad")
    mixer.dispose()
    expect(contexts[0]!.close).toHaveBeenCalled()
    expect(contexts[0]!.sources[0]!.stopped).toBe(1)
    expect(mixer.supported).toBe(false)
    gesture()
    expect(context).toHaveBeenCalledTimes(1)
  })
})
