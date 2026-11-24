import * as React from "react"
import { cn } from "../cn"
import { useReducedMotion } from "../hooks"
import { capabilityGate, retire } from "../core/gate"
import { createWorld, deviceHints, pickQuality, type Quality, type WorldController, type WorldRenderer } from "../core/world"

export interface WorldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  renderer: WorldRenderer
  /** What shows before the first frame and wherever the canvas does not run: an image src or any node. It is never
   * the LCP element, so an image still loads lazily at normal priority. */
  still?: React.ReactNode | string
  /** Overrides the quality picked from the device. */
  quality?: Quality
  /** Stops rendering (the canvas keeps its last frame). */
  paused?: boolean
  /** The capability gate's key (default "world"): the scene runs only on devices that will run it well, and a device
   * whose quality ladder runs out is retired to the still for 30 days. `false` skips the gate. Ignored when `quality`
   * is given. */
  gate?: string | false
  /** Hands over the controller once the scene starts (null when it stops): pass `world.prewarm()` to a Loader's
   * tasks so shaders compile behind it. */
  onWorld?(world: WorldController | null): void
}

/**
 * World: the page's one canvas slot. The server and the first render show the still; after that the device picks a
 * quality tier and the brand's renderer runs on the one clock. Decorative to assistive technology.
 */
export const World = React.forwardRef<HTMLDivElement, WorldProps>(function World({ renderer, still, quality, paused = false, gate = "world", onWorld, className, ...props }, ref) {
  const reduced = useReducedMotion()
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const [picked, setPicked] = React.useState<Quality>("static")
  const [ready, setReady] = React.useState(false)
  const pausedRef = React.useRef(paused)
  const controller = React.useRef<WorldController | null>(null)
  pausedRef.current = paused

  React.useEffect(() => {
    if (quality) return setPicked(quality)
    const hints = deviceHints()
    setPicked(gate === false || capabilityGate({ key: gate, hints }).full ? pickQuality(hints) : "static")
  }, [quality, gate])
  const onWorldRef = React.useRef(onWorld)
  onWorldRef.current = onWorld

  const effective: Quality = reduced ? "static" : picked

  React.useEffect(() => {
    const el = canvas.current
    if (effective === "static" || !el) return
    const wrapped: WorldRenderer = {
      frame(frame) {
        if (pausedRef.current) return false
        const more = renderer.frame(frame)
        setReady(true)
        return more
      },
      resize: renderer.resize ? (frame) => renderer.resize?.(frame) : undefined,
      dispose: () => renderer.dispose?.(),
      levels: renderer.levels,
      setLevel: renderer.setLevel ? (level) => renderer.setLevel?.(level) : undefined,
      prewarm: renderer.prewarm ? () => renderer.prewarm?.() ?? [] : undefined,
    }
    const world = createWorld(el, wrapped, effective, undefined, { onStruggle: () => (gate === false ? undefined : retire({ key: gate })) })
    controller.current = world
    onWorldRef.current?.(world)
    return () => {
      controller.current = null
      onWorldRef.current?.(null)
      world.dispose()
      setReady(false)
    }
  }, [renderer, effective, gate])

  React.useEffect(() => {
    if (!paused) controller.current?.invalidate()
  }, [paused])

  const live = effective !== "static"
  return (
    <div ref={ref} data-slot="world" data-variant={effective} data-state={ready ? "ready" : "still"} aria-hidden="true" className={cn("relative size-full overflow-hidden", className)} {...props}>
      {still === undefined || still === null || still === false ? null : (
        <div data-slot="world-still" className={cn("absolute inset-0", ready && "invisible")}>
          {typeof still === "string" ? <img src={still} alt="" decoding="async" loading="lazy" className="size-full object-cover" data-slot="world-still-image" /> : still}
        </div>
      )}
      {live ? <canvas ref={canvas} data-slot="world-canvas" role="presentation" aria-hidden="true" className={cn("absolute inset-0 size-full motion-media", ready ? "opacity-100" : "opacity-0")} /> : null}
    </div>
  )
})
