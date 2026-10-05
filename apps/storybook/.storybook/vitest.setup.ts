import * as a11yAnnotations from "@storybook/addon-a11y/preview"
import { setProjectAnnotations } from "@storybook/react-vite"
import axe from "axe-core"
import { MotionGlobalConfig } from "motion/react"
import known from "./a11y-known.json"
import * as projectAnnotations from "./preview"

// Stories run in the reference theme named by FEATHER_THEME, and an axe violation fails the test, except for the
// accessibility debt Feather 1.7.0 carried in (a11y-known.json). A known rule is skipped by the main check, then
// checked alone: once axe evaluates it there and it passes, the test fails until the entry is deleted, so the list
// only shrinks.

// Animations jump to their end state. axe treats an element at opacity 0 as hidden and a half-faded one as "needs
// review", so a story measured mid-animation hides real problems; and a headless runner may throttle animation
// frames, so waiting for an animation to finish is not enough on its own.
MotionGlobalConfig.skipAnimations = true

const theme = import.meta.env.FEATHER_THEME as "paper-sharp" | "void-pill"
const debt = (known as unknown as Record<string, Record<string, string[]>>)[theme] ?? {}

type Context = { id: string; parameters: { a11y?: { config?: { rules?: { id: string; enabled: boolean }[] } } } }

setProjectAnnotations([
  a11yAnnotations,
  projectAnnotations,
  {
    initialGlobals: { theme },
    parameters: { a11y: { test: "error" } },
    // Then let the story settle: no element's opacity or transform changes across three checks, each after a real
    // animation frame (or 100 ms, if frames are paused); capped at 3 s for animations that never end.
    async play() {
      const snapshot = () =>
        Array.from(document.body.querySelectorAll("*"), (el) => {
          const style = getComputedStyle(el)
          return `${style.opacity}|${style.transform}`
        }).join(";")
      const deadline = performance.now() + 3000
      let last = snapshot()
      let stable = 0
      while (stable < 3 && performance.now() < deadline) {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 100)
          requestAnimationFrame(() => requestAnimationFrame(() => (clearTimeout(timer), resolve(undefined))))
        })
        const next = snapshot()
        stable = next === last ? stable + 1 : 0
        last = next
      }
    },
    beforeEach(context: Context) {
      const rules = debt[context.id]
      if (!rules) return
      const a11y = (context.parameters.a11y ??= {})
      const config = (a11y.config ??= {})
      config.rules = [...(config.rules ?? []), ...rules.map((id) => ({ id, enabled: false }))]
    },
    async afterEach(context: Context) {
      // A plan that asks for AAA contrast (low vision, composer rule 10) must get it: the theme's AAA block is checked
      // with axe's enhanced contrast rule (WCAG 1.4.6, 7:1) wherever a story renders one.
      const aaa = Array.from(document.querySelectorAll('[data-contrast="AAA"]'))
      if (aaa.length > 0) {
        const enhanced = await axe.run(aaa, { runOnly: { type: "rule", values: ["color-contrast-enhanced"] } })
        const failures = enhanced.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(" ")}: ${n.failureSummary?.split("\n").slice(1).join(" ")}`))
        if (failures.length > 0) throw new Error(`${context.id} asks for AAA contrast but misses 7:1 in ${theme}:\n${failures.join("\n")}`)
      }
      const rules = debt[context.id]
      if (!rules) return
      // The main check disables these rules through axe's global configuration, which this shared axe instance
      // also sees; enable them explicitly for this run. An entry is stale only when axe evaluated the rule here and it
      // passed: a rule axe could not evaluate (inapplicable, or needing review) proves nothing either way.
      const result = await axe.run(document.body, { runOnly: { type: "rule", values: rules }, rules: Object.fromEntries(rules.map((rule) => [rule, { enabled: true }])) })
      const stale = rules.filter((rule) => result.passes.some((p) => p.id === rule) && !result.violations.some((v) => v.id === rule))
      if (stale.length > 0) {
        throw new Error(`${context.id} no longer breaks ${stale.join(", ")} in ${theme}: delete it from apps/storybook/.storybook/a11y-known.json`)
      }
    },
  },
])
