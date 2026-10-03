// Scopes a stylesheet to Feather's roots, so loading it into a page changes nothing outside them.
//
// Scoping, at build time:
//   - `:root`, `html`, `body` and `:host` become `.feather-root`; selectors that
//     are not class-led (`*`, `::before`, `button`, `[type="button"]`, `[data-density]`…) only match inside a root,
//     at the specificity of an element (`:where(.feather-root)`), so a utility class still beats them as it does in
//     Tailwind's own layers; `.dark` only counts on a root. Cascade layers are flattened (an unlayered rule in the
//     host page would otherwise beat every layered Feather rule) in the layer order the sheet declared.
//     @font-face, @property and @keyframes are untouched: they are global and harmless.
// A brand's runtime theme CSS is scoped in the browser by src/scope-theme.ts, which has no dependencies.
import postcss, { type AtRule, type ChildNode, type Container, type Rule } from "postcss"
import selectorParser from "postcss-selector-parser"

export const ROOT_CLASS = "feather-root"

interface Mode {
  /** What `:root`, `html`, `body` and `:host` become. */
  root: string
  /** Put before every selector that is not about the root, as a descendant. */
  within: string
  /** Whether class-led selectors are scoped too (a theme's, yes; the bundle's utilities, no). */
  scopeClasses: boolean
  /** Whether `.dark` is rewritten to `.feather-root.dark`. */
  dark: boolean
}

const BUNDLE: Mode = { root: `.${ROOT_CLASS}`, within: `:where(.${ROOT_CLASS})`, scopeClasses: false, dark: true }

const isRootish = (n: selectorParser.Node) =>
  (n.type === "tag" && (n.value === "html" || n.value === "body")) || (n.type === "pseudo" && (n.value === ":root" || n.value === ":host") && !n.nodes.length)

/** Splits one complex selector into compounds and combinators, each as a list of nodes. */
function parts(sel: selectorParser.Selector): Array<selectorParser.Node[]> {
  const out: Array<selectorParser.Node[]> = [[]]
  for (const n of sel.nodes) {
    if (n.type === "combinator") out.push([n], [])
    else out[out.length - 1].push(n)
  }
  return out
}

const text = (nodes: selectorParser.Node[]) => nodes.map((n) => String(n)).join("")

/** The scoped forms of one complex selector (one or two). */
function scopeSelector(raw: string, mode: Mode): string[] {
  let selector: selectorParser.Selector | undefined
  selectorParser((root) => {
    selector = root.first
  }).processSync(raw)
  if (!selector) return [raw]
  const sel = selector
  // `.dark` only counts on a Feather root. (Walks into :is(), so the `dark:` variant's `:is(.dark *)` is covered; an
  // escaped utility such as `.dark\:bg-card` is a different class and is left alone.)
  if (mode.dark) {
    sel.walkClasses((c) => {
      if (c.value === "dark") c.replaceWith(selectorParser.string({ value: `.${ROOT_CLASS}.dark` }))
    })
  }
  const groups = parts(sel)
  const first = groups[0]
  const rest = groups.slice(1).map(text).join("")

  // 1. About the root: html, body, :root, :host.
  if (first.some(isRootish)) {
    const kept = first.filter((n) => !isRootish(n))
    let tail = rest
    // `html body` and the like collapse into the one root.
    if (groups[1]?.[0]?.type === "combinator" && groups[1][0].value === " " && groups[2]?.some(isRootish)) tail = groups.slice(3).map(text).join("")
    return [(mode.root + text(kept) + tail).trim()]
  }

  // 2. Class-led selectors (the utilities, `.dark`, `.rounded-card:has(...)`) are already specific to Feather's markup.
  const classLed = first[0]?.type === "class" || first[0]?.type === "id" || first[0]?.type === "string"
  if (classLed && !mode.scopeClasses) return [(text(first) + rest).trim()]

  // 3. Everything else matches only inside a root. A compound with no tag and no class (`*`, `::before`, an attribute,
  // a pseudo-class) can be the root itself too, so it gets a second, self form.
  const full = (text(first) + rest).trim()
  const selfLike = first.every((n) => n.type === "universal" || n.type === "attribute" || n.type === "pseudo" || n.type === "nesting")
  const forms = [`${mode.within} ${full}`]
  if (selfLike) {
    const withoutUniversal = text(first.filter((n) => n.type !== "universal"))
    forms.push(`${mode.root}${withoutUniversal}${rest}`.trim())
  }
  return forms
}

function scopeSelectorList(selector: string, mode: Mode): string {
  const out: string[] = []
  selectorParser((root) => {
    root.each((s) => {
      for (const form of scopeSelector(String(s).trim(), mode)) if (!out.includes(form)) out.push(form)
    })
  }).processSync(selector)
  return out.join(", ")
}

const GLOBAL_AT_RULES = /^(-\w+-)?(keyframes|font-face|property|font-feature-values|counter-style|page)$/i

function withinGlobalAtRule(rule: Rule): boolean {
  for (let p: Container | undefined = rule.parent as Container | undefined; p; p = p.parent as Container | undefined) {
    if (p.type === "atrule" && GLOBAL_AT_RULES.test((p as AtRule).name)) return true
    if (p.type === "rule") return true // a nested rule is relative to its parent, which is scoped
  }
  return false
}

function scopeRules(root: postcss.Root, mode: Mode) {
  root.walkRules((rule) => {
    if (withinGlobalAtRule(rule)) return
    rule.selector = scopeSelectorList(rule.selector, mode)
  })
}

/** Replaces every top-level `@layer x { ... }` by its rules, in the order the sheet declared its layers. */
function flattenLayers(root: postcss.Root) {
  const order: string[] = []
  const note = (name: string) => {
    if (!order.includes(name)) order.push(name)
  }
  root.walkAtRules("layer", (at) => {
    if (at.parent !== root) return
    if (at.nodes === undefined) at.params.split(",").forEach((n) => note(n.trim()))
  })
  const rank = (layer: string | undefined) => (layer === undefined ? order.length + 1 : (note(layer), order.indexOf(layer)))
  const items: Array<{ layer: string | undefined; node: ChildNode; at: number }> = []
  let at = 0
  for (const node of [...root.nodes]) {
    if (node.type === "atrule" && node.name === "layer") {
      if (node.nodes === undefined) continue // `@layer a, b;`: the order, already read
      const layer = node.params.trim() || "anonymous"
      for (const child of node.nodes) items.push({ layer, node: child, at: at++ })
    } else if (node.type === "atrule" && node.name === "import") {
      items.push({ layer: undefined, node, at: -1 })
    } else {
      items.push({ layer: undefined, node, at: at++ })
    }
  }
  // Unlayered rules beat layered ones, so they come last; `@import` stays first.
  items.sort((a, b) => (a.at === -1 ? -1 : b.at === -1 ? 1 : rank(a.layer) - rank(b.layer) || a.at - b.at))
  root.removeAll()
  for (const { node } of items) root.append(node.clone())
}

/** The built bundle's stylesheet, scoped to `.feather-root` and without cascade layers. */
export function scopeBundleCss(css: string): string {
  const root = postcss.parse(css)
  scopeRules(root, BUNDLE)
  flattenLayers(root)
  return root.toString()
}
