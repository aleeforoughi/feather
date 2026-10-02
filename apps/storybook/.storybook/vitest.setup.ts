import * as a11yAnnotations from "@storybook/addon-a11y/preview"
import { setProjectAnnotations } from "@storybook/react-vite"
import axe from "axe-core"
import known from "./a11y-known.json"
import * as projectAnnotations from "./preview"

// Stories run in the reference theme named by FEATHER_THEME, and an axe violation fails the test, except for the
// accessibility debt Feather 1.7.0 carried in (a11y-known.json). A known rule is skipped by the main check, then
// checked alone: if it no longer fires, the test fails until the entry is deleted, so the list only shrinks.
const theme = import.meta.env.FEATHER_THEME as "paper-sharp" | "void-pill"
const debt = (known as unknown as Record<string, Record<string, string[]>>)[theme] ?? {}

type Context = { id: string; parameters: { a11y?: { config?: { rules?: { id: string; enabled: boolean }[] } } } }

setProjectAnnotations([
  a11yAnnotations,
  projectAnnotations,
  {
    initialGlobals: { theme },
    parameters: { a11y: { test: "error" } },
    // Let entry animations finish before axe looks: axe cannot judge the contrast of half-faded text, and reports
    // it as "needs review", not as a violation, so measuring too early hides real problems.
    async play() {
      const finite = document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity))
      await Promise.all(finite.map((a) => a.finished.catch(() => undefined)))
      await new Promise((resolve) => setTimeout(resolve, 250))
    },
    beforeEach(context: Context) {
      const rules = debt[context.id]
      if (!rules) return
      const a11y = (context.parameters.a11y ??= {})
      const config = (a11y.config ??= {})
      config.rules = [...(config.rules ?? []), ...rules.map((id) => ({ id, enabled: false }))]
    },
    async afterEach(context: Context) {
      const rules = debt[context.id]
      if (!rules) return
      const result = await axe.run(document.body, { runOnly: { type: "rule", values: rules } })
      const stale = rules.filter((rule) => !result.violations.some((v) => v.id === rule))
      if (stale.length > 0) {
        throw new Error(`${context.id} no longer breaks ${stale.join(", ")} in ${theme}: delete it from apps/storybook/.storybook/a11y-known.json`)
      }
    },
  },
])
