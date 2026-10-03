// Themes for the embed: the engine builds a brand's CSS at runtime, and it is tied to the Feather roots that carry the
// theme's id (build/scope-css.ts). One <style> per theme in use, shared by the views that use it.
import { buildTheme, type BrandTokens } from "@aleeforoughi/feather-tokens"
import { scopeThemeCss } from "./scope-theme.ts"
import type { ThemeInput } from "./types.ts"

export interface ResolvedTheme {
  id: string
  dark: boolean
  /** The scoped CSS to inject, if the theme is not one the stylesheet already carries. */
  css: string | null
}

function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/** The foundation CSS is generated from feather.json and feather-dark.json, so those two need no extra style. */
export function resolveTheme(theme: ThemeInput | undefined): ResolvedTheme {
  if (theme === undefined || theme === "feather") return { id: "feather", dark: false, css: null }
  if (theme === "feather-dark") return { id: "feather-dark", dark: true, css: null }
  if (typeof theme !== "object" || theme === null) throw new TypeError(`feather-embed: theme must be "feather", "feather-dark" or a brand tokens object`)
  const built = buildTheme(theme as BrandTokens)
  if (!built.ok) throw new Error(`feather-embed: the brand tokens are not valid: ${built.problems.join("; ")}`)
  const id = `brand-${hash(JSON.stringify(theme))}`
  return { id, dark: /color-scheme:\s*dark/.test(built.css), css: scopeThemeCss(built.css, id) }
}

const styles = new Map<string, { el: HTMLStyleElement; uses: number }>()

/** Adds the theme's <style> (once) and counts the use. */
export function acquireThemeStyle(theme: ResolvedTheme) {
  if (theme.css === null) return
  const existing = styles.get(theme.id)
  if (existing) {
    existing.uses++
    return
  }
  const el = document.createElement("style")
  el.setAttribute("data-feather-theme-style", theme.id)
  el.textContent = theme.css
  document.head.appendChild(el)
  styles.set(theme.id, { el, uses: 1 })
}

/** Counts the use down and removes the <style> with the last one. */
export function releaseThemeStyle(theme: ResolvedTheme) {
  const entry = styles.get(theme.id)
  if (!entry || --entry.uses > 0) return
  entry.el.remove()
  styles.delete(theme.id)
}
