import { useEffect, useState } from "react"
import { THEME_EVENT } from "../../../.storybook/themes"

/** Changes whenever a theme is applied (the toolbar's brand switcher), so a component can read computed values again. */
export function useThemeTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    window.addEventListener(THEME_EVENT, bump)
    return () => window.removeEventListener(THEME_EVENT, bump)
  }, [])
  return tick
}

/** A custom property's computed value on the root, or "" when the current theme does not define it. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** The sRGB hex of any CSS color the browser understands (color-mix included), through a 1px canvas. */
export function toHex(color: string): string {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  if (!ctx || !color) return ""
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = "#000"
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  const hex = [r, g, b].map((v) => v!.toString(16).padStart(2, "0")).join("")
  return a === 255 ? `#${hex}`.toUpperCase() : `#${hex}`.toUpperCase() + ` @${Math.round((a! / 255) * 100)}%`
}

/** True under prefers-reduced-motion, tracked. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false))
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const on = () => setReduced(query.matches)
    query.addEventListener("change", on)
    return () => query.removeEventListener("change", on)
  }, [])
  return reduced
}
