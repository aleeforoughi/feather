// The proof that the gate is not vacuous. Each fixture is a small page rendered with setContent and run through the
// same runAudit as a story: one fixture per rule that violates it (and, where it matters, a way of faking compliance
// that must still be caught), and clean fixtures that must pass every rule.
import { expect, test } from "@playwright/test"
import { DURATIONS, RADIUS_TIERS } from "./expected"
import type { Density, ThemeSpec } from "./expected"
import { runAudit } from "./run"

const sharp: ThemeSpec = { name: "paper-sharp", shape: "sharp", motion: "calm", radii: RADIUS_TIERS.sharp, durations: DURATIONS.calm }
const pill: ThemeSpec = { name: "void-pill", shape: "pill", motion: "snappy", radii: RADIUS_TIERS.pill, durations: DURATIONS.snappy }

const CSS = `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0}
body{font:400 16px/24px Arial,sans-serif;background:#fff;color:#111}
.row{display:flex;align-items:center;gap:16px;padding:16px}
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 16px;border:1px solid #767676;border-radius:0;background:#fff;color:#111;font:500 14px/20px Arial,sans-serif;transition:background-color 180ms cubic-bezier(0.4,0,0.2,1)}
.btn:hover{background:#eee;transform:translateY(-1px)}
.sq{width:44px;padding:0}
.fld{width:160px}
.cb{position:relative;display:block;width:16px;height:16px;border:1px solid #767676}
.cb::after{content:"";position:absolute;inset:-15px}
svg{display:block}
:focus-visible{outline:2px solid #06f;outline-offset:2px}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{transition-duration:.01ms!important;animation-duration:.01ms!important}}
`
const ICON = '<svg class="lucide" width="20" height="20" viewBox="0 0 24 24"></svg>'
const CLEAN_ROW = `<div class="row">
  <button class="btn" data-slot="button">Save</button>
  <button class="btn" data-slot="button">Cancel</button>
  <button class="btn sq" data-slot="button" aria-label="Close">${ICON}</button>
  <input class="btn fld" data-slot="input" value="">
  <span class="cb" role="checkbox" tabindex="0" aria-checked="false" data-slot="checkbox"></span>
</div><p>Body text on the grid.</p>`
const TIGHT_ROW = `<div class="row">
  <button class="btn t" data-slot="button">Save</button>
  <button class="btn t" data-slot="button">Cancel</button>
  <button class="btn t sq" data-slot="button" aria-label="Close">${ICON}</button>
</div>`
const TIGHT_CSS = ".t{height:36px}.t::after{content:'';position:absolute;inset:-5px}.sq.t{width:36px}"

interface Case {
  name: string
  body: string
  css?: string
  theme?: ThemeSpec
  densities?: Density[]
  /** Rules the fixture must trigger. */
  fires?: string[]
  /** If set, the fixture must trigger exactly these rules and no others. */
  only?: string[]
}

const violating: Case[] = [
  { name: "targets.size: a small control next to (not behind) a modal is still a target", body: '<div class="row"><span class="cb nofx" role="checkbox" tabindex="0" aria-checked="false"></span></div><div role="dialog" aria-modal="false" style="position:absolute;left:200px;top:0;width:100px;height:40px">Panel</div>', css: ".nofx::after{content:none}", fires: ["targets.size"] },
  { name: "controls.height: a wrapped label below the control height", body: '<div class="row"><button class="btn" data-slot="button" style="height:40px;width:90px;white-space:normal;line-height:16px;font-size:14px">Launch the recommended test</button></div>', only: ["controls.height", "targets.size"], fires: ["controls.height"] },
  { name: "controls.height: a nearer data-density still decides", body: '<div class="row" data-density="tight"><button class="btn" data-slot="button">Save</button></div>', fires: ["controls.height"] },
  { name: "controls.height: 40px button", body: '<div class="row"><button class="btn" data-slot="button" style="height:40px;width:60px">X</button></div>', fires: ["controls.height"] },
  { name: "controls.height: 44px button in the tight density", body: CLEAN_ROW, densities: ["tight"], fires: ["controls.height"] },
  { name: "controls.height: size attribute pins the height", body: '<div class="row"><button class="btn" data-slot="button" data-size="lg" style="height:44px;width:60px">X</button></div>', only: ["controls.height"], fires: ["controls.height"] },
  { name: "controls.height: a native button without a data-slot is still a control", body: '<div class="row"><button class="btn" style="height:40px;width:60px">X</button></div>', fires: ["controls.height"] },
  { name: "controls.square: icon-only 60 x 44", body: `<div class="row"><button class="btn" data-slot="button" aria-label="x" style="width:60px;padding:0">${ICON}</button></div>`, only: ["controls.square"], fires: ["controls.square"] },
  { name: "controls.row: 36px next to 44px", body: '<div class="row"><button class="btn" data-slot="button" data-size="sm" style="height:36px">A</button><button class="btn" data-slot="button">B</button></div>', fires: ["controls.row"] },
  { name: "targets.size: 16px checkbox with no extended area", body: '<div class="row"><span class="cb nofx" role="checkbox" tabindex="0" aria-checked="false"></span></div>', css: ".nofx::after{content:none}", only: ["targets.size"], fires: ["targets.size"] },
  { name: "targets.size: extension with pointer-events none", body: '<div class="row"><span class="cb" role="checkbox" tabindex="0" aria-checked="false"></span></div>', css: ".cb::after{pointer-events:none}", only: ["targets.size"], fires: ["targets.size"] },
  { name: "targets.size: extension clipped by overflow hidden", body: '<div class="row"><span class="cb" role="checkbox" tabindex="0" aria-checked="false" style="overflow:hidden"></span></div>', only: ["targets.size"], fires: ["targets.size"] },
  { name: "targets.size: extension covered by another element", body: '<div class="row"><span class="cb" role="checkbox" tabindex="0" aria-checked="false"></span></div><div style="position:absolute;z-index:9;left:0;top:0;width:100%;height:100%"></div>', fires: ["targets.size"] },
  { name: "targets.size: 36px button, extension too small", body: TIGHT_ROW, css: TIGHT_CSS + ".t::after{inset:-2px}", densities: ["tight"], fires: ["targets.size"] },
  { name: "targets.size: a text field below the density's control height", body: '<div class="row"><input class="btn fld" data-slot="input" style="height:32px" value=""></div>', densities: ["tight"], only: ["targets.size", "controls.height"], fires: ["targets.size"] },
  { name: "borders.width: 2px border", body: '<div class="row"><div style="border:2px solid #111;width:40px;height:40px"></div></div>', only: ["borders.width"], fires: ["borders.width"] },
  { name: "focus.ring: 1px outline", body: CLEAN_ROW, css: ":focus-visible{outline-width:1px}", fires: ["focus.ring"] },
  { name: "focus.ring: 3px ring in box-shadow", body: CLEAN_ROW, css: ":focus-visible{outline:none;box-shadow:0 0 0 3px #06f}", fires: ["focus.ring"] },
  { name: "focus.ring: outline offset 0", body: CLEAN_ROW, css: ":focus-visible{outline-offset:0}", fires: ["focus.ring"] },
  { name: "focus.ring: no ring at all", body: CLEAN_ROW, css: ":focus-visible{outline:none}", fires: ["focus.ring"] },
  { name: "shift.hover: padding grows on hover", body: CLEAN_ROW, css: ".btn:hover{padding:0 24px}", fires: ["shift.hover"] },
  { name: "shift.focus: margin appears on focus", body: CLEAN_ROW, css: ".btn:focus-visible{margin-right:8px}", fires: ["shift.focus"] },
  { name: "type.size: 13px", body: '<p style="font-size:13px;line-height:20px">Text</p>', only: ["type.size"], fires: ["type.size"] },
  { name: "type.weight: 300", body: '<p style="font-weight:300">Text</p>', only: ["type.weight"], fires: ["type.weight"] },
  { name: "type.line-height: 22px", body: '<p style="line-height:22px">Text</p>', only: ["type.line-height"], fires: ["type.line-height"] },
  { name: "type.line-height: normal on text", body: '<p style="line-height:normal">Text</p>', fires: ["type.line-height"] },
  { name: "radius.tier: 6px in a sharp theme", body: '<div class="row"><div style="border:1px solid #111;border-radius:6px;width:40px;height:40px"></div></div>', only: ["radius.tier"], fires: ["radius.tier"] },
  { name: "radius.tier: 4px in a sharp theme", body: '<div class="row"><div style="border:1px solid #111;border-radius:4px;width:40px;height:40px"></div></div>', only: ["radius.tier"], fires: ["radius.tier"] },
  { name: "radius.tier: 12px in a pill theme", body: '<div class="row"><div style="border:1px solid #111;border-radius:12px;width:40px;height:40px"></div></div>', theme: pill, only: ["radius.tier"], fires: ["radius.tier"] },
  { name: "radius.nesting: 16px child flush in a 4px parent", body: '<div class="row"><div style="border:1px solid #111;border-radius:4px;width:100px;height:100px"><div style="width:100%;height:100%;border-radius:16px;background:#ddd"></div></div></div>', theme: pill, only: ["radius.nesting"], fires: ["radius.nesting"] },
  { name: "icons.size: 18px icon", body: '<div class="row"><svg class="lucide" width="18" height="18" viewBox="0 0 24 24"></svg></div>', only: ["icons.size"], fires: ["icons.size"] },
  { name: "icons.size: data-slot=icon at 22px", body: '<div class="row"><svg data-slot="icon" width="22" height="22" viewBox="0 0 24 24"></svg></div>', only: ["icons.size"], fires: ["icons.size"] },
  { name: "pixels.whole: bordered box at x 10.5", body: '<div style="position:absolute;left:10.5px;top:10px;width:40px;height:40px;border:1px solid #111"></div>', only: ["pixels.whole"], fires: ["pixels.whole"] },
  { name: "pixels.whole: bordered box with height 40.5", body: '<div style="margin:16px;width:40px;height:40.5px;border:1px solid #111"></div>', only: ["pixels.whole"], fires: ["pixels.whole"] },
  { name: "motion.all: transition all", body: CLEAN_ROW, css: ".btn{transition:all 180ms cubic-bezier(0.4,0,0.2,1)}", fires: ["motion.all"] },
  { name: "motion.curve: ease", body: CLEAN_ROW, css: ".btn{transition:background-color 180ms ease}", fires: ["motion.curve"] },
  { name: "motion.duration: 200ms", body: CLEAN_ROW, css: ".btn{transition:background-color 200ms cubic-bezier(0.4,0,0.2,1)}", fires: ["motion.duration"] },
  { name: "motion.duration: 420ms is calm only", body: CLEAN_ROW, css: ".btn{transition:background-color 420ms cubic-bezier(0.4,0,0.2,1)}", theme: pill, fires: ["motion.duration"] },
  { name: "motion.duration: a pseudo-element transition", body: CLEAN_ROW, css: ".cb::after{transition:opacity 333ms cubic-bezier(0.4,0,0.2,1)}", fires: ["motion.duration"] },
  { name: "motion.reduced: no reduced-motion override", body: CLEAN_ROW, css: "@media (prefers-reduced-motion: reduce){*,*::before,*::after{transition-duration:180ms!important}}", fires: ["motion.reduced"] },
  { name: "motion.reduced: an animation survives", body: CLEAN_ROW, css: "@keyframes k{from{opacity:.9}to{opacity:1}}.btn{animation:k 1s}@media (prefers-reduced-motion: reduce){.btn{animation-duration:1s!important}}", fires: ["motion.reduced"] },
]

const clean: Case[] = [
  { name: "clean: a fixed-position element in a scrolled story is not a hover shift", body: '<div class="row"><button class="btn" data-slot="button">Save</button></div><div style="height:1400px"></div><input type="radio" aria-hidden="true" tabindex="-1" style="position:fixed;top:0;left:0;width:20px;height:20px;opacity:0;pointer-events:none"><div class="row"><button class="btn" data-slot="button">Lower</button></div>' },
  { name: "clean: a small control behind an open modal dialog is not a target", body: '<div class="row"><span class="cb nofx" role="checkbox" tabindex="-1" aria-checked="false"></span></div><div role="dialog" aria-modal="true" style="position:absolute;inset:40px;background:#fff"><p>Dialog</p></div>', css: ".nofx::after{content:none}" },
  { name: "clean: a box inside a hidden ancestor never counts as a hover shift", body: '<div class="row"><button class="btn" data-slot="button">Save</button></div><div style="height:1400px"></div><div style="display:none"><div class="sb-loader" style="height:20px"></div></div>' },
  { name: "clean: a wrapped label grows the control instead of clipping", body: '<div class="row"><button class="btn" data-slot="button" style="height:64px;width:120px;white-space:normal">Launch the recommended test now</button></div>' },
  { name: "clean: a plan's own data-density overrides the page's", body: '<div class="row" data-density="default"><button class="btn" data-slot="button">Save</button></div>', densities: ["tight"] },
  { name: "clean: a display:none element is not a shift, even after scroll", body: '<div class="row"><button class="btn" data-slot="button">Save</button></div><div style="height:1400px"></div><div style="display:none" class="sb-preparing-story"></div>' },
  { name: "clean: every control, default density, sharp theme", body: CLEAN_ROW },
  { name: "clean: every control, default density, pill theme (snappy)", body: CLEAN_ROW, theme: pill, css: ".btn{border-radius:16px}" },
  { name: "clean: 36px controls with a 5px extended hit area, tight density", body: TIGHT_ROW, css: TIGHT_CSS, densities: ["tight"] },
  { name: "clean: a 36px text field is its own target at tight density", body: '<div class="row"><input class="btn fld t" data-slot="input" value=""></div>', css: TIGHT_CSS, densities: ["tight"] },
  { name: "clean: 52px controls, spacious density", body: CLEAN_ROW.replaceAll('class="btn', 'class="btn s').replace('class="cb', 'class="cb'), css: ".s{height:52px}.sq.s{width:52px}", densities: ["spacious"] },
  { name: "clean: a 2px box-shadow ring is an equivalent focus ring", body: CLEAN_ROW, css: ":focus-visible{outline:none;box-shadow:0 0 0 2px #06f}" },
  { name: "clean: a gapped ring (2px gap, 2px ring) is equivalent", body: CLEAN_ROW, css: ":focus-visible{outline:none;box-shadow:0 0 0 2px #fff,0 0 0 4px #06f}" },
  { name: "clean: nested radius, 4px child inside a 16px parent (pill)", body: '<div class="row"><div style="border:1px solid #111;border-radius:16px;width:100px;height:100px"><div style="width:100%;height:100%;border-radius:4px;background:#ddd"></div></div></div>', theme: pill },
  { name: "clean: full radius is allowed everywhere", body: '<div class="row"><div style="border:1px solid #111;border-radius:9999px;width:40px;height:40px"></div><div style="border:1px solid #111;border-radius:50%;width:40px;height:40px"></div></div>' },
]

for (const c of [...violating, ...clean]) {
  test(c.name, async ({ page }) => {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${c.css ?? ""}</style></head><body><div id="storybook-root">${c.body}</div></body></html>`)
    const rows = await runAudit(page, { story: "selftest", theme: c.theme ?? sharp, densities: c.densities ?? ["default"], settleMs: 50 })
    const rules = [...new Set(rows.map((r) => r.rule))].sort()
    const detail = rows.map((r) => `${r.rule} ${r.slot} ${r.selector}: expected ${r.expected}, actual ${r.actual}`).join("\n")
    if (!c.fires) {
      expect(rows.length, `a clean fixture must pass every rule:\n${detail}`).toBe(0)
      return
    }
    for (const rule of c.fires) expect(rules, `rule ${rule} must fire:\n${detail}`).toContain(rule)
    if (c.only) expect(rules, `only ${c.only.join(", ")} may fire:\n${detail}`).toEqual([...c.only].sort())
  })
}
