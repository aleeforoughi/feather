// Image sequences: the product-page technique, frames drawn to a canvas as a section scrolls (Qooler file 27 §2 E20
// and §7/§8: Scout Motors, Henrietta Said, Farm Minerals, ZIRKA). Feather takes the winners' values, never their code:
// the first and last frames load first, then midpoints breadth-first, so a coarse version of the whole scrub exists
// early and sharpens; two requests at a time, at low priority, after the page has loaded; the nearest loaded frame is
// drawn meanwhile; and the shown frame eases toward its target, lerp 0.08 per 60fps frame, on the one clock.
//
// Framework-free and DOM-free at import time: the default image loader touches `Image` only when called.

/** How far the shown frame moves toward its target each 60fps frame (Henrietta Said: 0.08). */
export const SEQUENCE_LERP = 0.08
/** Requests in flight at once: frames never crowd out the page's own images, fonts and styles. */
export const SEQUENCE_CONCURRENCY = 2

/**
 * The order frames load in: the first, the last, then the midpoints of every gap, breadth-first, so each pass halves
 * the largest gap. `loadOrder(9)` is `[0, 8, 4, 2, 6, 1, 3, 5, 7]`. Every index appears exactly once.
 */
export function loadOrder(n: number): number[] {
  const count = Math.max(0, Math.floor(n))
  if (count === 0) return []
  if (count === 1) return [0]
  const order = [0, count - 1]
  const gaps: Array<[number, number]> = [[0, count - 1]]
  for (let head = 0; head < gaps.length; head++) {
    const [a, b] = gaps[head]
    if (b - a < 2) continue
    const mid = Math.floor((a + b) / 2)
    order.push(mid)
    gaps.push([a, mid], [mid, b])
  }
  return order
}

/**
 * The loaded frame nearest to `target` (which may be fractional), or -1 when nothing has loaded. On a tie the lower
 * index wins, so the answer never depends on the order frames arrived in.
 */
export function nearestLoaded(target: number, loaded: ReadonlySet<number>): number {
  let best = -1
  let distance = Infinity
  for (const index of loaded) {
    const d = Math.abs(index - target)
    if (d < distance || (d === distance && index < best)) {
      best = index
      distance = d
    }
  }
  return best
}

/**
 * Moves `current` toward `target` by the sequence lerp, frame-rate independent: at 60fps each frame closes 8% of the
 * gap, at 120fps each closes the same share per 1/60s. It lands exactly once within 0.01 of a frame.
 */
export function stepToward(current: number, target: number, deltaMs: number, lerp = SEQUENCE_LERP): number {
  const share = 1 - Math.pow(1 - Math.min(1, Math.max(0, lerp)), Math.max(0, deltaMs) / (1000 / 60))
  const next = current + (target - current) * share
  return Math.abs(target - next) < 0.01 ? target : next
}

export interface FitRect {
  x: number
  y: number
  width: number
  height: number
}

/** Where a `sw`×`sh` image lands in a `dw`×`dh` box: `cover` fills and crops from the centre, `contain` fits whole. */
export function fitRect(sw: number, sh: number, dw: number, dh: number, fit: "cover" | "contain" = "cover"): FitRect {
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return { x: 0, y: 0, width: dw, height: dh }
  const scale = fit === "cover" ? Math.max(dw / sw, dh / sh) : Math.min(dw / sw, dh / sh)
  const width = sw * scale
  const height = sh * scale
  return { x: (dw - width) / 2, y: (dh - height) / 2, width, height }
}

/** Loads one frame. Rejects when aborted, and the request is dropped. */
export type FrameLoad<T> = (url: string, signal: AbortSignal) => Promise<T>

/** The browser loader: an `Image` at low fetch priority, decoded off the main thread before it is handed over. */
export function loadImage(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const img = new Image()
    img.decoding = "async"
    img.setAttribute("fetchpriority", "low")
    const abort = () => {
      img.src = ""
      reject(signal.reason)
    }
    signal.addEventListener("abort", abort, { once: true })
    const settle = (ok: boolean) => {
      signal.removeEventListener("abort", abort)
      if (signal.aborted) return
      if (ok) resolve(img)
      else reject(new Error(`frame failed: ${url}`))
    }
    img.onload = () => {
      if (typeof img.decode === "function") img.decode().then(() => settle(true), () => settle(true))
      else settle(true)
    }
    img.onerror = () => settle(false)
    img.src = url
  })
}

export interface SequenceLoadOptions<T> {
  /** Requests at once; default 2. */
  concurrency?: number
  /** Aborts every pending and in-flight request. */
  signal?: AbortSignal
  /** The order to request frames in; default `loadOrder(urls.length)`. */
  order?: readonly number[]
  /** Loads one frame; default `loadImage`. */
  load?: FrameLoad<T>
  /** Called as each frame arrives, in arrival order. */
  onFrame?(index: number, frame: T): void
}

export interface SequenceLoad<T> {
  /** The frames that have arrived, by index. */
  readonly frames: ReadonlyMap<number, T>
  /** Their indices (what `nearestLoaded` takes). */
  readonly loaded: ReadonlySet<number>
  /** Settles when every frame has arrived or failed, or the load was aborted. Never rejects. */
  readonly done: Promise<void>
}

/** Loads a sequence's frames in order with a concurrency limit. A frame that fails is skipped: the nearest loaded
 * frame stands in for it. */
export function loadSequence<T = HTMLImageElement>(urls: readonly string[], options: SequenceLoadOptions<T> = {}): SequenceLoad<T> {
  const { concurrency = SEQUENCE_CONCURRENCY, signal, onFrame } = options
  const load = (options.load ?? (loadImage as unknown as FrameLoad<T>))
  const order = (options.order ?? loadOrder(urls.length)).filter((i) => i >= 0 && i < urls.length)
  const frames = new Map<number, T>()
  const loaded = new Set<number>()
  const local = new AbortController()
  const stop = () => local.abort(signal?.reason)
  if (signal?.aborted) stop()
  else signal?.addEventListener("abort", stop, { once: true })

  let next = 0
  const worker = async () => {
    while (!local.signal.aborted && next < order.length) {
      const index = order[next++]
      try {
        const frame = await load(urls[index], local.signal)
        if (local.signal.aborted) return
        frames.set(index, frame)
        loaded.add(index)
        onFrame?.(index, frame)
      } catch {
        // Skipped (failed or aborted).
      }
    }
  }
  const lanes = Math.max(1, Math.min(Math.floor(concurrency) || 1, order.length))
  const done = Promise.all(Array.from({ length: order.length ? lanes : 0 }, worker)).then(() => {
    signal?.removeEventListener("abort", stop)
  })
  return { frames, loaded, done }
}
