// The talking bodies, driven the way a person drives them: text by typed lines only (the choice number, then the value,
// then the keyword), voice by spoken transcripts ("option one", then the value, "yes" to a readback, then the keyword).
// One flow serves both; `Talker` is what differs, and `style` says how things are said.
import { createDialog, type Turn } from "@aleeforoughi/feather-dialog"
import type { IRNode, ReplyEvent } from "@aleeforoughi/feather-intent"
import type { LayoutPlan } from "@aleeforoughi/feather-liquid"
import { planFor, type Fixture } from "../fixtures.ts"
import { currencyOf, irNodesOf, isCollapsed, planNodeOf, type Scenario } from "../scenarios.ts"
import type { Result } from "./types.ts"

export interface Talker {
  readonly turn: Turn
  /** Says one thing; returns the replies it caused. */
  say(phrase: string): ReplyEvent[]
  /** Says what the engine thought it heard, best first (voice only). */
  sayAlternatives?(phrases: string[]): ReplyEvent[]
}

export type Style = "text" | "voice"

const CARDINALS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]

/** A choice number as the body takes it: "3" typed, "option three" spoken. */
export function numberPhrase(n: number, style: Style): string {
  return style === "voice" && n < CARDINALS.length ? `option ${CARDINALS[n]}` : String(n)
}

/** A number as a person says it: a word up to twenty when speaking, digits otherwise. */
function amountPhrase(n: number, style: Style): string {
  return style === "voice" && Number.isInteger(n) && n >= 0 && n <= 20 ? CARDINALS[n]! : String(n)
}

/** What a person types or says for a Form field's answer. */
function fieldPhrase(kind: string, value: string | number, style: Style): string {
  return typeof value === "number" && (kind === "number" || kind === "money") ? amountPhrase(value, style) : String(value)
}

const show = (v: string | number | boolean) => (typeof v === "boolean" ? (v ? "yes" : "no") : String(v))

/** Where a value is picked from a list in the value turn: the number of the choice with this label. */
function pick(turn: Turn, labels: string[], style: Style): string {
  const wanted = labels.map((l) => l.toLowerCase())
  const found = turn.choices.findIndex((c) => wanted.includes(c.label.toLowerCase()))
  if (found < 0) throw new Error(`the value turn does not list ${JSON.stringify(labels)} (it lists ${turn.choices.map((c) => JSON.stringify(c.label)).join(", ") || "nothing"})`)
  return numberPhrase(found + 1, style)
}

/** What a person types or says for the scenario's value, given the value turn. */
function valuePhrase(ir: IRNode, s: Scenario, turn: Turn, irs: Map<string, IRNode>, currencyKnown: boolean, style: Style): string {
  const v = s.value
  switch (ir.type) {
    case "Choice": {
      const ids = ir.multiple === true ? (v as string[]) : [v as string]
      return ids.map((id) => pick(turn, [ir.options.find((o) => o.id === id)!.label], style)).join(", ")
    }
    case "PredictedChoice": {
      const choice = irs.get(ir.of)
      if (choice?.type !== "Choice") throw new Error("a PredictedChoice of something that is not a Choice")
      return pick(turn, [choice.options.find((o) => o.id === v)!.label], style)
    }
    case "Preference":
      if (ir.options) return pick(turn, [show(v as string | number | boolean)], style)
      return typeof v === "boolean" ? show(v) : typeof v === "number" ? amountPhrase(v, style) : String(v)
    case "ExploreMore":
      return pick(turn, [String(v)], style)
    case "Approval":
      return s.noReason ? "skip" : String(v)
    case "Input":
      return typeof v === "number" ? amountPhrase(v, style) : String(v)
    case "Alternative": {
      if (typeof v === "object" && v !== null && "amount" in v) return `${amountPhrase(v.amount as number, style)}${currencyKnown ? "" : ` ${(v as { currency: string }).currency}`}`
      return String(v)
    }
    default:
      return String(v)
  }
}

/** Drives a talking body through a scenario. Throws when the body does not offer the act at all. */
export function driveTalk(talker: Talker, plan: LayoutPlan, s: Scenario, style: Style): Result {
  const irs = irNodesOf(plan)
  const ir = irs.get(s.node)!
  const currencyKnown = currencyOf({ ir: "feather.ir/0", experience: plan.experience, nodes: [...irs.values()] }) !== undefined
  const replies: ReplyEvent[] = []
  const say = (phrase: string) => void replies.push(...talker.say(phrase))

  // 1. The act, from the browse turn's choices.
  const offered = s.backOut ? "confirm" : s.act
  // A node inside a collapsed group is reached by choosing the browse turn's "Other options" first.
  if (isCollapsed(plan, s.node)) {
    const others = talker.turn.choices.find((c) => c.label === "Other options")
    if (!others) throw new Error(`${style}: the first turn offers no "Other options" (it offers ${talker.turn.choices.map((c) => c.label).join(", ")})`)
    if (talker.say(numberPhrase(others.n, style)).length > 0) throw new Error(`${style}: opening "Other options" must emit nothing`)
  }
  const choice = talker.turn.choices.find((c) => c.node === s.node && c.act === offered)
  if (!choice) throw new Error(`${style}: the first turn offers no "${offered}" on "${s.node}" (it offers ${talker.turn.choices.map((c) => `${c.node}.${c.act}`).join(", ") || "nothing"})`)
  say(numberPhrase(choice.n, style))

  // 2. Its value, read back when the body reads back.
  const state = () => talker.turn.state as Turn["state"]
  if (ir.type === "Form" && s.act === "submit") {
    // A Form is one act asked as a sequence: a question per field in order (an unanswered optional field is skipped), then
    // one read-back that the person sends. Nothing may be emitted before the send.
    const answers = (s.value ?? {}) as Record<string, string | number>
    for (const [i, field] of ir.fields.entries()) {
      if (state() !== "value") throw new Error(`${style}: question ${i + 1} of the form "${s.node}" was not asked (the turn is "${state()}")`)
      const asked = talker.turn.parts.filter((p) => p.kind === "question").map((p) => p.text).join(" ")
      if (!asked.includes(field.prompt)) throw new Error(`${style}: question ${i + 1} of "${s.node}" should ask "${field.prompt}", it asked "${asked}"`)
      const answered = answers[field.id] !== undefined
      say(answered ? fieldPhrase(field.kind, answers[field.id]!, style) : "skip")
      if (replies.length > 0) throw new Error(`${style}: the form "${s.node}" emitted a reply before it was sent (${JSON.stringify(replies)})`)
    }
    if (state() !== "review") throw new Error(`${style}: after the last question of "${s.node}" the body should read the answers back (the turn is "${state()}")`)
    const summary = talker.turn.parts.map((p) => p.text).join(" ")
    for (const field of ir.fields) if (!summary.includes(field.prompt)) throw new Error(`${style}: the read-back of "${s.node}" leaves out "${field.prompt}"`)
    say("send")
    return { before: [...replies], after: null }
  }
  if (state() === "value") {
    say(valuePhrase(ir, s, talker.turn, irs, currencyKnown, style))
    if (state() === "readback") say("yes")
  }
  const before = [...replies]
  if (!s.deliberate) return { before, after: null }

  // 3. The deliberate step: the keyword, or backing out.
  if (s.backOut) say("cancel")
  else {
    const keyword = planNodeOf(plan, s.node)?.keyword
    if (!keyword) throw new Error(`${style}: the plan gives "${s.node}" no keyword`)
    say(keyword)
  }
  return { before, after: [...replies] }
}

export function textTalker(fx: Fixture): { plan: LayoutPlan; talker: Talker } {
  const plan = planFor(fx.ir, "text", fx.persona)
  const dialog = createDialog(plan, { experience: fx.ir })
  return {
    plan,
    talker: {
      get turn() {
        return dialog.turn
      },
      say: (line) => dialog.answer(line).replies,
    },
  }
}

export function driveText(fx: Fixture, s: Scenario): Result {
  const { plan, talker } = textTalker(fx)
  return driveTalk(talker, plan, s, "text")
}

