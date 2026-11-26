import * as React from "react"
import { cn } from "../cn"
import { clock } from "../core/clock"
import { scrollProgress } from "../core/scroll"
import { fitRect, loadSequence, nearestLoaded, stepToward, type SequenceLoad } from "../core/sequence"
import { onVisibilityChange } from "../core/visibility"
import { cappedPixelRatio, prefersSaveData as saveData } from "../core/world"
import { useMergedRef, useReducedMotion } from "../hooks"
import { useLoudnessAllows } from "./loudness"

/** Below this width the lighter frame set is used (Henrietta Said: a separate set under 768px). */
export const SEQUENCE_SMALL_BELOW = 768

export interface ImageSequenceProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /** The frames, in order: AVIF or WebP URLs (60 to 150 is the measured range). */
  frames: string[]
  /** A lighter set for phones, used below 768px. */
  framesSmall?: string[]
  /** What no script, reduced motion, data saver and the first paint show: a real image, never an empty frame. */
  poster: string
  /** Describes the sequence (the poster carries it; the canvas is decorative). */
  alt: string
  /** Pin length in viewport heights, 1 to 4 (1: the sequence plays as the section passes, with no pin). */
  length?: number
  /** How a frame fills the frame: cropped from the centre, or whole. */
  fit?: "cover" | "contain"
}

const matches = (query: string) => typeof window.matchMedia === "function" && window.matchMedia(query).matches

/**
 * ImageSequence: a canvas that scrubs through frames as the section scrolls (the product-page technique). The poster
 * renders first and stays for everyone the sequence does not run for. Frames load after the page has, near the
 * viewport, at low priority, two at a time: first and last, then midpoints, so the nearest loaded frame is always
 * close. The shown frame eases toward the scroll position (lerp 0.08) on the one clock, draws only when it changes,
 * and stops off screen and in a hidden tab. The canvas's pixel ratio is capped by the pixel budget.
 */
export const ImageSequence = React.forwardRef<HTMLElement, ImageSequenceProps>(function ImageSequence({ frames, framesSmall, poster, alt, length = 2, fit = "cover", className, ...props }, forwarded) {
  const root = React.useRef<HTMLElement>(null)
  const track = React.useRef<HTMLDivElement>(null)
  const box = React.useRef<HTMLDivElement>(null)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const ref = useMergedRef(forwarded, root)
  // The poster stays under reduced motion and where the loudness does not allow scrubbing (below 2).
  const motionReduced = useReducedMotion(root)
  const scrollAllowed = useLoudnessAllows(root, "scroll")
  const reduced = motionReduced || !scrollAllowed
  const [saving, setSaving] = React.useState(true)
  const [ready, setReady] = React.useState(false)
  const pin = Math.min(4, Math.max(1, Number.isFinite(length) ? length : 2))
  const live = !reduced && !saving && frames.length > 1

  React.useEffect(() => setSaving(saveData()), [])

  // The sequence's set, keyed so a new array with the same frames does not restart it.
  const key = `${frames.join("\n")}\u0000${(framesSmall ?? []).join("\n")}`
  React.useEffect(() => {
    const el = track.current
    const frame = box.current
    const cv = canvas.current
    if (!live || !el || !frame || !cv) return
    const small = framesSmall && framesSmall.length > 1 && matches(`(max-width: ${SEQUENCE_SMALL_BELOW - 1}px)`)
    const urls = small ? framesSmall : frames
    const last = urls.length - 1
    const quality = matches("(pointer: coarse)") ? "medium" : "high"
    const ctx = cv.getContext("2d")
    const pinned = pin > 1
    const controller = new AbortController()
    let run: SequenceLoad<HTMLImageElement> | null = null
    let shown = scrollProgress(el, pinned) * last
    let drawn = -1
    let visible = true
    let remove: (() => void) | null = null

    const draw = (index: number) => {
      const img = run?.frames.get(index)
      if (!img || !ctx) return
      const r = fitRect(img.naturalWidth, img.naturalHeight, cv.width, cv.height, fit)
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.drawImage(img, r.x, r.y, r.width, r.height)
      drawn = index
      setReady(true)
    }
    const tick = (_time: number, delta: number) => {
      const target = scrollProgress(el, pinned) * last
      shown = stepToward(shown, target, delta)
      const index = run ? nearestLoaded(shown, run.loaded) : -1
      if (index >= 0 && index !== drawn) draw(index)
      if (shown === target) sleep()
    }
    const sleep = () => {
      remove?.()
      remove = null
    }
    const wake = () => {
      if (!remove && visible && !document.hidden) remove = clock.add(tick)
    }
    const resize = () => {
      const r = frame.getBoundingClientRect()
      const ratio = cappedPixelRatio(quality, undefined, r.width, r.height)
      cv.width = Math.max(1, Math.round(r.width * ratio))
      cv.height = Math.max(1, Math.round(r.height * ratio))
      drawn = -1
      wake()
    }
    let loadedPage = document.readyState === "complete"
    let near = typeof IntersectionObserver === "undefined"
    const start = () => {
      if (run || !loadedPage || !near) return
      run = loadSequence(urls, { signal: controller.signal, onFrame: wake })
    }
    const onLoad = () => {
      loadedPage = true
      start()
    }
    if (!loadedPage) window.addEventListener("load", onLoad, { once: true })
    // Within half a viewport: frames start loading, and drawing runs. Further away, nothing runs.
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              visible = entries.some((e) => e.isIntersecting)
              if (visible) {
                near = true
                start()
                wake()
              } else sleep()
            },
            { rootMargin: "50% 0px" }
          )
    observer?.observe(el)
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize)
    sizes?.observe(frame)
    const offVisibility = onVisibilityChange((hidden) => (hidden ? sleep() : wake()))
    window.addEventListener("scroll", wake, { passive: true })
    window.addEventListener("resize", resize, { passive: true })
    resize()
    start()
    return () => {
      controller.abort()
      sleep()
      observer?.disconnect()
      sizes?.disconnect()
      offVisibility()
      window.removeEventListener("load", onLoad)
      window.removeEventListener("scroll", wake)
      window.removeEventListener("resize", resize)
      setReady(false)
    }
    // `key` stands for frames and framesSmall.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, key, pin, fit])

  const fitClass = fit === "contain" ? "object-contain" : "object-cover"
  if (!live) {
    return (
      <section ref={ref} data-slot="image-sequence" data-variant="poster" data-state="static" className={cn("relative w-full", className)} {...props}>
        <div ref={box} data-slot="image-sequence-frame" className="relative w-full overflow-hidden">
          <img data-slot="image-sequence-poster" src={poster} alt={alt} decoding="async" className={cn("block h-auto w-full", fitClass)} />
        </div>
      </section>
    )
  }
  return (
    <section ref={ref} data-slot="image-sequence" data-variant="scrubbed" data-state={ready ? "ready" : "loading"} className={cn("relative w-full", className)} {...props}>
      <div ref={track} data-slot="image-sequence-track" style={{ height: `${pin * 100}vh` }}>
        <div ref={box} data-slot="image-sequence-frame" className={cn("w-full overflow-clip", pin > 1 ? "sticky top-0 h-dvh" : "relative h-dvh")}>
          <img data-slot="image-sequence-poster" src={poster} alt={alt} decoding="async" className={cn("absolute inset-0 size-full", fitClass)} />
          <canvas ref={canvas} data-slot="image-sequence-canvas" aria-hidden="true" className={cn("absolute inset-0 size-full motion-media", ready ? "opacity-100" : "opacity-0")} />
        </div>
      </div>
    </section>
  )
})
