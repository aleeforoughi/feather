// The dialog engine: a conversation over a layout plan, in turns. Pure and deterministic (no clock, no randomness, no
// I/O, no DOM): the same plan and the same inputs always give the same turns and the same replies. The contract is
// docs/manifestations.md section 1.
import { actsFor, validateReply, type Experience, type IRNode, type ReplyEvent } from "@aleeforoughi/feather-intent"
import type { Emphasis, LayoutPlan, PlanNode } from "@aleeforoughi/feather-liquid"
import { formatDate, formatMoney, plainProblem } from "./format.ts"
import { normalize, type Normalized } from "./normalize.ts"
import { experienceCurrency, experienceOf, nodeIndex, planNodes } from "./plan-utils.ts"
import { consequenceSentences, sentences, show } from "./words.ts"

export interface DialogOptions {
  /** The experience the plan came from; replies are checked against it. Default: rebuilt from the plan's nodes. */
  experience?: Experience
  /** Read a value back and ask "is that right?" before it goes out (voice turns this on). Default false. */
  readback?: boolean
}

export interface Part {
  kind: "content" | "consequence" | "question" | "hint" | "problem" | "outcome"
  text: string
  /** The plan node it belongs to, if any. */
  node?: string
  emphasis?: Emphasis
}

export interface Choice {
  n: number
  /** What the person picks it by, in words: "Approve the budget", "Small". */
  label: string
  /** Words that pick it besides its number and label, case-insensitive: the act ("approve"), the option id. */
  words: string[]
  node?: string
  act?: string
}

export interface Turn {
  state: "browse" | "value" | "confirm" | "readback" | "done"
  /** What to present, in order. A body renders each part its own way. */
  parts: Part[]
  /** What the person can do now, numbered from 1. */
  choices: Choice[]
}

export interface Outcome {
  turn: Turn
  replies: ReplyEvent[]
}

export interface Dialog {
  /** What the body presents now. */
  readonly turn: Turn
  /** True once nothing is left to act on. */
  readonly done: boolean
  /** The person's input, typed or transcribed. Returns the next turn and every reply that went out. Never throws. */
  answer(input: string): Outcome
}

/** One act the person can take: a node, an act, and the words for it. */
interface Offer {
  /** The plan node it is listed under. */
  host: PlanNode
  /** The plan node the reply goes to (a merged prediction, for a Choice that merges one). */
  target: PlanNode
  ir: IRNode
  act: string
  label: string
}

/** A selectable value in a value turn. */
interface Option {
  label: string
  words: string[]
  value: unknown
}

interface Pending {
  offer: Offer
  hasValue: boolean
  value?: unknown
}

type Mode = { kind: "browse" } | { kind: "value"; offer: Offer } | { kind: "readback"; pending: Pending } | { kind: "confirm"; pending: Pending } | { kind: "done" }

interface TurnOptions {
  problem?: string
  hint?: string
  /** Browse: the whole experience again, not only what is left to do. */
  full?: boolean
  /** Parts to put first (what just happened). */
  lead?: Part[]
}

const NO_REPLY_TO_ARM = new Set(["cancel", "reject"])
const upperFirst = (s: string) => (s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s)
const lowerConsequence = (s: string) => s.replace(/^(Spends|Publishes|Sends|Gives|Deletes) /, (m) => m.toLowerCase())
const clip = (s: string, max = 40) => (s.length > max ? `${[...s].slice(0, max - 1).join("")}…` : s)
const NUMBER = /^[-+]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/

function parseNumber(text: string): number | undefined {
  if (text.length > 60 || !NUMBER.test(text)) return undefined
  const n = Number(text.replaceAll(",", ""))
  return Number.isFinite(n) ? n : undefined
}

/** Starts a conversation over a plan. */
export function createDialog(plan: LayoutPlan, options: DialogOptions = {}): Dialog {
  const locale = plan.locale
  const experience = options.experience ?? experienceOf(plan)
  const readback = options.readback === true
  const irs = nodeIndex(plan)
  const currency = experienceCurrency(irs.values())

  const index = new Map<string, PlanNode>()
  const mergedIds = new Set<string>()
  for (const pn of planNodes(plan)) {
    if (pn.node && !index.has(pn.node.id)) index.set(pn.node.id, pn)
    for (const m of pn.merged ?? []) mergedIds.add(m.id)
  }

  const answered = new Set<string>()
  const outcomes: Part[] = []
  let mode: Mode = { kind: "browse" }
  let replies: ReplyEvent[] = []

  // ── What there is to do ──────────────────────────────────────────────────────────────────────────────────────
  const optionLabel = (choice: IRNode | undefined, id: string) => (choice?.type === "Choice" ? choice.options.find((o) => o.id === id)?.label ?? id : id)

  function labelFor(ir: IRNode, act: string): string {
    switch (ir.type) {
      case "Action":
        return upperFirst(ir.label ?? ir.intent)
      case "Choice":
        return ir.prompt
      case "Input":
        return act === "skip" ? `Skip: ${ir.prompt}` : ir.prompt
      case "Warning":
        return `Acknowledge: ${ir.text}`
      case "Approval":
        return `${upperFirst(act)}: ${ir.request}`
      case "Recommendation":
        return upperFirst(ir.intent)
      case "PredictedChoice": {
        const choice = irs.get(ir.of)
        return act === "accept" ? `Keep ${optionLabel(choice, ir.option)}` : `Change: ${choice?.type === "Choice" ? choice.prompt : ir.of}`
      }
      case "Alternative":
        return upperFirst(ir.label ?? ir.intent)
      case "Autopick":
        return `${upperFirst(act)}: ${ir.summary}`
      case "Correction":
        return ir.prompt
      case "Preference":
        return `Change ${ir.label}`
      case "IrreversibleAction":
        return upperFirst(ir.label ?? ir.intent)
      case "ExploreMore":
        return upperFirst(ir.label ?? ir.intent)
      default:
        return upperFirst(act)
    }
  }

  /** The acts on offer, in plan order, the primary's first (docs/manifestations.md section 1, browse). */
  function offers(): Offer[] {
    const list: Offer[] = []
    for (const id of plan.order) {
      const host = index.get(id)
      if (!host?.node || mergedIds.has(id) || host.organism === "PredictionNote") continue
      if (answered.has(id) && host.node.type !== "ExploreMore") continue
      const target = host.merged?.find((m) => m.node?.type === "PredictedChoice") ?? host
      const ir = target.node!
      for (const act of actsFor(ir)) {
        if (ir.type === "IrreversibleAction" && act === "cancel") continue
        list.push({ host, target, ir, act, label: labelFor(ir, act) })
      }
    }
    return [...list.filter((o) => o.host.id === plan.primary), ...list.filter((o) => o.host.id !== plan.primary)]
  }

  function choicesOf(list: Offer[]): Choice[] {
    const count = new Map<string, number>()
    for (const o of list) count.set(o.act, (count.get(o.act) ?? 0) + 1)
    return list.map((o, i) => ({ n: i + 1, label: o.label, words: count.get(o.act) === 1 ? [o.act] : [], node: o.ir.id, act: o.act }))
  }

  const confirmOf = (o: Offer) => (NO_REPLY_TO_ARM.has(o.act) ? undefined : o.target.confirm ?? o.host.confirm)
  const keywordOf = (o: Offer) => o.target.keyword ?? o.host.keyword ?? "confirm"

  // ── Values ───────────────────────────────────────────────────────────────────────────────────────────────────
  function needsValue(o: Offer): boolean {
    const ir = o.ir
    switch (ir.type) {
      case "Choice":
      case "PredictedChoice":
        return o.act === "choose" || o.act === "change"
      case "Input":
        return o.act === "submit"
      case "Alternative":
        return ir.input !== undefined
      case "Correction":
      case "Preference":
        return true
      case "Approval":
        return o.act === "reject"
      case "ExploreMore":
        return (ir.topics?.length ?? 0) > 0
      default:
        return false
    }
  }

  function optionsOf(o: Offer): Option[] | undefined {
    const ir = o.ir
    if (ir.type === "Choice") return ir.options.map((opt) => ({ label: opt.label, words: [opt.id], value: opt.id }))
    if (ir.type === "PredictedChoice") {
      const choice = irs.get(ir.of)
      return choice?.type === "Choice" ? choice.options.filter((opt) => opt.id !== ir.option).map((opt) => ({ label: opt.label, words: [opt.id], value: opt.id })) : []
    }
    if (ir.type === "Preference" && ir.options) return ir.options.map((v) => ({ label: show(v), words: [], value: v }))
    if (ir.type === "ExploreMore" && ir.topics?.length) return ir.topics.map((t) => ({ label: t, words: [], value: t }))
    return undefined
  }

  function questionFor(o: Offer): string {
    const ir = o.ir
    switch (ir.type) {
      case "Choice":
        return ir.multiple ? `${ir.prompt} Pick one or more, separated by commas.` : ir.prompt
      case "PredictedChoice": {
        const choice = irs.get(ir.of)
        return `${choice?.type === "Choice" ? choice.prompt : "Which one?"} (instead of ${optionLabel(choice, ir.option)})`
      }
      case "Input": {
        const range = ir.min !== undefined && ir.max !== undefined ? ` from ${ir.min} to ${ir.max}` : ir.min !== undefined ? ` of at least ${ir.min}` : ir.max !== undefined ? ` of at most ${ir.max}` : ""
        const kind: Record<string, string> = {
          number: `a number${range}`,
          money: `an amount${ir.currency ? ` in ${ir.currency}` : ""}${range}`,
          date: "a date, like 2026-01-15",
          email: "an email address",
          phone: "a phone number",
          url: "a web address",
        }
        return kind[ir.kind] ? `${ir.prompt} (${kind[ir.kind]})` : ir.prompt
      }
      case "Alternative": {
        const kind = { Price: `an amount${currency ? ` in ${currency}` : ""}`, Date: "a date, like 2026-01-15", Text: "your words", Location: "a place", Person: "a name" }[ir.input ?? "Text"]
        return `${upperFirst(ir.label ?? ir.intent)}: give ${kind}.`
      }
      case "Correction":
        return ir.prompt
      case "Preference":
        return `${ir.label} is ${show(ir.value)}. What should it be?`
      case "Approval":
        return 'Why? Say "skip" to give no reason.'
      case "ExploreMore":
        return 'More about which topic? Say "skip" for none.'
      default:
        return "What is the value?"
    }
  }

  type Parsed = { ok: true; hasValue: boolean; value?: unknown } | { ok: false; problem: string }
  const bad = (problem: string): Parsed => ({ ok: false, problem })
  const good = (value: unknown): Parsed => ({ ok: true, hasValue: true, value })

  /** A value in the person's words, for an act that takes free text, a number, a date or an amount. */
  function parseFree(o: Offer, n: Normalized): Parsed {
    const ir = o.ir
    const kind = ir.type === "Input" ? ir.kind : ir.type === "Alternative" ? ir.input : ir.type === "Preference" ? typeof ir.value : "text"
    switch (kind) {
      case "number":
      case "money": {
        let s = n.plain.toLowerCase()
        const code = ir.type === "Input" ? ir.currency?.toLowerCase() : undefined
        if (code && s.endsWith(code)) s = s.slice(0, -code.length).trim()
        else if (code && s.startsWith(code)) s = s.slice(code.length).trim()
        const v = parseNumber(s)
        return v === undefined ? bad(kind === "money" ? "That is not an amount. Give a number." : "That is not a number.") : good(v)
      }
      case "date":
      case "Date":
        return good(n.plain)
      case "Price": {
        const tokens = n.plain.split(" ")
        const amount = tokens.map(parseNumber).find((v) => v !== undefined)
        const code = tokens.find((t) => /^[A-Za-z]{3}$/.test(t))?.toUpperCase() ?? currency
        if (amount === undefined) return bad("That is not an amount. Give a number.")
        if (!code) return bad("Give the amount with its currency, like 250 USD.")
        return good({ amount, currency: code })
      }
      case "boolean": {
        if (["yes", "true", "on"].includes(n.text)) return good(true)
        if (["no", "false", "off"].includes(n.text)) return good(false)
        return bad("Say yes or no.")
      }
      case "string":
      default:
        return good(n.raw)
    }
  }

  /** What a value says, in words: for readback and outcomes. */
  function describe(o: Offer, value: unknown): string {
    const ir = o.ir
    switch (ir.type) {
      case "Choice":
        return (Array.isArray(value) ? value : [value]).map((v) => optionLabel(ir, String(v))).join(", ")
      case "PredictedChoice":
        return optionLabel(irs.get(ir.of), String(value))
      case "Input":
        if (ir.kind === "money" && typeof value === "number") return ir.currency ? formatMoney(value, ir.currency, locale) : String(value)
        if (ir.kind === "date" && typeof value === "string") return formatDate(value, locale)
        return typeof value === "number" ? String(value) : `"${String(value)}"`
      case "Alternative":
        if (typeof value === "object" && value !== null && "amount" in value && "currency" in value) return formatMoney(Number(value.amount), String(value.currency), locale)
        return ir.input === "Date" && typeof value === "string" ? formatDate(value, locale) : `"${String(value)}"`
      case "Preference":
        return show(value as string | number | boolean)
      default:
        return typeof value === "string" ? `"${value}"` : String(value)
    }
  }

  // ── Turns ────────────────────────────────────────────────────────────────────────────────────────────────────
  const part = (kind: Part["kind"], text: string, node?: string, emphasis?: Emphasis): Part => ({ kind, text, ...(node === undefined ? {} : { node }), ...(emphasis === undefined ? {} : { emphasis }) })

  function contentParts(): Part[] {
    const out: Part[] = []
    for (const id of plan.order) {
      const pn = index.get(id)
      if (!pn?.node) continue
      const lines = sentences(pn, plan)
      for (const line of lines.length > 0 ? lines : [`${pn.node.type} ${id}.`]) out.push(part("content", line, id, pn.emphasis))
      if ("consequence" in pn.node && pn.node.consequence) for (const s of consequenceSentences(pn.node.consequence, locale)) out.push(part("consequence", s, id, pn.emphasis))
    }
    return out
  }

  function turnFor(o: TurnOptions = {}): Turn {
    const lead = o.lead ?? []
    const problem = o.problem ? [part("problem", o.problem)] : []
    const hint = o.hint ? [part("hint", o.hint)] : []
    switch (mode.kind) {
      case "browse": {
        const list = offers()
        const full = o.full === true
        return { state: "browse", parts: [...lead, ...(full ? contentParts() : []), ...problem, ...hint, part("question", `What would you like to do? Pick a number from 1 to ${list.length}.`)], choices: choicesOf(list) }
      }
      case "value": {
        const offer = mode.offer
        const choices = (optionsOf(offer) ?? []).map((opt, i) => ({ n: i + 1, label: opt.label, words: opt.words, node: offer.ir.id }))
        return { state: "value", parts: [...lead, ...problem, ...hint, part("question", questionFor(offer), offer.ir.id)], choices }
      }
      case "readback": {
        const { offer, value } = mode.pending
        return { state: "readback", parts: [...lead, part("content", `You said ${describe(offer, value)}.`, offer.ir.id), ...problem, ...hint, part("question", "Is that right? Say yes or no.", offer.ir.id)], choices: [] }
      }
      case "confirm": {
        const { offer, hasValue, value } = mode.pending
        const ir = offer.target.node!
        const parts: Part[] = [...lead]
        for (const line of sentences(offer.target, plan)) parts.push(part("content", line, ir.id, offer.target.emphasis))
        if (hasValue) parts.push(part("content", `You chose: ${describe(offer, value)}.`, ir.id))
        const consequence = "consequence" in ir && ir.consequence ? ir.consequence : "consequence" in offer.host.node! && offer.host.node.consequence ? offer.host.node.consequence : undefined
        if (consequence) for (const s of consequenceSentences(consequence, locale)) parts.push(part("consequence", s, ir.id, offer.target.emphasis))
        parts.push(...problem, ...hint, part("question", `Type "${keywordOf(offer)}" to go ahead, or "cancel".`, ir.id))
        return { state: "confirm", parts, choices: [] }
      }
      case "done":
        return { state: "done", parts: [...lead.filter((p) => p.kind !== "outcome"), ...problem, ...hint, ...(outcomes.length > 0 ? outcomes : contentParts())], choices: [] }
    }
  }

  let turn: Turn = (() => {
    if (offers().length === 0) mode = { kind: "done" }
    return turnFor({ full: true })
  })()

  /** After a step: the next turn is browse (or done), with what just happened first. */
  function settle(o: TurnOptions = {}): Turn {
    mode = offers().length === 0 ? { kind: "done" } : { kind: "browse" }
    return turnFor(o)
  }

  // ── Sending ──────────────────────────────────────────────────────────────────────────────────────────────────
  function outcomeText(o: Offer, hasValue: boolean, value: unknown): string {
    const v = hasValue ? describe(o, value) : ""
    switch (o.act) {
      case "activate":
        return `Done: ${o.label}.`
      case "choose":
        return hasValue ? `Chosen: ${o.ir.type === "Alternative" ? `${o.label} (${v})` : v}.` : `Chosen: ${o.label}.`
      case "submit":
        return `Noted: ${v}.`
      case "skip":
        return "Skipped."
      case "acknowledge":
        return "Acknowledged."
      case "approve":
        return "Approved."
      case "reject":
        return hasValue ? `Rejected: ${v}.` : "Rejected."
      case "accept":
        return "Accepted."
      case "change":
        return `Changed to ${v}.`
      case "keep":
        return "Kept."
      case "undo":
        return "Undone."
      case "set":
        return `Set to ${v}.`
      case "cancel":
        return "Cancelled."
      case "expand":
        return hasValue ? `Asked for more about ${String(value)}.` : "Asked for more."
      case "confirm": {
        const ir = o.ir
        const list = "consequence" in ir && ir.consequence ? consequenceSentences(ir.consequence, locale).map(lowerConsequence) : []
        return list.length > 0 ? `Confirmed: ${list.join(", ")}.` : "Confirmed."
      }
      default:
        return `${upperFirst(o.act)}.`
    }
  }

  /** Validates and sends one reply. On failure nothing is sent and the problem is returned. */
  function send(o: Offer, hasValue: boolean, value: unknown): { ok: true; outcome: Part } | { ok: false; problem: string } {
    const reply = { experience: experience.experience, node: o.ir.id, act: o.act, ...(hasValue ? { value } : {}) }
    const checked = validateReply(experience, reply)
    if (!checked.ok) return { ok: false, problem: checked.issues.map((i) => plainProblem(i.message)).map(upperFirst).join(" ") }
    replies.push(checked.reply)
    if (o.ir.type !== "ExploreMore") {
      answered.add(o.host.id)
      answered.add(o.target.id)
    }
    const outcome = part("outcome", outcomeText(o, hasValue, value), o.ir.id)
    outcomes.push(outcome)
    return { ok: true, outcome }
  }

  /** The step after a value is in hand (or an act that needs none was picked): readback, confirm, or send. */
  function proceed(p: Pending, readDone: boolean): Turn {
    if (p.hasValue && readback && !readDone) {
      mode = { kind: "readback", pending: p }
      return turnFor()
    }
    if (confirmOf(p.offer) !== undefined) {
      mode = { kind: "confirm", pending: p }
      return turnFor()
    }
    return commit(p)
  }

  function commit(p: Pending): Turn {
    const sent = send(p.offer, p.hasValue, p.value)
    if (sent.ok) return settle({ lead: [sent.outcome] })
    if (p.hasValue && needsValue(p.offer)) {
      mode = { kind: "value", offer: p.offer }
      return turnFor({ problem: sent.problem })
    }
    return settle({ problem: sent.problem })
  }

  function pick(o: Offer): Turn {
    if (needsValue(o)) {
      mode = { kind: "value", offer: o }
      return turnFor()
    }
    return proceed({ offer: o, hasValue: false }, false)
  }

  function backOut(): Turn {
    switch (mode.kind) {
      case "browse":
        return turnFor({ hint: "There is nothing to go back to." })
      case "confirm": {
        const o = mode.pending.offer
        if (o.ir.type === "IrreversibleAction" && o.act === "confirm") {
          const sent = send({ ...o, act: "cancel", label: "Cancel" }, false, undefined)
          if (sent.ok) return settle({ lead: [sent.outcome] })
          return settle({ problem: sent.problem })
        }
        return settle({ lead: [part("hint", "Nothing was done.")] })
      }
      default:
        return settle()
    }
  }

  // ── Matching ─────────────────────────────────────────────────────────────────────────────────────────────────
  const same = (a: string, b: string) => normalize(a, locale).text === b

  /** The index of the choice a number, label or word picks; -1 for none, -2 for a number out of range. */
  function matchChoice(text: string, choices: Array<{ label: string; words: string[] }>): number {
    if (/^\d{1,6}$/.test(text)) {
      const n = Number(text)
      return n >= 1 && n <= choices.length ? n - 1 : -2
    }
    return choices.findIndex((c) => same(c.label, text) || c.words.some((w) => same(w, text)))
  }

  const wordsList = (labels: string[]) => labels.slice(0, 8).map((l) => `"${clip(l, 30)}"`).join(", ")

  function step(input: string): Turn {
    const n = normalize(input, locale)
    if (mode.kind === "done") return turnFor({ hint: "Nothing is left to do." })
    if (n.text === "") return turnFor({ problem: 'I did not catch anything. Say "help" to hear what you can do.' })

    // 1. The global words.
    if (n.text === "help" || n.text === "?") {
      const hint =
        mode.kind === "browse"
          ? 'Pick a number, or say the words shown. Say "repeat" to hear this again.'
          : mode.kind === "value"
            ? 'Answer the question, or say "back" to go back.'
            : mode.kind === "readback"
              ? "Say yes or no."
              : `Only the word "${keywordOf(mode.pending.offer)}" goes ahead. Anything else does nothing. Say "cancel" to stop.`
      return turnFor({ full: true, hint })
    }
    if (n.text === "repeat") return turnFor({ full: true })
    if (n.text === "back" || n.text === "cancel") return backOut()

    switch (mode.kind) {
      case "browse": {
        const list = offers()
        const choices = choicesOf(list)
        const i = matchChoice(n.text, choices)
        if (i >= 0) return pick(list[i]!)
        return turnFor({
          problem: i === -2 ? `There is no option ${clip(n.text)}. Pick a number from 1 to ${list.length}.` : `I did not understand "${clip(n.raw)}". Pick a number from 1 to ${list.length}, or say one of: ${wordsList(choices.map((c) => c.label))}.`,
        })
      }
      case "value":
        return stepValue(mode.offer, n)
      case "readback": {
        const p = mode.pending
        if (n.text === "no") {
          mode = { kind: "value", offer: p.offer }
          return turnFor()
        }
        if (n.text === "yes" || n.text === normalize(keywordOf(p.offer), locale).text) return proceed(p, true)
        return turnFor({ problem: "Say yes or no." })
      }
      case "confirm": {
        const p = mode.pending
        if (n.text === "no") return backOut()
        if (n.text === normalize(keywordOf(p.offer), locale).text) return commit(p)
        return turnFor({ problem: "Nothing was done." })
      }
    }
  }

  function stepValue(o: Offer, n: Normalized): Turn {
    const ir = o.ir
    const opts = optionsOf(o)
    // A value is checked before it is read back or confirmed, so a wrong one is never read back.
    const proceedWith = (hasValue: boolean, value?: unknown): Turn => {
      if (hasValue) {
        const checked = validateReply(experience, { experience: experience.experience, node: ir.id, act: o.act, value })
        if (!checked.ok) return turnFor({ problem: checked.issues.map((i) => upperFirst(plainProblem(i.message))).join(" ") })
      }
      return proceed({ offer: o, hasValue, value }, false)
    }
    if (opts && ir.type === "Choice" && ir.multiple === true) {
      const ids: unknown[] = []
      for (const token of n.raw.split(",").map((t) => t.trim()).filter((t) => t !== "")) {
        const text = normalize(token, locale).text
        const i = matchChoice(text, opts)
        if (i < 0) return turnFor({ problem: `"${clip(token)}" is not one of the options.` })
        ids.push(opts[i]!.value)
      }
      return ids.length === 0 ? turnFor({ problem: "Pick at least one option." }) : proceedWith(true, ids)
    }
    if (opts) {
      const i = matchChoice(n.text, opts)
      if (i >= 0) return proceedWith(true, opts[i]!.value)
    }
    if ((ir.type === "Approval" || ir.type === "ExploreMore") && n.text === "skip") return proceedWith(false)
    if (opts && !(ir.type === "Preference" && ir.options === undefined)) {
      return turnFor({ problem: `I did not understand "${clip(n.raw)}". Pick a number from 1 to ${opts.length}, or say one of: ${wordsList(opts.map((x) => x.label))}.` })
    }
    const parsed = parseFree(o, n)
    if (!parsed.ok) return turnFor({ problem: parsed.problem })
    return proceedWith(true, parsed.value)
  }

  return {
    get turn() {
      return turn
    },
    get done() {
      return turn.state === "done"
    },
    answer(input: string): Outcome {
      replies = []
      try {
        turn = step(typeof input === "string" ? input : String(input))
      } catch {
        // Never throws: whatever went wrong, nothing was sent that was not validated, and the turn is asked again.
        try {
          turn = turnFor({ problem: "Something went wrong. Nothing was done." })
        } catch {
          turn = { ...turn, parts: [part("problem", "Something went wrong. Nothing was done."), ...turn.parts.filter((p) => p.kind !== "problem")] }
        }
      }
      return { turn, replies }
    },
  }
}
