// A brand's runtime theme CSS, tied to the Feather roots that carry its id. No dependencies: it runs in the page.
//
// The engine (packages/tokens/src/engine.mjs) writes a small, regular stylesheet: flat rules, no at-rules, no nesting,
// no commas inside a selector: `:root:root{...}`, `[data-density="x"],:root:root[data-density="x"]{...}`, `.font-heading{...}`
// and `[data-slot="x"][data-variant="y"]{...}`. Each selector becomes a rule about the roots of this theme:
//   :root:root...   ->  .feather-root.feather-root[data-feather-theme="id"]...
//   anything else   ->  .feather-root[data-feather-theme="id"] <selector>   (and, for an attribute-led selector, also
//                       the root itself carrying the attribute)
// The doubled class keeps the theme's specificity above the bundle's, as the engine's unlayered CSS beat Tailwind's layers.
export function scopeThemeCss(css: string, id: string): string {
  const theme = `[data-feather-theme="${id}"]`
  const root = `.feather-root.feather-root${theme}`
  const within = `.feather-root${theme}`
  const forms = (selector: string): string[] => {
    const sel = selector.trim()
    if (sel.startsWith(":root:root")) return [root + sel.slice(":root:root".length)]
    if (sel.startsWith(":root")) return [root + sel.slice(":root".length)]
    return sel.startsWith("[") ? [`${within} ${sel}`, `${root}${sel}`] : [`${within} ${sel}`]
  }
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/([^{}]+)\{([^{}]*)\}/g, (_all, selectors: string, body: string) => {
      const out: string[] = []
      for (const sel of selectors.split(",")) for (const f of forms(sel)) if (!out.includes(f)) out.push(f)
      return `${out.join(",\n")} {${body}}`
    })
    .trim()
}
