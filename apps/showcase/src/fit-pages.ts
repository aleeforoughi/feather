// The fit page's documents (fit.tsx, e2e/fit.spec.ts): every hero, numbers, statement, case and timeline variant, at
// loudness 0 and 3 (and the stacked hero at 2), in stress copy. Each passes validatePage.
import { validatePage, type PageDocument } from "@aleeforoughi/feather-page"

// The stress copy. Each title is over 60 characters, carries a compound no line can hold at display size on a phone,
// and the word "making" (the gate wraps it in an <em>, as a composed page marks its one emphasised word).
const TITLES = [
  "Die Donaudampfschifffahrtsgesellschaft is making moments that people remember",
  "Rechtsschutzversicherungsgesellschaften, explained before we are making anything else",
]
const SHORT = "Making the case for Rechtsschutzversicherungsgesellschaften in one breath"
const LEDE = "Eine Seite, die zuerst erklärt und dann fragt: the next necessary thing, and nothing before it."
const MEDIA = { src: "media/studio-desk.svg", alt: "A desk in the studio, with the work laid out" }
const HEROES = ["stacked", "giant-type", "split", "film", "product", "index", "interactive"] as const

type Section = Record<string, unknown> & { block: string; id: string }

function hero(variant: (typeof HEROES)[number], title: string, loud: boolean, masked: boolean): Section {
  return {
    block: "hero",
    id: "top",
    variant,
    eyebrow: "Gestaltungsingenieurin und Produktgestalterin",
    title,
    lede: LEDE,
    actions: [
      { label: "Die Arbeit ansehen", href: "#more" },
      { label: "Schreiben", href: "#write" },
    ],
    ...(variant === "split" || variant === "film" || variant === "product" ? { media: MEDIA } : {}),
    ...(variant === "product" ? { facts: [{ label: "Akkulaufzeit", value: "Zweiundzwanzig Stunden" }, { label: "Gewicht", value: "Einhundertzwölf Gramm" }] } : {}),
    ...(variant === "interactive" && loud ? { scene: { kind: "shader", preset: "gradient-noise", quality: "poster" } } : {}),
    ...(masked && variant !== "giant-type" && variant !== "interactive" ? { motion: { enter: "mask" } } : {}),
  }
}

/** The blocks below the hero: every numbers, statement, case and timeline variant. */
function blocks(): Section[] {
  const numbers = [
    { value: 1250, unit: "kilometres", label: "Donaudampfschifffahrtsgesellschaft, gefahren" },
    { value: 98.6, unit: "Prozent", label: "fewer support tickets" },
    { value: 12, unit: "Versicherung", label: "Rechtsschutzversicherungsgesellschaften" },
    { value: 3, label: "design systems shipped" },
  ]
  const statement = (variant: string, extra: Record<string, unknown> = {}): Section => ({ block: "statement", id: `statement-${variant}`, variant, title: TITLES[0], body: LEDE, ...extra })
  return [
    ...["counter", "plain", "lead"].map((variant) => ({ block: "numbers", id: `numbers-${variant}`, variant, title: SHORT, items: numbers })),
    statement("plain"),
    statement("centred"),
    statement("offset"),
    statement("marquee"),
    statement("fill"),
    statement("swap", { title: "Interfaces that feel {word} to the Rechtsschutzversicherungsgesellschaften", words: ["Donaudampfschifffahrtsgesellschaft", "calm", "inevitable"] }),
    { block: "case", id: "case-editorial", variant: "editorial", title: TITLES[1], body: LEDE, media: MEDIA, facts: [{ label: "Rolle", value: "Gestaltungsleitung" }, { label: "Ergebnis", value: "Vierzig Prozent weniger Anfragen" }] },
    { block: "case", id: "case-solo", variant: "editorial", title: TITLES[0], body: LEDE },
    { block: "case", id: "case-scale", variant: "scale", title: TITLES[0], body: LEDE, media: MEDIA, facts: [{ label: "Rolle", value: "Gestaltungsleitung" }] },
    ...["list", "horizontal"].map((variant) => ({
      block: "timeline",
      id: `timeline-${variant}`,
      variant,
      title: SHORT,
      items: [
        { when: "Scene", what: "The first designer, and the first sentence." },
        { when: "Szenenwechsel", what: "Shipped Evercover, from one sentence to a launch." },
        { when: "Donaudampfschifffahrt", what: "Started the system that composes itself." },
      ],
    })),
  ]
}

/** One document per hero variant and title, at loudness 0 and 3 (the first title masked, the second rising); the first
 * of each loudness carries the other blocks. */
export function fitDocuments(): { key: string; page: PageDocument }[] {
  const out: { key: string; page: PageDocument }[] = []
  // Loudness 2 (the expressive layout) only for the stacked hero, whose eyebrow and title must never meet.
  for (const loudness of [0, 2, 3]) {
    const loud = loudness >= 2
    HEROES.filter((variant) => loudness !== 2 || variant === "stacked").forEach((variant, v) =>
      TITLES.forEach((title, t) => {
        const key = `${loudness}-${variant}-${t}`
        // Ids are unique across the documents on the page: each section's id carries its document's key.
        const sections = [hero(variant, title, loudness === 3, loud && t === 0), ...(v === 0 && t === 0 && loudness !== 2 ? blocks() : [{ block: "statement", id: "more", title: "Mehr Arbeit" }])].map((s) => ({ ...s, id: `${s.id}-${key}` }))
        const doc = { schema: "feather.page/1", brand: "brand/tokens.json", title: "Fit", lang: "de", loudness, sections }
        const result = validatePage(doc)
        if (!result.ok) throw new Error(`${variant} at ${loudness}: ${result.issues.map((i) => `${i.path} ${i.code} ${i.message}`).join("; ")}`)
        out.push({ key, page: result.page })
      })
    )
  }
  return out
}

