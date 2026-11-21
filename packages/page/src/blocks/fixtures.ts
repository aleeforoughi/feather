// The reference content (examples/studio-of-one.page.json) as typed blocks, shared by the stories and the tests.
// The placeholder media is an inline SVG: no network, no file.
import type { PageBlock, WorkItem } from "../core/types"

const svg = (a: string, b: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="${a}"/><circle cx="1100" cy="450" r="280" fill="${b}"/></svg>`)}`

export const PLACEHOLDER = { src: svg("#e9e7e2", "#c9c5bb"), alt: "A soft abstract composition in neutral tones" }

export const WORK: WorkItem[] = [
  { id: "acceptto", title: "Acceptto", summary: "Sign-in without passwords, designed so the safe choice is the easy one.", year: "2025", role: "Design lead", href: "/work/acceptto", media: { src: svg("#e3e6e8", "#bfc6cc"), decorative: true } },
  { id: "freezon", title: "Freezon", summary: "A cold-chain dashboard that shows the one shipment at risk, not all of them.", year: "2024", role: "Product design", href: "/work/freezon", media: { src: svg("#e8e6e1", "#cfc9bc"), decorative: true } },
  { id: "evercover", title: "Evercover", summary: "Insurance that explains itself in one sentence before it asks for anything.", year: "2023", role: "Design and front end", href: "/work/evercover", media: { src: svg("#e6e8e3", "#c4cabb"), decorative: true } },
]

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
}
