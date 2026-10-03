// Experiences the shared fixtures do not have, for the paths they leave untried: several options at once, every kind of
// Input, every shape of Preference, an Approval and a Recommendation that arm, an irreversible Choice, alternatives that
// take each kind of value. They go through every test the fixtures do. Each is checked with the IR validator on load.
import { validate, type Experience } from "@aleeforoughi/feather-intent"
import type { Fixture } from "./fixtures.ts"

const ir = (experience: string, nodes: unknown[]): Experience => ({ ir: "feather.ir/0", experience, nodes }) as Experience

const SYNTHETIC: Fixture[] = [
  {
    name: "synthetic-multiple-choice",
    ir: ir("pick_toppings", [
      { type: "Text", id: "intro", text: "Choose your toppings." },
      { type: "Choice", id: "toppings", intent: "pick toppings", prompt: "Which toppings?", multiple: true, options: [{ id: "cheese", label: "Cheese" }, { id: "olives", label: "Olives" }, { id: "basil", label: "Basil" }] },
    ]),
  },
  {
    name: "synthetic-input-kinds",
    ir: ir("fill_in_details", [
      { type: "Input", id: "mail", intent: "email", prompt: "Your email?", kind: "email", required: true },
      { type: "Input", id: "tel", intent: "phone", prompt: "Your phone?", kind: "phone" },
      { type: "Input", id: "site", intent: "website", prompt: "Your website?", kind: "url" },
      { type: "Input", id: "bio", intent: "bio", prompt: "Tell us about you.", kind: "long-text", maxLength: 200 },
      { type: "Input", id: "budget", intent: "budget", prompt: "What is your budget?", kind: "money", currency: "AED", min: 5, max: 5000, required: true },
      { type: "Input", id: "guests", intent: "guests", prompt: "How many guests?", kind: "number", min: 2, max: 9 },
      { type: "Input", id: "when", intent: "date", prompt: "Which day?", kind: "date", required: true },
    ]),
  },
  {
    name: "synthetic-preferences",
    ir: ir("tune_settings", [
      { type: "Preference", id: "sound", intent: "sound", key: "sound", label: "Sound", value: false },
      { type: "Preference", id: "volume", intent: "volume", key: "volume", label: "Volume", value: 3 },
      { type: "Preference", id: "nickname", intent: "nickname", key: "nickname", label: "Nickname", value: "Sam" },
      { type: "Preference", id: "size", intent: "size", key: "size", label: "Text size", value: 20, options: [10, 20, 30] },
    ]),
  },
  {
    name: "synthetic-approval-and-recommendation-arm",
    ir: ir("publish_and_notify", [
      { type: "Approval", id: "ok_notify", intent: "approve the notice", request: "Email the notice to the team", consequence: { send: { to: "the team", channel: "email" } } },
      { type: "Recommendation", id: "rec_publish", intent: "publish the page", summary: "Publish the page today.", consequence: { publish: { audience: "everyone" } } },
    ]),
  },
  {
    name: "synthetic-irreversible-choice",
    ir: ir("pick_destination", [
      { type: "Choice", id: "where", intent: "pick a destination", prompt: "Where to?", reversible: false, options: [{ id: "oslo", label: "Oslo" }, { id: "rome", label: "Rome" }, { id: "lima", label: "Lima" }] },
      { type: "PredictedChoice", id: "likely", intent: "predict destination", of: "where", option: "rome", summary: "You went to Rome last year." },
      { type: "IrreversibleAction", id: "book", intent: "book the ticket", confirms: "where", consequence: { statement: "Books a ticket that cannot be refunded" } },
    ]),
  },
  {
    name: "synthetic-alternative-inputs",
    ir: ir("rebook_trip", [
      { type: "Recommendation", id: "rec", intent: "keep the booking", summary: "Keep the trip as booked." },
      { type: "Alternative", id: "other_day", intent: "pick another day", for: "rec", label: "Another day", input: "Date" },
      { type: "Alternative", id: "note", intent: "leave a note", for: "rec", label: "Leave a note", input: "Text" },
      { type: "Alternative", id: "meet", intent: "pick a meeting point", for: "rec", label: "Meet elsewhere", input: "Location" },
      { type: "Alternative", id: "guest", intent: "bring someone", for: "rec", label: "Bring a guest", input: "Person" },
      { type: "Alternative", id: "price", intent: "name a price", for: "rec", label: "Name a price", input: "Price" },
    ]),
  },
  {
    name: "synthetic-explore-without-topics",
    ir: ir("read_more", [
      { type: "Text", id: "teaser", text: "A short summary of the story." },
      { type: "ExploreMore", id: "more", intent: "read the full story", label: "Read more" },
      { type: "Warning", id: "careful", text: "This story has spoilers.", severity: "caution", acknowledge: true },
    ]),
  },
]

for (const fx of SYNTHETIC) {
  const checked = validate(fx.ir)
  if (!checked.ok) throw new Error(`synthetic fixture ${fx.name} is not valid IR: ${checked.issues.map((i) => i.message).join("; ")}`)
}

export { SYNTHETIC }
