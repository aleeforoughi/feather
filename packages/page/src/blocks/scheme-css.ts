// The page's colour scheme (feather.page/1 `scheme`, wave 5): light, dark and system, with the system's
// `prefers-color-scheme` first. The brand's tokens are one set; `scheme.colors` is its other set, compiled by the
// same theme engine. Both are in the head as CSS: the system's preference picks between them with no script, a
// person's choice is `data-scheme` on <html>, and a tiny inline script (schemeScript, which `feather-page build` writes
// into the head) sets that before the first paint, so a returning visitor never sees the wrong scheme flash. This
// module is the CSS side, which every page's head needs; the toggle (scheme.tsx) comes with the flows family.

export type SchemeChoice = "light" | "dark" | "system"
/** Where the choice is remembered (one for the whole site: it is the person's, not the page's). */
export const SCHEME_KEY = "feather-scheme"

/** The inline script that applies a remembered choice before the first paint. Safe everywhere: storage may be off. */
export function schemeScript(): string {
  return `try{var s=localStorage.getItem(${JSON.stringify(SCHEME_KEY)});if(s==="light"||s==="dark")document.documentElement.setAttribute("data-scheme",s)}catch(e){}`
}

/** The variables block of a compiled theme (`:root:root { … }`), without its selector. */
const varsOf = (css: string): string | null => /:root:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? null

/** Whether a compiled theme is dark (the engine writes its `color-scheme`). */
export const isDarkTheme = (css: string): boolean => /color-scheme:\s*dark/.test(css)

/**
 * The CSS that puts the other set under the brand's: when the system prefers the other scheme and the person has not
 * chosen the brand's own, and whenever the person chooses the other. The selectors outrank the brand's `:root:root`.
 */
export function schemeCss(brandCss: string, otherCss: string): string | null {
  const vars = varsOf(otherCss)
  if (!vars) return null
  const own = isDarkTheme(brandCss) ? "dark" : "light"
  const other = own === "dark" ? "light" : "dark"
  // While the scheme changes, nothing transitions: every colour moves at once, so no frame mixes the two sets and
  // drops below its contrast floor.
  return `/* The other colour scheme (feather.page/1 scheme). */\n@media (prefers-color-scheme: ${other}) {\n  :root:root:not([data-scheme="${own}"]) {${vars}\n  }\n}\n:root:root[data-scheme="${other}"] {${vars}\n}\n:root[data-scheme-switching] *,\n:root[data-scheme-switching] *::before,\n:root[data-scheme-switching] *::after {\n  transition: none !important;\n}\n`
}

