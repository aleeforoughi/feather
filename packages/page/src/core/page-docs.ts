// The documentation of the page blocks (feather.page/1): the JSON Schema's descriptions (scripts/json-schema.ts). Kept out
// of spec.ts so the release runtime, which validates pages, does not carry the prose.
export const PAGE_BLOCK_DOC: Record<string, string> = {
  gallery: "Images to look through, each opening large in the lightbox. Every image is content: it needs alt text.",
  comparison: "Before and after, compared with a slider (a native range); side by side without script.",
  story: "A story told in two to six steps, each with its picture, which stays pinned and changes as the steps pass.",
  testimonials: "Several people's words, attributed: a grid, or a rail.",
  journal: "Writing, as an editorial list: date, title, excerpt and the link to read it.",
  form: "A short form that posts to the page's own endpoint (or opens an email), and works with no script.",
  showreel: "A film with its controls and captions: play and pause, mute, and a captions track when anyone speaks.",
  quiz: "Questions with real radio options, one per step, and a result keyed by the answers. With no script, every question shows, and how the result is decided.",
  booking: "A booking flow: service, then date and time, then details, then a review before anything is sent. Slots come from the page; it sends to an action URL, a mailto, or hands over to a booking link.",
  calculator: "A pricing calculator: inputs (range, number, radio, toggle) and a price formula in a small safe language (+ - * /, min, max, round). The total and its breakdown are announced as they change; with no script, the starting prices show.",
  chart: "Data as a bar, line or area chart, drawn in SVG in the theme's inks, with its summary sentence and the data as a table behind a disclosure. The end state draws in on reveal; under reduced motion it is simply there.",
  places: "Places to find: always a list of names, addresses and links (directions, the place's own site, a phone number), with an optional still map. No map SDK and no tiles.",
  podcast: "Episodes on native audio with real-button controls (play, ±15 s, speed, a scrub slider), chapters that seek, and a transcript (required) that can follow playback. Never autoplays; with no script, the browser's own controls.",
}
