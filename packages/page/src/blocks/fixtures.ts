// The reference content (examples/studio-of-one.page.json) as typed blocks, shared by the stories and the tests.
// The placeholder media is an inline SVG: no network, no file.
import type { PageBlock, PageOnlyBlock, WorkItem } from "../core/types"

const svg = (a: string, b: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="${a}"/><circle cx="1100" cy="450" r="280" fill="${b}"/></svg>`)}`

export const PLACEHOLDER = { src: svg("#e9e7e2", "#c9c5bb"), alt: "A soft abstract composition in neutral tones" }

export const WORK: WorkItem[] = [
  { id: "acceptto", title: "Acceptto", summary: "Sign-in without passwords, designed so the safe choice is the easy one.", year: "2025", role: "Design lead", href: "/work/acceptto", media: { src: svg("#e3e6e8", "#bfc6cc"), decorative: true } },
  { id: "freezon", title: "Freezon", summary: "A cold-chain dashboard that shows the one shipment at risk, not all of them.", year: "2024", role: "Product design", href: "/work/freezon", media: { src: svg("#e8e6e1", "#cfc9bc"), decorative: true } },
  { id: "evercover", title: "Evercover", summary: "Insurance that explains itself in one sentence before it asks for anything.", year: "2023", role: "Design and front end", href: "/work/evercover", media: { src: svg("#e6e8e3", "#c4cabb"), decorative: true } },
]

// ---- Wave 5 part A: the page blocks' reference content (feather.page/1 only) ----
const shot = (a: string, b: string, c: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1500"><rect width="1200" height="1500" fill="${a}"/><rect x="180" y="260" width="840" height="980" rx="40" fill="${b}"/><circle cx="600" cy="750" r="220" fill="${c}"/></svg>`)}`

export const GALLERY = [
  { media: { src: shot("#e9e7e2", "#d8d3c8", "#b9b2a3"), alt: "The Acceptto sign-in on a phone, resting on linen" }, title: "Acceptto", caption: "Sign-in, 2025" },
  { media: { src: shot("#e3e6e8", "#cfd5da", "#a9b3bb"), alt: "A Freezon shipment card with its one warning" }, title: "Freezon", caption: "Cold chain, 2024" },
  { media: { src: shot("#e6e8e3", "#d3d8cc", "#aeb6a2"), alt: "The Evercover quote, one sentence long" }, title: "Evercover", caption: "Insurance, 2023" },
  { media: { src: shot("#ece5e1", "#dccfc8", "#bfa99d"), alt: "Type specimens pinned to the studio wall" }, title: "Specimens", caption: "Studio, 2025" },
  { media: { src: shot("#e2e4ea", "#ccd0dc", "#a3a9bc"), alt: "A design system's tokens printed as a poster" }, title: "Tokens", caption: "Feather, 2026" },
  { media: { src: shot("#e8e8e1", "#d6d6c9", "#b4b4a0"), alt: "The notebook, open on its grid page" }, title: "Field kit", caption: "Print, 2026" },
]

const PAGE_ONLY = {
  gallery: { block: "gallery", id: "gallery", title: "From the studio", items: GALLERY },
  comparison: { block: "comparison", id: "compare", title: "Before and after", body: "The Acceptto sign-in, before the redesign and after it.", before: { src: shot("#ddd6cc", "#c4b9aa", "#8f8372"), alt: "The old sign-in: four fields and a password rule" }, after: { src: shot("#e3e8ec", "#c9d3db", "#7d8e9c"), alt: "The new sign-in: one field and a passkey" } },
  story: {
    block: "story",
    id: "story",
    title: "How a sentence becomes a product",
    steps: [
      { title: "Write the sentence", body: "Every product fits in one sentence. We write it before anything is drawn.", media: { src: shot("#e9e7e2", "#d8d3c8", "#b9b2a3"), alt: "A single sentence written on a card" } },
      { title: "Design the floor", body: "Accessibility, speed and every state, before a single effect.", media: { src: shot("#e3e6e8", "#cfd5da", "#a9b3bb"), alt: "Wireframes of the empty, loading and error states" } },
      { title: "Build the ceiling", body: "Then the motion and the craft people remember.", media: { src: shot("#e6e8e3", "#d3d8cc", "#aeb6a2"), alt: "The finished screen, in the brand's colours" } },
    ],
  },
  testimonials: {
    block: "testimonials",
    id: "voices",
    title: "What people say",
    items: [
      { text: "Alee made the hard part feel obvious, and then made it beautiful.", by: "Mara Ellis", role: "VP Product, Acceptto" },
      { text: "The system did the boring parts so we could do the interesting ones.", by: "Jun Park", role: "Design lead, Freezon" },
      { text: "Every screen arrived with its empty, loading and error states already designed.", by: "Sam Okafor", role: "CTO, Evercover" },
    ],
  },
  journal: {
    block: "journal",
    id: "journal",
    title: "Writing",
    items: [
      { date: "2026-11-12", title: "The interface that is not there", excerpt: "Why the best screen is often the one that never had to appear.", href: "/journal/not-there", media: { src: shot("#e9e7e2", "#d8d3c8", "#b9b2a3"), alt: "An empty desk" } },
      { date: "2026-09-30", title: "States first", excerpt: "Empty, loading and error, designed before the happy path.", href: "/journal/states-first" },
      { date: "2026-06-04", title: "One sentence", excerpt: "Every product fits in one. Here is how we find it.", href: "/journal/one-sentence" },
    ],
    more: [{ label: "All writing", href: "/journal" }],
  },
  form: {
    block: "form",
    id: "enquiry",
    title: "Start a project",
    body: "Four questions. I answer every message myself, within two days.",
    action: "/contact",
    fields: [
      { name: "name", label: "Your name", required: true, autocomplete: "name" },
      { name: "email", label: "Email", type: "email", required: true, autocomplete: "email" },
      { name: "budget", label: "Budget", type: "select", options: ["Under €10k", "€10k to €30k", "Over €30k"], required: true },
      { name: "start", label: "When would you like to start?", type: "choice", options: ["This month", "Next quarter", "Just exploring"] },
      { name: "message", label: "What are you making?", type: "textarea", required: true, max: 2000, hint: "A sentence or two is enough." },
    ],
    note: "Your answers go only to me, and are deleted when we finish.",
  },
  showreel: { block: "showreel", id: "reel", title: "The reel", body: "Two minutes of the work, with captions.", media: { src: "reel.mp4", alt: "The studio's reel: products, sites and the system behind them", poster: PLACEHOLDER.src }, captions: "reel.vtt", speech: true },
} as const satisfies { [K in PageOnlyBlock["block"]]: Extract<PageOnlyBlock, { block: K }> }

export const BLOCKS: { [K in PageBlock["block"]]: Extract<PageBlock, { block: K }> } = {
  hero: { block: "hero", id: "top", eyebrow: "Design engineer", title: "I design interfaces that compose themselves.", lede: "Products that show the next necessary thing, and websites that answer back.", media: PLACEHOLDER, starters: ["Show me the work", "Can I hire you?", "What are you on now?"] },
  statement: { block: "statement", id: "now", title: "Semantics in, the right experience out.", body: "A design system that composes itself from intent…" },
  work: { block: "work", id: "work", title: "Selected work", items: WORK },
  case: { block: "case", id: "case", title: "Acceptto", body: "Passwordless sign-in for 2 million people. The safe path became the default path.", media: PLACEHOLDER, facts: [{ label: "Role", value: "Design lead" }, { label: "Result", value: "40% fewer tickets" }] },
  numbers: { block: "numbers", id: "proof", title: "In numbers", items: [{ value: 12, unit: "years", label: "designing products" }, { value: 40, unit: "%", label: "fewer support tickets at Acceptto" }, { value: 3, label: "design systems shipped" }] },
  timeline: { block: "timeline", id: "timeline", title: "Along the way", items: [{ when: "2019", what: "Joined Acceptto as the first designer." }, { when: "2023", what: "Shipped Evercover, from one sentence to a launch." }, { when: "2025", what: "Started the system that composes itself." }] },
  process: { block: "process", id: "process", title: "How I work", steps: [{ title: "Find the sentence", body: "Every product fits in one sentence. We write it first." }, { title: "Design the floor", body: "Accessibility, speed and states before effects." }, { title: "Build the ceiling", body: "Then the motion and the craft people remember." }] },
  logos: { block: "logos", id: "clients", title: "Worked with", items: ["Acceptto", "Freezon", "Evercover", "Godpip"].map((name) => ({ name })) },
  quote: { block: "quote", id: "quote", text: "Alee made the hard part feel obvious, and then made it beautiful.", by: "Mara Ellis", role: "VP Product, Acceptto" },
  offer: { block: "offer", id: "hire", title: "Ways to work together", items: [{ name: "A product sprint", price: "Two weeks", body: "One problem, designed and prototyped.", href: "https://cal.example.com/alee" }, { name: "A design system", price: "Six weeks", body: "Tokens, components and the gates that keep them." }] },
  faq: { block: "faq", id: "faq", title: "Questions", items: [{ q: "Are you available?", a: "Yes, from January." }, { q: "Do you work with teams?", a: "Mostly, yes. I join as one of them." }] },
  contact: { block: "contact", id: "contact", title: "Let’s talk", body: "I read every message myself.", actions: [{ label: "Write to me", href: "mailto:hello@example.com" }, { label: "Book a call", href: "https://cal.example.com/alee" }] },
  signature: { block: "signature", id: "signature", title: "The one thing only this brand does.", body: "Restyled by the brand through its tokens.", variant: "ink" },
  // Wave 5 part A: the page blocks.
  ...PAGE_ONLY,
}

/** What a variant needs beyond the block's fixture (feather.page/1): the swap statement's words, the rail's other
 * quotes, the product hero's facts and act. */
export const VARIANT_EXTRAS: Record<string, Record<string, Record<string, unknown>>> = {
  hero: {
    product: { eyebrow: "Field kit", title: "One notebook for every brief.", lede: "Ruled for type, gridded for layout, bound to lie flat.", facts: [{ label: "Pages", value: "192" }, { label: "Paper", value: "100 gsm" }, { label: "Grid", value: "5 mm" }, { label: "Binding", value: "Lay-flat" }], actions: [{ label: "Order one", href: "/order" }] },
    film: { actions: [{ label: "See the work", href: "#work" }] },
    split: { actions: [{ label: "See the work", href: "#work" }] },
  },
  statement: { swap: { title: "I design interfaces that feel {word}.", words: ["obvious", "calm", "inevitable"] } },
  offer: {
    toggle: {
      periods: ["Monthly", "Yearly"],
      items: [
        { name: "Studio", prices: ["€900 a month", "€9,000 a year"], body: "A day a week, for the long run.", href: "https://cal.example.com/alee" },
        { name: "Sprint", prices: ["€4,000 a month", "€40,000 a year"], body: "Two weeks a month, one problem at a time." },
      ],
    },
  },
  quote: {
    rail: {
      items: [
        { text: "The system did the boring parts so we could do the interesting ones.", by: "Jun Park", role: "Design lead, Freezon" },
        { text: "Every screen arrived with its empty, loading and error states already designed.", by: "Sam Okafor", role: "CTO, Evercover" },
      ],
    },
  },
}
