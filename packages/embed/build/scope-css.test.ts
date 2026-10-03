import { describe, expect, it } from "vitest"
import { scopeThemeCss } from "../src/scope-theme.ts"
import { scopeBundleCss } from "./scope-css.ts"

const scoped = (css: string) => scopeBundleCss(css).replace(/\s+/g, " ").trim()

describe("scopeBundleCss", () => {
  it("turns :root, :host, html and body into the Feather root", () => {
    expect(scoped(":root,:host{--a:1}")).toBe(".feather-root{--a:1}")
    expect(scoped("html{font:inherit}body{margin:0}")).toBe(".feather-root{font:inherit}.feather-root{margin:0}")
    expect(scoped("html:not([data-motion=reduced]){scroll-behavior:smooth}")).toBe(".feather-root:not([data-motion=reduced]){scroll-behavior:smooth}")
  })

  it("keeps element, universal and attribute rules inside a root, at element specificity", () => {
    expect(scoped("button{font:inherit}")).toBe(":where(.feather-root) button{font:inherit}")
    expect(scoped("*,::before,::after{box-sizing:border-box}")).toBe(
      ":where(.feather-root) *, .feather-root, :where(.feather-root) ::before, .feather-root::before, :where(.feather-root) ::after, .feather-root::after{box-sizing:border-box}",
    )
    expect(scoped('[type="button"]{appearance:button}')).toBe(':where(.feather-root) [type="button"], .feather-root[type="button"]{appearance:button}')
  })

  it("leaves utilities and the radius :has() rules alone", () => {
    expect(scoped(".h-control{height:2.75rem}")).toBe(".h-control{height:2.75rem}")
    expect(scoped(".rounded-card:has(.rounded-card){--surface-extra:1}")).toBe(".rounded-card:has(.rounded-card){--surface-extra:1}")
  })

  it("makes .dark mean a dark Feather root, including the dark: variant", () => {
    expect(scoped(".dark{--a:1}")).toBe(".feather-root.dark{--a:1}")
    expect(scoped(".dark\\:bg-card:is(.dark *){color:red}")).toBe(".dark\\:bg-card:is(.feather-root.dark *){color:red}")
  })

  it("leaves @font-face, @property and @keyframes global", () => {
    const css = "@font-face{font-family:X;src:url(a.woff2)}@property --p{syntax:'<number>';inherits:false;initial-value:0}@keyframes k{from{opacity:0}to{opacity:1}}"
    expect(scoped(css)).toBe(css.replace(/'/g, "'"))
  })

  it("flattens layers in the order they were declared, unlayered rules last", () => {
    const css = "@layer theme,base,utilities;.x{a:1}@layer utilities{.u{a:2}}@layer base{h1{a:3}}@layer theme{:root{--v:1}}"
    expect(scoped(css)).toBe(".feather-root{--v:1}:where(.feather-root) h1{a:3}.u{a:2}.x{a:1}")
  })

  it("never declares a custom property on the page's own elements", () => {
    const out = scopeBundleCss(":root{--a:1}@layer base{*,:before{--tw:0}}.x{--y:1}")
    expect(out).not.toMatch(/(^|[,}\s])(:root|html|body)\b/)
    expect(out).not.toMatch(/(^|[{},])\s*\*/)
  })
})

describe("scopeThemeCss", () => {
  const theme = (css: string) => scopeThemeCss(css, "t1").replace(/\s+/g, " ").replace(/ \{/g, "{").trim()
  const root = '.feather-root.feather-root[data-feather-theme="t1"]'
  const within = '.feather-root[data-feather-theme="t1"]'

  it("ties the engine's :root:root, density, heading and component rules to the theme's roots", () => {
    expect(theme(":root:root{--primary:#000}")).toBe(`${root}{--primary:#000}`)
    expect(theme('[data-density="tight"],:root:root[data-density="tight"]{--gap:0.5rem}')).toBe(
      `${within} [data-density="tight"], ${root}[data-density="tight"]{--gap:0.5rem}`,
    )
    expect(theme(".font-heading{font-weight:600}")).toBe(`${within} .font-heading{font-weight:600}`)
    expect(theme('[data-slot="button"][data-variant="outline"]{--x:1}')).toBe(`${within} [data-slot="button"][data-variant="outline"], ${root}[data-slot="button"][data-variant="outline"]{--x:1}`)
  })
})
