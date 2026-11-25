// The knobs of feather.page/1 (wave 2), as rendering: a block's knobs become its Section's props, a few scoped
// semantic tokens, and the title's size and effect. A block with no knobs gets exactly the props it had in /0, so a
// /0 page renders byte for byte as it did. Every colour stays a token: a tone re-points the semantic roles
// (--surface-base, --text-primary, …) inside the section, it never writes a colour.
import * as React from "react"
import { DisplayTitle, HOUSE, allows, loudnessOf, reveal, type DisplayEffect, type DisplaySize, type MediaTreatment, type SectionSpace, type SectionTone } from "@aleeforoughi/feather-expression"
import { BLOCK_RANGE, KINETIC_ENTERS, SECONDARY_INK } from "../core/spec"
import type { BlockAlign, BlockCrop, BlockMotion, BlockScale, BlockTone, Knobs, PageDefaults, PageLayout } from "../core/types"
import { BlockTitle, join } from "./shared"

/** What a block may know about the page around it: the page's defaults, and the index of its sections (the index
 * hero lists them). FeatherPage provides it; a block rendered alone sees none. */
export interface PageContextValue {
  defaults?: PageDefaults
  /** The page's layout: a two-colour page gives its images the duotone treatment unless they name another. */
  layout?: PageLayout
  index?: { id: string; title: string }[]
}
export const PageContext = React.createContext<PageContextValue>({})

type Vars = Record<`--${string}`, string>

/** A ground and its ink, as the semantic roles inside the section: everything in it (titles, secondary text, rules,
 * raised cards, the primary act and the focus ring) reads on the new ground. */
function scope(ground: string, ink: string): Vars {
  return {
    "--surface-base": ground,
    "--surface-subtle": `color-mix(in oklab, ${ink} 6%, ${ground})`,
    "--surface-raised": `color-mix(in oklab, ${ink} 10%, ${ground})`,
    "--surface-hover": `color-mix(in oklab, ${ink} 14%, ${ground})`,
    "--text-primary": ink,
    "--text-secondary": `color-mix(in oklab, ${ink} ${SECONDARY_INK}%, ${ground})`,
    "--border-primary": `color-mix(in oklab, ${ink} 28%, ${ground})`,
    "--primary": ink,
    "--primary-foreground": ground,
    "--ring": ink,
  }
}

/** The scoped roles of a tone; base, subtle and raised are Section's own. block-N is the brand's colour block
 * (feather-tokens/4 --block-N and --block-N-ink, the pair bg-block-N and text-block-N-ink paint): the section's
 * surface and every ink in it are re-pointed at the pair, so its titles, rules and acts all read on it. */
export function toneVars(tone: BlockTone | undefined): Vars | undefined {
  if (tone === "inverse") return scope("var(--surface-inverse)", "var(--text-inverse)")
  const n = tone?.startsWith("block-") ? tone.slice(6) : null
  return n ? scope(`var(--block-${n})`, `var(--block-${n}-ink)`) : undefined
}

const STAGGER = { none: 0, tight: 0.5, default: 1, loose: 1.5 } as const

/** motion.intensity, direction and stagger as the expression layer's own variables, read where the reveal runs.
 * Intensity scales the travel (never the duration); down travels from above; stagger scales the step, and the 1.2s
 * sequence cap still holds. */
export function motionVars(m: BlockMotion | undefined): Vars | undefined {
  if (!m) return undefined
  const vars: Vars = {}
  if (m.intensity !== undefined || m.direction === "down") {
    const travel = Math.max(0.01, HOUSE.revealDistance * (m.intensity ?? 1))
    vars["--distance-reveal"] = `${m.direction === "down" ? -travel : travel}px`
  }
  if (m.stagger && m.stagger !== "default") {
    vars["--stagger-word"] = `${Math.round(HOUSE.staggerWord * STAGGER[m.stagger])}ms`
    vars["--stagger-block"] = `${Math.round(HOUSE.staggerBlock * STAGGER[m.stagger])}ms`
  }
  return Object.keys(vars).length ? vars : undefined
}

/** The title's effect: a kinetic enter, else the house rise. DisplayTitle itself falls back to rise below loudness 2. */
export function titleEffect(m: BlockMotion | undefined, fallback: DisplayEffect = "rise"): DisplayEffect {
  const enter = m?.enter
  return enter && (KINETIC_ENTERS as readonly string[]).includes(enter) ? (enter as DisplayEffect) : fallback
}

/** none and fade hold the title still (the block itself fades, or is simply there). */
const stillTitle = (m: BlockMotion | undefined) => m?.enter === "none" || m?.enter === "fade"

export interface ResolvedKnobs<V extends string> {
  /** The variant, or the block's default (its first, today's rendering). */
  variant: V
  /** The variant as written (undefined: the block has none). */
  named: V | undefined
  align: BlockAlign
  scale: BlockScale | undefined
  crop: BlockCrop
  /** Section props: only what a knob set, so a block with none renders as /0 did. */
  section: {
    space: SectionSpace
    tone: SectionTone
    reveal?: boolean
    style?: React.CSSProperties
    "data-loudness"?: string
    "data-tone"?: string
    "data-block-variant"?: string
    "data-surface"?: string
    ref?: React.Ref<HTMLElement>
  }
  /** The image treatment every MediaFrame of the block takes (clean when none is set). */
  treatment: MediaTreatment
  /** Props for the block's DisplayTitle: its effect and, for none or fade, a still title. */
  title: { effect: DisplayEffect; "data-loudness"?: string }
  /** True when the block sets any knob at all (a /1 block). */
  any: boolean
}

const KNOB_KEYS = ["variant", "loudness", "tone", "space", "align", "scale", "crop", "motion", "scroll", "treatment"] as const

/** Reads a block's knobs, with the page's defaults under them. `fallback` is the block's /0 space and tone. */
export function useKnobs<V extends string>(kind: string, block: Knobs & { variant?: string }, fallback: { space: SectionSpace; tone?: SectionTone }): ResolvedKnobs<V> {
  const page = React.useContext(PageContext)
  const ref = React.useRef<HTMLElement>(null)
  const range = BLOCK_RANGE[kind]
  const d = page.defaults ?? {}
  // A block on a page with defaults takes them too, so it leaves its /0 path.
  // signature's variant is the brand's own name (a /0 field), not a knob.
  const keys = range.variants ? KNOB_KEYS : KNOB_KEYS.filter((k) => k !== "variant")
  const any = keys.some((k) => block[k as keyof typeof block] !== undefined) || Object.keys(d).length > 0
  const variant = (block.variant ?? range.variants?.[0] ?? "") as V
  const pick = <T extends string>(own: T | undefined, def: T | undefined, allowed: readonly string[] | boolean, base: T): T => {
    if (own !== undefined) return own
    const ok = typeof allowed === "boolean" ? allowed : def !== undefined && allowed.includes(def)
    return def !== undefined && ok ? def : base
  }
  const align = pick<BlockAlign>(block.align, d.align, range.aligns, "start")
  const crop = pick<BlockCrop>(block.crop, d.crop, range.crop, "none")
  const scale = block.scale ?? (range.scale ? d.scale : undefined)
  const fade = block.motion?.enter === "fade"
  useFade(ref, fade)

  const tone = block.tone
  const scoped = toneVars(tone)
  const vars = { ...scoped, ...motionVars(block.motion) }
  const style = Object.keys(vars).length ? (vars as React.CSSProperties) : undefined
  const sectionTone: SectionTone = tone === "subtle" || tone === "raised" || tone === "base" ? tone : scoped ? "base" : (fallback.tone ?? "base")
  const section: ResolvedKnobs<V>["section"] = {
    space: block.space ?? d.space ?? fallback.space,
    tone: sectionTone,
    ...(block.motion?.enter === "none" || fade ? { reveal: false } : {}),
    ...(style ? { style } : {}),
    ...(block.loudness !== undefined ? { "data-loudness": String(block.loudness) } : {}),
    ...(tone ? { "data-tone": tone } : {}),
    ...(tone === "inverse" || tone?.startsWith("block-") ? { "data-surface": "inverse" } : {}),
    ...(block.variant && range.variants ? { "data-block-variant": block.variant } : {}),
    ...(fade ? { ref } : {}),
  }
  return {
    variant,
    named: block.variant as V | undefined,
    align,
    scale,
    crop,
    section,
    treatment: range.treatment ? (block.treatment ?? (page.layout === "two-colour" ? "duotone" : "clean")) : "clean",
    title: { effect: titleEffect(block.motion), ...(stillTitle(block.motion) ? { "data-loudness": "0" } : {}) },
    any,
  }
}

/** motion.enter fade: the section's content fades in as it enters (the reveal role, from fade), where the loudness
 * allows a reveal. Reduced motion is handled by the reveal itself. */
function useFade(ref: React.RefObject<HTMLElement | null>, on: boolean) {
  React.useEffect(() => {
    const content = ref.current?.querySelector<HTMLElement>(':scope > [data-slot="section-content"]')
    if (!on || !content || !allows(loudnessOf(content), "reveal")) return
    return reveal(content, { role: "reveal", from: "fade" })
  }, [ref, on])
}

/** A display size from a scale knob. */
export const sizeOf = (scale: BlockScale | undefined, fallback: DisplaySize): DisplaySize => scale ?? fallback

/**
 * The heading of a block that has a title over its content (work, numbers, process…). With no scale and no kinetic
 * enter it is the /0 BlockTitle; otherwise display type at the scale's size, with the effect. With align split it
 * sits beside the content on wide screens.
 */
export function KnobTitle({ id, children, knobs, motion }: { id: string; children: string; knobs: ResolvedKnobs<string>; motion?: BlockMotion }) {
  const kinetic = titleEffect(motion) !== "rise"
  const split = knobs.align === "split"
  if (!knobs.scale && !kinetic && !split) return <BlockTitle id={id}>{children}</BlockTitle>
  if (!knobs.scale && !kinetic) {
    return (
      <h2 id={id} data-slot="block-title" className="col-span-full mb-12 type-heading-1 text-fg-primary lg:col-span-4 lg:mb-0">
        {children}
      </h2>
    )
  }
  return (
    <DisplayTitle as="h2" size={sizeOf(knobs.scale, "m")} id={id} {...knobs.title} className={join("col-span-full mb-12", split && "lg:col-span-4 lg:mb-0")}>
      {children}
    </DisplayTitle>
  )
}

/** The content beside a split title (or the full width otherwise). */
export function KnobBody({ knobs, children, className }: { knobs: ResolvedKnobs<string>; children: React.ReactNode; className?: string }) {
  if (knobs.align !== "split") return <>{children}</>
  return (
    <div data-slot="block-body" className={join("col-span-full min-w-0 lg:col-span-8", className)}>
      {children}
    </div>
  )
}

/** The grid placement of a block's main copy for an align: start keeps the block's own, center centres it, offset sets
 * it off-axis (from column 3 of 8, and column 4 of 12). */
export function alignClass(align: BlockAlign, own: string): string {
  if (align === "center") return "col-span-full mx-auto flex flex-col items-center text-center md:col-span-full lg:col-span-8 lg:col-start-3"
  if (align === "offset") return "col-span-full sm:col-span-6 sm:col-start-3 lg:col-span-9 lg:col-start-4"
  return own
}

/** The inline margin a cropped media row starts at: the grid's first column, wherever the page's max width puts it. */
export const EDGE_START: React.CSSProperties = { paddingInlineStart: "max(var(--layout-margin), calc((100% - var(--layout-max)) / 2 + var(--layout-margin)))" }

/** Whether a page block's own scroll-linked move may run at an element: where a loudness is declared (a data-loudness,
 * or the brand's --loudness) it needs "scroll" (2); where none is declared it runs, as the expression components do.
 * Reduced motion is checked by the caller and always wins. */
export function scrollAllowed(el: Element | null, what: "scroll" | "kinetic" = "scroll"): boolean {
  if (!el) return false
  const declared = el.closest("[data-loudness]") !== null || getComputedStyle(document.documentElement).getPropertyValue("--loudness").trim() !== ""
  return !declared || allows(loudnessOf(el), what)
}
