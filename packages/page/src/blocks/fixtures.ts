// The reference content (examples/studio-of-one.page.json) as typed blocks, shared by the stories and the tests.
// The placeholder media is an inline SVG: no network, no file.
import type { FlowBlock, PageBlock, WorkItem } from "../core/types"

const svg = (a: string, b: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="${a}"/><circle cx="1100" cy="450" r="280" fill="${b}"/></svg>`)}`

export const PLACEHOLDER = { src: svg("#e9e7e2", "#c9c5bb"), alt: "A soft abstract composition in neutral tones" }

export const WORK: WorkItem[] = [
  { id: "acceptto", title: "Acceptto", summary: "Sign-in without passwords, designed so the safe choice is the easy one.", year: "2025", role: "Design lead", href: "/work/acceptto", media: { src: svg("#e3e6e8", "#bfc6cc"), decorative: true } },
  { id: "freezon", title: "Freezon", summary: "A cold-chain dashboard that shows the one shipment at risk, not all of them.", year: "2024", role: "Product design", href: "/work/freezon", media: { src: svg("#e8e6e1", "#cfc9bc"), decorative: true } },
  { id: "evercover", title: "Evercover", summary: "Insurance that explains itself in one sentence before it asks for anything.", year: "2023", role: "Design and front end", href: "/work/evercover", media: { src: svg("#e6e8e3", "#c4cabb"), decorative: true } },
]

/** The product-flow blocks (wave 5): a studio's own quiz, booking, calculator, chart, places and podcast. */
export const FLOW_BLOCKS: { [K in FlowBlock["block"]]: Extract<PageBlock, { block: K }> } = {
  quiz: {
    block: "quiz",
    id: "fit",
    title: "Which way of working fits you?",
    body: "Three questions, about a minute. Nothing is sent anywhere.",
    questions: [
      { id: "stage", q: "Where is the product now?", options: [{ id: "idea", label: "An idea and a sentence", result: "sprint" }, { id: "live", label: "Live, with people using it", result: "system" }, { id: "growing", label: "Growing faster than the team", result: "embed" }] },
      { id: "team", q: "Who would I work with?", options: [{ id: "founder", label: "A founder, mostly", result: "sprint" }, { id: "designers", label: "A few designers and engineers", result: "system" }, { id: "org", label: "Several teams", result: "embed" }] },
      { id: "time", q: "How soon do you need something real?", help: "Real means something people can use, not a deck.", options: [{ id: "weeks", label: "In two weeks", result: "sprint" }, { id: "quarter", label: "This quarter", result: "system" }, { id: "ongoing", label: "It never stops", result: "embed" }] },
    ],
    results: [
      { id: "sprint", title: "A product sprint", body: "Two weeks, one problem, a prototype people can use at the end.", href: "#hire", label: "See the sprint" },
      { id: "system", title: "A design system", body: "Six weeks to tokens, components and the gates that keep them honest.", href: "#hire", label: "See the system" },
      { id: "embed", title: "Join the team", body: "A few days a week, inside the team, for as long as it helps.", href: "#contact", label: "Start a conversation" },
    ],
  },
  booking: {
    block: "booking",
    id: "book",
    title: "Book a first call",
    body: "Thirty minutes to see whether I can help. Pick a time that suits you.",
    services: [
      { id: "intro", name: "First call", duration: "30 minutes", price: "Free", body: "What you are making, and what is in the way." },
      { id: "review", name: "Design review", duration: "60 minutes", price: "£240", body: "A focused review of one flow, with the fixes written down." },
    ],
    days: [
      { date: "2026-12-01", slots: ["09:30", "11:00", "15:00"] },
      { date: "2026-12-02", slots: ["10:00", "14:30"] },
      { date: "2026-12-04", slots: ["09:00", "12:00", "16:30"] },
    ],
    zone: "Times are in London time (GMT).",
    ask: { phone: true, note: true },
    mailto: "hello@example.com",
  },
  calculator: {
    block: "calculator",
    id: "cost",
    title: "What a site costs",
    body: "Move the pieces; the total follows. It is an estimate, not a quote.",
    inputs: [
      { id: "pages", label: "Pages", kind: "range", min: 1, max: 20, step: 1, value: 5, unit: "pages" },
      { id: "system", label: "Design system", kind: "radio", options: [{ label: "Use the brand's own", value: 0 }, { label: "Make a new one", value: 2400 }] },
      { id: "copy", label: "Copywriting", kind: "toggle", help: "I write every page with you." },
    ],
    lines: [
      { id: "design", label: "Design", formula: "pages * 400 + system" },
      { id: "build", label: "Build", formula: "pages * 250" },
      { id: "words", label: "Words", formula: "copy * pages * 120" },
    ],
    formula: "round(design + build + words)",
    prefix: "£",
    note: "In pounds, before VAT. A real quote follows a first call.",
  },
  chart: {
    block: "chart",
    id: "tickets",
    title: "Fewer tickets, month by month",
    summary: "Support tickets at Acceptto fell from 1,240 in January to 610 in June: about half.",
    series: [{ label: "Tickets" }],
    rows: [
      { label: "Jan", values: [1240] },
      { label: "Feb", values: [1110] },
      { label: "Mar", values: [930] },
      { label: "Apr", values: [820] },
      { label: "May", values: [700] },
      { label: "Jun", values: [610] },
    ],
    axis: "Month",
    source: "Acceptto's help desk, 2025.",
  },
  places: {
    block: "places",
    id: "find",
    title: "Where to find me",
    items: [
      { name: "The studio", address: "12 Example Yard\nLondon E2 8AA", hours: "Tuesday to Thursday, 10:00 to 18:00", directions: "https://www.openstreetmap.org/search?query=12%20Example%20Yard%20London" },
      { name: "The workshop", address: "4 Sample Street\nMargate CT9 1AA", hours: "By appointment", phone: "+44 20 7946 0000" },
    ],
  },
  podcast: {
    block: "podcast",
    id: "listen",
    title: "Notes from the studio",
    episodes: [
      {
        id: "room",
        title: "The sound of a quiet room",
        audio: "media/room.wav",
        duration: "0:04",
        date: "November 2026",
        summary: "A short recording of the studio, and why a calm room makes calmer interfaces.",
        chapters: [
          { at: 0, title: "The room" },
          { at: 2, title: "What it taught me" },
        ],
        transcript: [
          { at: 0, by: "Alee", text: "This is the studio on a Tuesday morning." },
          { at: 2, by: "Alee", text: "Nothing in it asks for attention, and that is the point." },
        ],
      },
    ],
  },
}

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
  // Product flows (wave 5).
  ...FLOW_BLOCKS,
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
  // Product flows (wave 5).
  chart: {
    line: {
      title: "Tickets and answers",
      summary: "As tickets fell by half, answers found in the help pages more than doubled.",
      series: [{ label: "Tickets" }, { label: "Self-served" }],
      rows: [
        { label: "Jan", values: [1240, 380] },
        { label: "Feb", values: [1110, 460] },
        { label: "Mar", values: [930, 590] },
        { label: "Apr", values: [820, 700] },
        { label: "May", values: [700, 810] },
        { label: "Jun", values: [610, 880] },
      ],
    },
  },
  places: { map: { media: PLACEHOLDER } },
  quote: {
    rail: {
      items: [
        { text: "The system did the boring parts so we could do the interesting ones.", by: "Jun Park", role: "Design lead, Freezon" },
        { text: "Every screen arrived with its empty, loading and error states already designed.", by: "Sam Okafor", role: "CTO, Evercover" },
      ],
    },
  },
}
