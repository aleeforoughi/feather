// The page templates (feather.page/1, wave 5 part C): six whole pages, each composed from the block library, the page
// blocks and the knobs, with its own layout, in copy that is specific and invented (no real company). None names a
// brand: `brand` is a path to fill in, and the brand is the theme. `feather-page init <name>` writes one out.
import creator from "./creator.page.json" with { type: "json" }
import editorial from "./editorial.page.json" with { type: "json" }
import launch from "./launch.page.json" with { type: "json" }
import product from "./product.page.json" with { type: "json" }
import service from "./service.page.json" with { type: "json" }
import studio from "./studio.page.json" with { type: "json" }

/** Each template: one line on what it is for, and its page document. */
export const TEMPLATES = {
  launch: { description: "A product launch at loudness 3: a scene hero, kinetic type, a pinned scroll story, the offer toggle (poster layout).", page: launch },
  studio: { description: "A studio or agency portfolio: bento work, a case, a gallery, testimonials and the process (swiss layout).", page: studio },
  editorial: { description: "A journal or magazine: a cover, the journal, a story in steps, a large quote and a newsletter form (editorial layout).", page: editorial },
  service: { description: "A local business: services and prices, a booking flow, places, questions and contact (colour-blocking layout).", page: service },
  product: { description: "SaaS pricing: a chart, before and after, the calculator, the plans table and questions (two-colour layout).", page: product },
  creator: { description: "A podcast or creator: episodes with transcripts, a showreel with captions, a guest form and the scheme toggle (brutalist layout).", page: creator },
}

/** The template names, in the order `feather-page init --list` prints them. */
export const TEMPLATE_NAMES = Object.keys(TEMPLATES)

/**
 * A starting other set for a page's colour scheme toggle, from a brand's own colours: its ground and ink swapped, the
 * ink as the primary. It is always the brand's other scheme and reads at the brand's own text contrast; tune it after.
 */
export function otherSet(colors) {
  return { background: colors.text, surface: colors.text, text: colors.background, primary: colors.background, primaryText: colors.text }
}
