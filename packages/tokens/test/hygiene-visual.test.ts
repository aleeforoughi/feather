import { describe, expect, it } from "vitest"
import { VISUAL_RULES, scanSource } from "../../../scripts/feather-hygiene.mjs"

// Gate 1 of the visual system (docs/visual-system.md section 12): every static rule catches a probe, and leaves the
// system's own values alone.

const FILE = "packages/react/src/components/ui/probe.tsx"
const rules = (source: string, exceptions: { file: string; value: string }[] = []) => [...new Set(scanSource(FILE, source, exceptions).map((f: { rule: string }) => f.rule))].sort()
const tsx = (className: string) => `export const P = () => <div data-slot="probe" className="${className}" />`

describe("scanSource: the rules", () => {
  it.each([
    ["spacing-step", "p-3.5"],
    ["spacing-step", "gap-1.5"],
    ["spacing-step", "h-9"],
    ["spacing-step", "size-7"],
    ["spacing-step", "-mt-2.5"],
    ["spacing-step", "hover:py-14"],
    ["spacing-step", "p-0.5"],
    ["spacing-step", "translate-y-px"],
    ["spacing-step", "-mt-px"],
    ["arbitrary-value", "min-h-[44px]"],
    ["arbitrary-value", "text-[0.8rem]"],
    ["arbitrary-value", "w-[calc(100%-2px)]"],
    ["arbitrary-value", "[&_svg]:size-[18px]"],
    ["arbitrary-value", "delay-[120ms]"],
    ["transition-all", "transition-all"],
    ["transition-all", "hover:transition-all"],
    ["duration", "duration-200"],
    ["duration", "duration-[300ms]"],
    ["ease", "ease-in-out"],
    ["ease", "ease-[cubic-bezier(0.22,1,0.36,1)]"],
    ["radius-tier", "rounded-lg"],
    ["radius-tier", "rounded-t-md"],
    ["radius-tier", "rounded-2xl"],
    ["border-width", "border-2"],
    ["border-width", "border-x-4"],
    ["border-width", "border-[3px]"],
    ["border-width", "border-[var(--x)]"],
    ["shadow", "shadow-sm"],
    ["shadow", "hover:shadow-xl"],
    ["shadow", "shadow-[0_0_0_1px_red]"],
    ["font-weight", "font-light"],
    ["font-weight", "font-black"],
    ["font-weight", "font-extrabold"],
    ["opacity", "opacity-60"],
    ["opacity", "disabled:opacity-50"],
    ["slash-opacity", "text-foreground/70"],
    ["slash-opacity", "border-border/50"],
    ["slash-opacity", "hover:text-muted-foreground/80"],
    ["slash-opacity", "stroke-primary/40"],
  ])("%s catches %s", (rule, className) => {
    expect(rules(tsx(className))).toContain(rule)
  })

  it("catches transition: all in a style or a stylesheet string", () => {
    expect(rules(`export const S = { transition: "all 150ms" }`)).toContain("transition-all")
    expect(rules("const css = `.x { transition: all 1s }`")).toContain("transition-all")
    expect(rules("const css = `.x { transition-property: all }`")).toContain("transition-all")
  })

  it.each([
    "p-0 p-1 p-2 p-3 p-4 p-5 p-6 p-8 p-10 p-12 p-16 p-20 p-24 p-32",
    "gap-element gap-group h-control size-control size-icon-slot px-control p-card p-dialog",
    "w-px h-px size-px w-full h-full min-h-0 top-1/2 inset-0 -translate-y-1/2",
    "rounded-xs rounded-control rounded-card rounded-dialog rounded-full rounded-none",
    "border border-t border-x border-line-primary border-transparent",
    "shadow-none shadow-1 shadow-2 shadow-3",
    "font-normal font-medium font-semibold font-bold",
    "opacity-0 opacity-100 opacity-disabled",
    "text-sm/6 text-fg-primary text-fg-secondary bg-primary/90 hover:bg-surface-hover",
    "motion-hover motion-state ease-standard type-label type-body",
    "text-xs text-sm text-base text-lg text-xl text-2xl text-3xl text-7xl",
  ])("accepts the system's own values: %s", (className) => {
    expect(rules(tsx(className))).toEqual([])
  })

  it("reads the utility under its variants, and ignores a variant's own brackets", () => {
    expect(rules(tsx("data-[state=open]:p-4 has-[>svg]:gap-2 [&_a:not(.x)]:h-control"))).toEqual([])
    expect(rules(tsx("data-[state=open]:p-3.5"))).toEqual(["spacing-step"])
    expect(rules(tsx("[&_button:not([role=radio])]:rounded-lg"))).toEqual(["radius-tier"])
  })

  it("accepts a listed optical exception for a 0.5 step, a nudge or an arbitrary value, and nothing else", () => {
    const exceptions = [{ file: FILE, value: "p-0.5" }, { file: FILE, value: "translate-y-px" }, { file: FILE, value: "after:-inset-[14px]" }]
    expect(rules(tsx("p-0.5 translate-y-px after:-inset-[14px]"), exceptions)).toEqual([])
    // Another file, another value, or another rule is not covered.
    expect(rules(tsx("p-0.5"), [{ file: "packages/react/src/other.tsx", value: "p-0.5" }])).toEqual(["spacing-step"])
    expect(rules(tsx("p-1.5 -mt-px"), exceptions)).toEqual(["spacing-step"])
    expect(rules(tsx("rounded-lg"), [{ file: FILE, value: "rounded-lg" }])).toEqual(["radius-tier"])
  })

  it("catches a bare lucide icon with size classes or a size prop, outside Icon", () => {
    const lucide = (props: string) => `import { CheckIcon } from "lucide-react"\nexport const P = () => <CheckIcon ${props} />`
    expect(rules(lucide('className="size-4"'))).toContain("bare-icon")
    expect(rules(lucide('className="h-4 w-4 text-fg-primary"'))).toContain("bare-icon")
    expect(rules(lucide("size={16}"))).toContain("bare-icon")
    expect(rules(lucide("width={16}"))).toContain("bare-icon")
    expect(rules(lucide('className={cn("size-4", x)}'))).toContain("bare-icon")
    expect(rules(lucide('className="text-fg-primary"'))).toEqual([])
    expect(rules(lucide("data-icon"))).toEqual([])
    expect(scanSource("packages/react/src/components/ui/icon.tsx", lucide('className="size-4"'))).toEqual([])
    const renamed = `import { CheckIcon as Tick } from "lucide-react"\nexport const P = () => <Tick className="size-4" />`
    expect(rules(renamed)).toContain("bare-icon")
  })

  it("catches a part without data-slot, in components only", () => {
    expect(rules(`export const P = () => <div className="p-4" />`)).toContain("data-slot")
    expect(rules(`export const P = () => <Dialog.Close className="p-4" />`)).toContain("data-slot")
    expect(rules(`export const P = () => <div data-slot="x" className="p-4" />`)).toEqual([])
    expect(rules(`export const P = () => <svg className="p-4"><path className="p-4" /></svg>`)).toEqual([])
    expect(scanSource("packages/react/src/lib/x.tsx", `export const P = () => <div className="p-4" />`)).toEqual([])
  })

  it("catches cva variants without data-variant", () => {
    const cvaWith = (attrs: string) => `const v = cva("x", { variants: { variant: { a: "p-4" } } })\nexport const P = ({ variant }) => <div data-slot="x" ${attrs} className={v({ variant })} />`
    expect(rules(cvaWith(""))).toContain("data-variant")
    expect(rules(cvaWith("data-variant={variant}"))).toEqual([])
  })

  it("catches an animated component that never reads the theme's motion", () => {
    expect(rules(`import { motion } from "motion/react"\nexport const P = () => <motion.div data-slot="x" />`)).toContain("theme-motion")
    expect(rules(`import { motion } from "motion/react"\nimport { useThemeMotion } from "../../lib/motion"\nexport const P = () => { useThemeMotion(); return <motion.div data-slot="x" /> }`)).toEqual([])
  })

  it("ignores comments", () => {
    expect(rules(`// p-3.5 rounded-lg transition-all\n/* shadow-sm font-light */\nexport const x = 1`)).toEqual([])
  })

  it("names every rule it reports", () => {
    expect(VISUAL_RULES).toEqual(["spacing-step", "arbitrary-value", "transition-all", "duration", "ease", "radius-tier", "border-width", "shadow", "font-weight", "opacity", "slash-opacity", "bare-icon", "data-slot", "data-variant", "theme-motion"])
  })
})
