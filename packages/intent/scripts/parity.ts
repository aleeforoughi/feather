// Writes the parity corpus the Python package (packages/python) is tested against: conformance/parity/ir.json and
// conformance/parity/reply.json. Each case is a document (or a reply) and what validate() / validateReply() in this
// package answers for it, issues in order with their messages. Python must give the same, word for word.
//   node packages/intent/scripts/parity.ts          (writes the corpus)
//   node packages/intent/scripts/parity.ts --check  (reports a stale corpus)
// The cases are deterministic: mutations of every valid fixture in conformance/ir/valid, thinned by a fixed stride.
import fs from "node:fs"
import path from "node:path"
import { NODE_SPECS, actsFor, validate, validateReply } from "../src/index.ts"
import type { Experience, IRNode } from "../src/index.ts"

const root = path.resolve(import.meta.dirname, "../../../conformance")
export const IR_CORPUS_PATH = path.join(root, "parity/ir.json")
export const REPLY_CORPUS_PATH = path.join(root, "parity/reply.json")
export const URL_CORPUS_PATH = path.join(root, "parity/url.json")

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }
type Obj = { [k: string]: Json }
type Loc = Array<string | number>
type IssueOut = { code: string; path: string; message: string; node?: string }
export type IrCase = { name: string; ir: Json; issues: IssueOut[] }
export type ReplyCase = { name: string; experience: string; reply: Json | null; issues: Array<{ code: string; message: string }> }
export type ReplyCorpus = { experiences: Record<string, Json>; cases: ReplyCase[] }

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const isObj = (v: Json | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)
export const load = (dir: string) =>
  fs
    .readdirSync(path.join(root, "ir", dir))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => [f.replace(/\.json$/, ""), JSON.parse(fs.readFileSync(path.join(root, "ir", dir, f), "utf8")) as { ir: Json; expect?: unknown }] as const)

/** Every `cap`-th mutation or so, from an offset that differs per fixture, so the corpus covers the kinds evenly. */
function thin<T>(items: T[], cap: number, offset: number): T[] {
  const stride = Math.max(1, Math.ceil(items.length / cap))
  return items.filter((_, i) => (i + offset) % stride === 0)
}

const pointer = (loc: Loc) => loc.map((s) => `/${String(s).replace(/~/g, "~0").replace(/\//g, "~1")}`).join("") || "(root)"
const getAt = (doc: Json, loc: Loc): Json => loc.reduce<Json>((v, k) => (v as Obj)[k as string], doc)
function setAt(doc: Json, loc: Loc, value: Json): Json {
  if (loc.length === 0) return value
  const parent = getAt(doc, loc.slice(0, -1)) as Obj
  parent[loc[loc.length - 1] as string] = value
  return doc
}
function removeAt(doc: Json, loc: Loc): Json {
  const parent = getAt(doc, loc.slice(0, -1))
  const last = loc[loc.length - 1]
  if (Array.isArray(parent)) parent.splice(last as number, 1)
  else delete (parent as Obj)[last as string]
  return doc
}
export function locations(v: Json, loc: Loc = [], out: Loc[] = []): Loc[] {
  if (loc.length) out.push(loc)
  if (Array.isArray(v)) v.forEach((x, i) => locations(x, [...loc, i], out))
  else if (isObj(v)) for (const k of Object.keys(v)) locations(v[k], [...loc, k], out)
  return out
}
const kindOf = (v: Json) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v)

/** Every generic mutation of one location: [label, apply]. */
export function mutationsAt(doc: Json, loc: Loc): Array<[string, (d: Json) => Json]> {
  const cur = getAt(doc, loc)
  const out: Array<[string, (d: Json) => Json]> = []
  const replace = (label: string, value: Json) => out.push([label, (d) => setAt(d, loc, clone(value))])
  out.push(["drop", (d) => removeAt(d, loc)])
  for (const [label, value] of [["number", 42], ["string", "x"], ["boolean", true], ["null", null], ["array", []], ["object", {}]] as Array<[string, Json]>) {
    if (kindOf(value) !== kindOf(cur)) replace(`wrong type (${label})`, value)
  }
  if (typeof cur === "string") {
    for (const [label, value] of [
      ["empty", ""], ["blank", "   "], ["too long", "x".repeat(5000)], ["emoji, many code points", "😀".repeat(70)], ["emoji, few code points", "😀".repeat(31)],
      ["bad id", "9 bad/id"], ["bogus value", "bogus"], ["lowercase currency", "usd"], ["impossible date", "2026-02-30"], ["bad time", "2026-10-03T25:00:00"], ["long id", `a${"b".repeat(64)}`],
    ] as Array<[string, string]>) replace(label, value)
  }
  if (typeof cur === "number") {
    for (const v of [-1, 0, 1.5, 2, 1e21, 1e-7, 123456789012345680000, 100000.5, -0.5]) replace(`number ${v}`, v)
  }
  if (typeof cur === "boolean") replace("flipped", !cur)
  if (Array.isArray(cur)) {
    if (cur.length) {
      out.push(["duplicate last item", (d) => ((getAt(d, loc) as Json[]).push(clone(cur[cur.length - 1])), d)])
      out.push(["drop last item", (d) => ((getAt(d, loc) as Json[]).pop(), d)])
    }
    out.push(["add null item", (d) => ((getAt(d, loc) as Json[]).push(null), d)])
    out.push(["add empty-string item", (d) => ((getAt(d, loc) as Json[]).push(""), d)])
    out.push(["add number item", (d) => ((getAt(d, loc) as Json[]).push(7), d)])
    replace("emptied", [])
  }
  if (isObj(cur)) {
    out.push(["add presentational field", (d) => (((getAt(d, loc) as Obj).color = "red"), d)])
    out.push(["add unknown field", (d) => (((getAt(d, loc) as Obj).zzz = 1), d)])
    out.push(["add field with slash", (d) => (((getAt(d, loc) as Obj)["a/b~c"] = 1), d)])
    const keys = Object.keys(cur)
    if (keys.length && keys[0].length > 2) {
      out.push([
        "misspell a field",
        (d) => {
          const o = getAt(d, loc) as Obj
          const k = keys[0]
          o[`${k.slice(1, 2)}${k.slice(0, 1)}${k.slice(2)}`] = o[k]
          delete o[k]
          return d
        },
      ])
    }
    replace("emptied", {})
  }
  return out
}

const nodesOf = (doc: Json) => ((doc as Obj).nodes as Obj[]) ?? []

/** Mutations that break a rule across nodes, aimed at the node types they concern. */
function targeted(base: Json): Array<[string, Json]> {
  const out: Array<[string, Json]> = []
  const add = (label: string, edit: (d: Obj, nodes: Obj[]) => void) => {
    const d = clone(base) as Obj
    try {
      edit(d, d.nodes as Obj[])
      out.push([label, d])
    } catch {
      // the edit does not apply to this fixture
    }
  }
  const nodes = nodesOf(base)
  if (nodes.length > 1) {
    add("duplicate id", (_, ns) => void (ns[ns.length - 1].id = ns[0].id))
    add("swap first two nodes", (_, ns) => void ([ns[0], ns[1]] = [ns[1], ns[0]]))
    add("reverse the nodes", (_, ns) => void ns.reverse())
    add("drop the first node", (_, ns) => void ns.shift())
  }
  add("duplicate the node list", (d, ns) => void (d.nodes = [...ns, ...clone(ns)]))
  add("no nodes", (d) => void (d.nodes = []))
  add("a second Recommendation without a target", (_, ns) => void ns.push({ type: "Recommendation", id: "extra_rec", intent: "decide", summary: "Another" }, { type: "Alternative", id: "extra_alt", intent: "other way" }))
  add("two primaries", (_, ns) => {
    const capable = ns.filter((n) => ["Action", "Choice", "Input", "Approval", "Recommendation", "IrreversibleAction"].includes(n.type as string))
    for (const n of capable.slice(0, 2)) n.primary = true
    if (capable.length < 2) ns.push({ type: "Action", id: "extra_primary", intent: "go", primary: true }, { type: "Action", id: "extra_primary_2", intent: "go on", primary: true })
  })
  add("primary on a node that cannot be", (_, ns) => void (ns.find((n) => !NODE_SPECS[n.type as string].primaryCapable)!.primary = true))
  add("primary false on a node that cannot be", (_, ns) => void (ns.find((n) => !NODE_SPECS[n.type as string].primaryCapable)!.primary = false))
  add("an irreversible act with nothing confirming it", (_, ns) => void ns.push({ type: "Action", id: "extra_act", intent: "do it", reversible: false }))
  add("an irreversible act confirmed by name", (_, ns) =>
    void ns.push({ type: "Action", id: "extra_act", intent: "do it", reversible: false }, { type: "IrreversibleAction", id: "extra_confirm", intent: "confirm it", consequence: { statement: "It is done." }, confirms: "extra_act" })
  )
  add("a confirmation of a reversible act", (_, ns) => void ns.push({ type: "Action", id: "extra_act", intent: "do it" }, { type: "IrreversibleAction", id: "extra_confirm", intent: "confirm it", consequence: { statement: "Done." }, confirms: "extra_act" }))
  add("a consequence with reversible true", (_, ns) => void ns.push({ type: "Approval", id: "extra_appr", intent: "approve", request: "May I?", consequence: { statement: "Yes." }, reversible: true }))
  add("irreversible action marked reversible", (_, ns) => void (ns.find((n) => n.type === "IrreversibleAction")!.reversible = true))
  add("irreversible action of low importance", (_, ns) => void (ns.find((n) => n.type === "IrreversibleAction")!.importance = "low"))
  add("irreversible action of normal importance", (_, ns) => void (ns.find((n) => n.type === "IrreversibleAction")!.importance = "normal"))
  add("irreversible action without a consequence", (_, ns) => void delete ns.find((n) => n.type === "IrreversibleAction")!.consequence)
  add("irreversible action with an empty consequence", (_, ns) => void (ns.find((n) => n.type === "IrreversibleAction")!.consequence = {}))
  add("irreversible action confirming itself", (_, ns) => {
    const n = ns.find((x) => x.type === "IrreversibleAction")!
    n.confirms = n.id
  })
  add("a second irreversible action", (_, ns) => void ns.push({ type: "IrreversibleAction", id: "extra_irrev", intent: "also do", consequence: { send: { to: "everyone", channel: "email" } } }))
  add("an empty expandable", (_, ns) => void (ns[0].expandable = {}))
  add("an expandable with a wrong entry", (_, ns) => void (ns[0].expandable = { why: 1, detail: "ok", more: "no" }))
  add("an act without intent", (_, ns) => void delete ns.find((n) => NODE_SPECS[n.type as string].act)!.intent)
  add("an act with a long intent", (_, ns) => void (ns.find((n) => NODE_SPECS[n.type as string].act)!.intent = "i".repeat(121)))
  add("an unknown node type close to a real one", (_, ns) => void (ns[0].type = "Recomendation"))
  add("a node type far from any real one", (_, ns) => void (ns[0].type = "Spaceship"))
  add("a node type that is not a string", (_, ns) => void (ns[0].type = 5))
  add("a node without a type", (_, ns) => void delete ns[0].type)
  add("a node that is not an object", (_, ns) => void ns.splice(0, 1, "text" as unknown as Obj, null as unknown as Obj, [] as unknown as Obj, 3 as unknown as Obj))
  add("a node id that is not a string", (_, ns) => void (ns[0].id = 7))
  add("an experience name with spaces", (d) => void (d.experience = "approve the campaign"))
  add("a locale that is not a tag", (d) => void (d.locale = "english_US"))
  add("a locale tag", (d) => void (d.locale = "ar-AE"))
  add("a locale of the wrong type", (d) => void (d.locale = 4))
  add("another ir version", (d) => void (d.ir = "feather.ir/1"))
  add("ir of the wrong type", (d) => void (d.ir = 0))
  add("no ir", (d) => void delete d.ir)
  add("no experience name", (d) => void delete d.experience)
  add("no nodes", (d) => void delete d.nodes)
  add("nodes that are not an array", (d) => void (d.nodes = { 0: "x" }))
  add("top-level presentational field", (d) => void (d.theme = "dark"))
  add("top-level typo", (d) => void (d.locales = "en"))
  add("integer-like key", (d) => void (d["10"] = 1))
  add("many broken nodes", (d) => void (d.nodes = Array.from({ length: 150 }, (_, i) => ({ type: "Text", id: i % 2 ? "bad id" : `n${i}`, text: i % 3 ? "" : 5 }))))
  add("exactly the issue limit", (d) => void (d.nodes = Array.from({ length: 100 }, () => ({ type: "Text", id: "t", text: "" }))))
  add("one past the issue limit", (d) => void (d.nodes = Array.from({ length: 101 }, () => ({ type: "Text", id: "t", text: "" }))))
  add("non-ASCII ids and names", (d, ns) => {
    d.experience = "épreuve"
    ns[0].id = "é"
    ns[0].zébra = 1
  })
  add("an emoji-heavy text", (_, ns) => void (ns.find((n) => n.type === "Text")!.text = "😀".repeat(2500)))
  add("a text of 4000 and one code points", (_, ns) => void (ns.find((n) => n.type === "Text")!.text = "é".repeat(4001)))
  add("a text of exactly 4000 code points", (_, ns) => void (ns.find((n) => n.type === "Text")!.text = "😀".repeat(4000)))
  add("a text with non-breaking spaces only", (_, ns) => void (ns.find((n) => n.type === "Text")!.text = "  ﻿"))
  add("a text with control characters", (_, ns) => void (ns.find((n) => n.type === "Text")!.text = "\u0001\u001f\u007f\u2028 \ud800"))

  // Per node type.
  const each = (type: string, label: string, edit: (n: Obj, ns: Obj[]) => void) => {
    nodes.forEach((n, i) => {
      if (n.type === type) add(`${label} (${n.id})`, (_, ns) => edit(ns[i], ns))
    })
  }
  each("Choice", "an unknown option selected", (n) => void (n.selected = ["nope"]))
  each("Choice", "two selected on a single choice", (n) => void (n.selected = (n.options as Obj[]).slice(0, 2).map((o) => o.id as string)))
  each("Choice", "several selected on a multiple choice", (n) => {
    n.multiple = true
    n.selected = (n.options as Obj[]).map((o) => o.id as string)
  })
  each("Choice", "a duplicate option", (n) => void ((n.options as Obj[])[1].id = (n.options as Obj[])[0].id))
  each("Choice", "one option", (n) => void ((n.options as Obj[]).length = 1))
  each("Choice", "an option that is not an object", (n) => void ((n.options as Json[])[0] = "a"))
  each("Choice", "an option without a label", (n) => void delete (n.options as Obj[])[0].label)
  each("Choice", "an option with a bad id", (n) => void ((n.options as Obj[])[0].id = "1 two"))
  each("Choice", "selected holding a number", (n) => void (n.selected = [1, "", "x"]))
  each("Choice", "a second prediction", (n, ns) => void ns.push({ type: "PredictedChoice", id: "pred_a", intent: "predict", of: n.id as string, option: (n.options as Obj[])[0].id as string }, { type: "PredictedChoice", id: "pred_b", intent: "predict", of: n.id as string, option: (n.options as Obj[])[1].id as string }))
  each("Choice", "a prediction against the selection", (n, ns) => {
    n.selected = [(n.options as Obj[])[0].id as string]
    ns.push({ type: "PredictedChoice", id: "pred_c", intent: "predict", of: n.id as string, option: (n.options as Obj[])[1].id as string })
  })
  each("PredictedChoice", "an unknown option predicted", (n) => void (n.option = "nope"))
  each("PredictedChoice", "no option", (n) => void delete n.option)
  each("PredictedChoice", "a prediction of something that is not a Choice", (n, ns) => void (n.of = ns.find((x) => x.type !== "Choice")!.id as string))
  each("PredictedChoice", "a prediction of itself", (n) => void (n.of = n.id as string))
  each("PredictedChoice", "a dangling prediction", (n) => void (n.of = "ghost"))
  each("Input", "min above max", (n) => {
    n.min = 10
    n.max = 1
  })
  each("Input", "a money input without a currency", (n) => {
    n.kind = "money"
    delete n.currency
  })
  each("Input", "a fractional maxLength", (n) => void (n.maxLength = 2.5))
  each("Input", "a zero maxLength", (n) => void (n.maxLength = 0))
  each("Input", "a value that is an object", (n) => void (n.value = { a: 1 }))
  each("Input", "a numeric value", (n) => void (n.value = 12.5))
  each("Input", "a kind that is not a kind", (n) => void (n.kind = "color"))
  each("Date", "an end before the start", (n) => {
    n.value = "2026-10-03T14:00:00Z"
    n.until = "2026-10-03T13:00:00Z"
  })
  each("Date", "an end before the start, zones apart", (n) => {
    n.value = "2026-10-03T14:00:00+04:00"
    n.until = "2026-10-03T08:00:00Z"
  })
  each("Date", "an end before the start, one floating", (n) => {
    n.value = "2026-10-03T14:00:00"
    n.until = "2026-10-03T08:00:00Z"
  })
  each("Date", "an end before the start, a day apart", (n) => {
    n.value = "2026-10-03"
    n.until = "2026-10-02"
  })
  for (const bad of ["2026-02-29", "2024-02-29", "2026-00-10", "2026-13-01", "2026-04-31", "2026-10-03T24:00:00", "2026-10-03T14:60", "2026-10-03T14:00+24:00", "2026-10-03T14:00:00.123Z", "2026-10-03T14", "10-03-2026", "2026-10-03 14:00", "0000-02-29", "1900-02-29", "2000-02-29", "2026-10-03T14:00:00+04:60"]) {
    each("Date", `the date ${bad}`, (n) => void (n.value = bad))
  }
  each("Price", "a negative amount", (n) => void (n.amount = -5))
  each("Price", "an amount as text", (n) => void (n.amount = "5"))
  each("Price", "a currency in lowercase", (n) => void (n.currency = "usd"))
  each("Price", "a bad period", (n) => void (n.period = "fortnight"))
  each("Location", "a latitude out of range", (n) => void (n.coordinates = { lat: 91, lng: 0 }))
  each("Location", "a longitude out of range", (n) => void (n.coordinates = { lat: 0, lng: -181 }))
  each("Location", "coordinates missing a part", (n) => void (n.coordinates = { lat: 10 }))
  each("Location", "coordinates in the wrong type", (n) => void (n.coordinates = [1, 2]))
  each("Progress", "a value above one", (n) => void (n.value = 1.5))
  each("Progress", "a duplicate step", (n) => void (n.steps = [{ id: "a", label: "A", state: "done" }, { id: "a", label: "B", state: "pending" }]))
  each("Progress", "a step in a bad state", (n) => void (n.steps = [{ id: "a", label: "A", state: "sleeping" }]))
  each("Media", "an image without alt", (n) => {
    n.kind = "image"
    delete n.alt
  })
  each("Media", "a video without alt, captions or transcript", (n) => {
    n.kind = "video"
    delete n.alt
    delete n.captions
    delete n.transcript
  })
  each("Media", "a video with a transcript but no alt", (n) => {
    n.kind = "video"
    delete n.alt
    n.transcript = "Words."
  })
  each("Media", "audio without a transcript", (n) => {
    n.kind = "audio"
    delete n.transcript
  })
  each("Media", "a document without anything", (n) => {
    n.kind = "document"
    delete n.alt
    delete n.transcript
  })
  each("Alternative", "an alternative before its target", (n, ns) => {
    ns.splice(ns.indexOf(n), 1)
    ns.unshift(n)
  })
  each("Alternative", "an alternative to itself", (n) => void (n.for = n.id as string))
  each("Alternative", "an alternative to a Text", (n, ns) => void (n.for = ns.find((x) => x.type === "Text")?.id ?? "ghost"))
  each("Alternative", "an alternative to nothing", (n) => void (n.for = "ghost"))
  each("Alternative", "an input kind that is not one", (n) => void (n.input = "Colour"))
  each("Alternative", "a long label", (n) => void (n.label = "l".repeat(61)))
  each("Tradeoff", "a tradeoff with nothing in it", (n) => {
    delete n.gains
    delete n.costs
  })
  each("Tradeoff", "a tradeoff with empty lists", (n) => {
    n.gains = []
    n.costs = []
  })
  each("Tradeoff", "gains that are not strings", (n) => void (n.gains = [1, "", "ok"]))
  each("Tradeoff", "a tradeoff of a Text", (n, ns) => void (n.of = ns.find((x) => x.type === "Text")?.id ?? "ghost"))
  each("Comparison", "a missing value", (n) => void delete ((n.criteria as Obj[])[0].values as Obj)[(n.items as string[])[0]])
  each("Comparison", "an extra value", (n) => void (((n.criteria as Obj[])[0].values as Obj).stranger = 1))
  each("Comparison", "a missing and an extra value", (n) => {
    const v = (n.criteria as Obj[])[0].values as Obj
    delete v[(n.items as string[])[0]]
    v.stranger = 1
    v.other = 2
  })
  each("Comparison", "a value that is an object", (n) => void (((n.criteria as Obj[])[0].values as Obj)[(n.items as string[])[0]] = { a: 1 }))
  each("Comparison", "a repeated item", (n) => void ((n.items as string[])[1] = (n.items as string[])[0]))
  each("Comparison", "one item", (n) => void ((n.items as string[]).length = 1))
  each("Comparison", "no criteria", (n) => void (n.criteria = []))
  each("Comparison", "an item that does not exist", (n) => void ((n.items as string[])[0] = "ghost"))
  each("Comparison", "an item that is itself", (n) => void ((n.items as string[])[0] = n.id as string))
  each("Comparison", "an item of the wrong type", (n, ns) => void ((n.items as string[])[0] = ns.find((x) => x.type === "Text")?.id as string))
  each("Preference", "a value not among the options", (n) => void (n.value = "nope"))
  each("Preference", "options of the wrong kind", (n) => void (n.options = [[], {}]))
  each("Preference", "one option", (n) => void (n.options = ["a"]))
  each("Preference", "a value of 1 among true and false", (n) => {
    n.options = [true, false]
    n.value = 1
  })
  each("Preference", "a value that is null", (n) => void (n.value = null))
  each("Approval", "a requester that is not a Person", (n, ns) => void (n.requester = ns.find((x) => x.type !== "Person")!.id as string))
  each("Approval", "a consequence of everything", (n) => void (n.consequence = { spend: { amount: -1, currency: "usd" }, publish: {}, send: { to: 5 }, consent: { to: "a" }, delete: [], statement: "", other: 1 }))
  each("Approval", "a consequence that is not an object", (n) => void (n.consequence = "yes"))
  each("Recommendation", "a confidence above one", (n) => void (n.confidence = 1.01))
  each("Recommendation", "a consequence and reversible true", (n) => {
    n.consequence = { statement: "It happens." }
    n.reversible = true
  })
  each("Recommendation", "irreversible without a consequence", (n) => void (n.reversible = false))
  each("Autopick", "an undo window of zero", (n) => void (n.undoWithin = 0))
  each("Autopick", "a fractional undo window", (n) => void (n.undoWithin = 1.5))
  each("Correction", "a target that does not exist", (n) => void (n.target = "ghost"))
  each("Correction", "a target that is itself", (n) => void (n.target = n.id as string))
  each("Confirmation", "a confirmation of a Text", (n, ns) => void (n.of = ns.find((x) => x.type === "Text")?.id ?? "ghost"))
  each("Confirmation", "a confirmation of nothing", (n) => void (n.of = "ghost"))
  each("Warning", "a bad severity", (n) => void (n.severity = "doom"))
  each("ExploreMore", "topics that are not strings", (n) => void (n.topics = [1]))
  each("Status", "a bad state", (n) => void (n.state = "sleeping"))
  each("Person", "a bad kind", (n) => void (n.kind = "robot"))
  each("Text", "text that is a number", (n) => void (n.text = 5))
  each("Text", "text that is null", (n) => void (n.text = null))
  return out
}

export function buildIrCorpus(): IrCase[] {
  const cases: IrCase[] = []
  const seen = new Set<string>()
  const push = (name: string, ir: Json) => {
    if (seen.has(name)) return
    seen.add(name)
    const doc = clone(ir)
    const result = validate(doc)
    cases.push({ name, ir: doc, issues: result.ok ? [] : (JSON.parse(JSON.stringify(result.issues)) as IssueOut[]) })
  }
  for (const [value, label] of [[null, "null"], [42, "a number"], ["text", "a string"], [[], "an array"], [true, "true"], [{}, "an empty object"], [[{ ir: "feather.ir/0" }], "an array with an object in it"]] as Array<[Json, string]>) {
    push(`document: ${label}`, value)
  }
  load("valid").forEach(([fixture, { ir }], f) => {
    push(`${fixture}: as it is`, ir)
    const generic: Array<[string, Json]> = []
    for (const loc of locations(ir)) {
      for (const [label, apply] of mutationsAt(ir, loc)) generic.push([`${fixture}: ${label} at ${pointer(loc)}`, apply(clone(ir))])
    }
    for (const [name, doc] of thin(generic, 10, f)) push(name, doc)
    for (const [label, doc] of thin(targeted(ir), 60, f)) push(`${fixture}: ${label}`, doc)
  })
  // The invalid fixtures too: their expected issues are checked separately, but the words are checked here.
  for (const [fixture, { ir }] of load("invalid")) push(`invalid/${fixture}`, ir)
  return cases
}

// ── Replies ─────────────────────────────────────────────────────────────────────────────────────────────────────

const optionIds = (n: Obj | undefined): string[] => (n && n.type === "Choice" ? (n.options as Obj[]).map((o) => o.id as string) : [])

/** A value that fits the act, when it takes one. */
function fits(n: Obj, act: string, ns: Obj[]): Json | undefined {
  switch (n.type) {
    case "Choice": {
      const ids = optionIds(n)
      return n.multiple === true ? [ids[0]] : ids[0]
    }
    case "PredictedChoice": {
      const ids = optionIds(ns.find((x) => x.id === n.of))
      return act === "change" ? (ids.find((i) => i !== n.option) ?? ids[0]) : undefined
    }
    case "Input": {
      if (act !== "submit") return undefined
      switch (n.kind) {
        case "number":
          return typeof n.min === "number" ? n.min : 5
        case "money":
          return typeof n.min === "number" ? n.min : 25
        case "email":
          return "person@example.com"
        case "phone":
          return "+971 50 123 4567"
        case "url":
          return "https://example.com/page"
        case "date":
          return "2026-10-03"
        default:
          return "hello there"
      }
    }
    case "Alternative":
      return n.input === "Price" ? { amount: 10, currency: "AED" } : n.input === "Date" ? "2026-10-03T14:00:00+04:00" : n.input ? "a word" : undefined
    case "Preference":
      return Array.isArray(n.options) ? n.options[n.options.length - 1] : (n.value ?? "x")
    case "Approval":
      return act === "reject" ? "not now" : undefined
    case "Correction":
      return "the right thing"
    case "ExploreMore":
      return Array.isArray(n.topics) ? n.topics[0] : undefined
    default:
      return undefined
  }
}

/** Values to try for a node's act: ones that fit and ones that do not, each labelled. */
function candidates(n: Obj, act: string, ns: Obj[]): Array<[string, Json | undefined]> {
  const out: Array<[string, Json | undefined]> = [["no value", undefined], ["fitting value", fits(n, act, ns)]]
  const common: Array<[string, Json]> = [
    ["null", null], ["empty string", ""], ["blank", "  "], ["word", "x"], ["zero", 0], ["one", 1], ["negative", -1], ["fraction", 1.5], ["true", true], ["false", false],
    ["empty array", []], ["array of a word", ["x"]], ["empty object", {}], ["amount object", { amount: 1, currency: "USD" }], ["impossible date", "2026-02-30"], ["date", "2026-10-03"],
    ["long string", "x".repeat(5000)], ["a long word list", "😀".repeat(70)], ["huge number", 1e21],
  ]
  out.push(...common)
  const ids = optionIds(n.type === "PredictedChoice" ? ns.find((x) => x.id === n.of) : n)
  if (n.type === "Choice" || n.type === "PredictedChoice") {
    out.push(["first option", ids[0]], ["second option", ids[1]], ["both options", ids.slice(0, 2)], ["repeated option", [ids[0], ids[0]]], ["unknown option", "nope"], ["unknown in array", [ids[0], "nope"]], ["the predicted option", n.option ?? ids[0]])
  }
  if (n.type === "Input") {
    out.push(["bad email", "not an email"], ["email with space", "a b@c.de"], ["url without scheme", "example.com"], ["url with a scheme", "mailto:me@example.com"], ["bad phone", "call me"], ["phone with letters", "+1 800 FLOWERS"], ["number as text", "5"])
    out.push(["above max", typeof n.max === "number" ? n.max + 1 : 1e9], ["below min", typeof n.min === "number" ? n.min - 1 : -1e9], ["too long for maxLength", "x".repeat(typeof n.maxLength === "number" ? n.maxLength + 1 : 4001)])
    for (const url of ["http://", "http://exa mple.com", "https://example.com:99999", "ftp://host", "file:///tmp/x", "http://1.2.3.4.5", "http://256.1.1.1", "javascript:alert(1)", "//example.com", "https://[::1]/x", "https://user@/x", "tel:+1555", "http:foo", "https://example.com/a b"]) out.push([`url ${url}`, url])
    out.push(["date-time", "2026-10-03T14:00:00Z"], ["bad date", "next week"])
  }
  if (n.type === "Alternative") {
    out.push(["negative price", { amount: -1, currency: "AED" }], ["price with extra key", { amount: 1, currency: "AED", tip: 2 }], ["price with bad currency", { amount: 1, currency: "aed" }], ["price with text amount", { amount: "1", currency: "AED" }], ["price in an array", [1, "AED"]])
  }
  if (n.type === "Preference") {
    const options = Array.isArray(n.options) ? n.options : []
    out.push(["each option", options[0]], ["current value", n.value as Json], ["not an option", "definitely not an option"])
  }
  if (n.type === "ExploreMore") out.push(["a topic", Array.isArray(n.topics) ? n.topics[0] : "x"], ["not a topic", "definitely not a topic"])
  return out
}

export function buildReplyCorpus(): ReplyCorpus {
  const experiences: Record<string, Json> = {}
  const cases: ReplyCase[] = []
  const seen = new Set<string>()
  const push = (fixture: string, label: string, reply: unknown) => {
    const name = `${fixture}: ${label}`
    if (seen.has(name)) return
    seen.add(name)
    const sent = reply === undefined ? null : (JSON.parse(JSON.stringify(reply)) as Json)
    const result = validateReply(experiences[fixture] as unknown as Experience, sent)
    cases.push({ name, experience: fixture, reply: sent, issues: result.ok ? [] : result.issues.map((i) => ({ code: i.code, message: i.message })) })
  }
  const valid = load("valid")
  valid.forEach(([fixture, { ir }], f) => {
    experiences[fixture] = ir
    const doc = ir as unknown as Experience
    const ns = doc.nodes as unknown as Obj[]
    const name = doc.experience
    const own: Array<[string, unknown]> = []
    for (const n of ns) {
      const spec = NODE_SPECS[n.type as string]
      const acts = [...Object.keys(spec.acts), "bogus"]
      const takes = new Set(actsFor(n as unknown as IRNode))
      for (const act of acts) {
        const base = { experience: name, node: n.id, act }
        const fit = act === "bogus" ? undefined : fits(n, act, ns)
        // Every act of every node, with the value that fits it: the replies a real person sends.
        push(fixture, `${act} on ${n.id}${takes.has(act) ? "" : " (not offered)"} with the fitting value`, fit === undefined ? base : { ...base, value: fit })
        for (const [label, value] of thin(candidates(n, act, ns), 14, f + String(n.id).length)) own.push([`${act} on ${n.id}: ${label}`, value === undefined ? base : { ...base, value }])
      }
      const first = Object.keys(spec.acts)[0] ?? "bogus"
      const base = { experience: name, node: n.id, act: first }
      push(fixture, `an extra field on ${n.id}`, { ...base, extra: 1 })
      push(fixture, `a presentational field on ${n.id}`, { ...base, "a/b": 1, color: "red" })
      push(fixture, `the wrong experience on ${n.id}`, { ...base, experience: "other" })
      push(fixture, `an experience that is a number on ${n.id}`, { ...base, experience: 5 })
      push(fixture, `no experience on ${n.id}`, { node: n.id, act: first })
      push(fixture, `no act on ${n.id}`, { experience: name, node: n.id })
      push(fixture, `an act that is a number on ${n.id}`, { ...base, act: 5 })
      push(fixture, `an act that is long on ${n.id}`, { ...base, act: "😀".repeat(80) })
    }
    for (const [label, reply] of thin(own, 40, f)) push(fixture, label, reply)
    push(fixture, "an unknown node", { experience: name, node: "ghost", act: "activate" })
    push(fixture, "a node that is a number", { experience: name, node: 5, act: "activate" })
    push(fixture, "a node that is a long word", { experience: name, node: "n".repeat(100), act: "activate" })
    push(fixture, "no node", { experience: name, act: "activate" })
    push(fixture, "an empty reply", {})
    push(fixture, "a reply that is null", null)
    push(fixture, "a reply that is a string", "activate")
    push(fixture, "a reply that is an array", [])
    push(fixture, "a reply that is a number", 5)
    push(fixture, "an integer-like key", { experience: name, node: ns[0].id, act: "x", 7: 1 })
  })
  // An experience that is not valid: nothing can be replied to.
  for (const [fixture, { ir }] of load("invalid").slice(0, 8)) {
    experiences[`invalid/${fixture}`] = ir
    push(`invalid/${fixture}`, "any reply", { experience: "x", node: "y", act: "z" })
  }
  return { experiences, cases }
}

/**
 * What URL.canParse says for strings a url Input might be answered with. validateReply() uses it, and the Python
 * package has no WHATWG URL parser, so it carries an approximation that these cases hold to.
 */
export function buildUrlCorpus(): Array<[string, boolean]> {
  const urls = [
    "http://", "http://exa mple.com", "https://example.com:99999", "ftp://host", "file:///tmp/x", "http://1.2.3.4.5", "http://256.1.1.1", "javascript:alert(1)", "//example.com",
    "https://[::1]/x", "https://user@/x", "tel:+1555", "http:foo", "https://example.com/a b", "example.com", "mailto:me@example.com", "http://a_b.com", "http://-a.com",
    "http://a..b", "http://999", "http://0x7f.1", "http://1.2.3", "http://1.2.3.4/", "https://exa%20mple.com", "https://ex%zzample.com", "http://[::1", "http://[zz]",
    "http://[1:2:3:4:5:6:7:8]/", "foo://", "foo://bar", "foo://ba r", "foo://[::1]:80/x", "foo:/bar", "foo:", "a:", "1a:b", "  https://example.com  ", "https://example.com\n",
    "http://exa\tmple.com", "http://example.com:80:80", "http://example.com:", "http://:80", "http://user:pw@host:80/x?y#z", "http://host#frag", "http://host?q", "http://ho st/",
    "HTTP://EXAMPLE.COM", "https://日本語.jp", "https://xn--bad-.com", "http://a b@host", "http://@host", "http://us@@host", "ws://x", "wss:", "about:blank", "data:text/plain,hi",
    "blob:http://x", "http:///x", "http:\\\\x\\y", "https:example.com", "https:/example.com", "file:", "urn:isbn:1", "http://exa<mple.com", "http://exa|mple.com", "http://1e3",
    "http://4294967296", "http://0.0.0.0", "http://0300.0250.0.1", "http://example.com./", "http://..", "http://.", "http://1..2", "http://a.1", "http://a.0x", "http://0x",
    "https://%", "http://%41.com", "http://ex ample", "git+ssh://git@github.com/x", "x-y.z+w:1", "1http://x", "http://[::1]:99999", "http://[::ffff:1.2.3.4]", "http://[::1]x",
    "https://example.com", "https://example.com/page?x=1#top", "", " ", "http", "://", "https://exa\u0000mple.com", "https://ex\u00adample.com", "https://EXAMPLE.com:0080/",
  ]
  return urls.map((u) => [u, URL.canParse(u)])
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
if (isMain) {
  const check = process.argv.includes("--check")
  const ir = buildIrCorpus()
  const replies = buildReplyCorpus()
  const outputs: Array<[string, string, number]> = [
    [IR_CORPUS_PATH, `${JSON.stringify(ir)}\n`, ir.length],
    [REPLY_CORPUS_PATH, `${JSON.stringify(replies)}\n`, replies.cases.length],
    [URL_CORPUS_PATH, `${JSON.stringify(buildUrlCorpus())}\n`, buildUrlCorpus().length],
  ]
  let stale = false
  for (const [file, content, count] of outputs) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
    if (current === content) {
      console.log(`${path.relative(process.cwd(), file)} is up to date (${count} cases)`)
      continue
    }
    stale = true
    if (check) console.log(`${path.relative(process.cwd(), file)} is out of date`)
    else {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, content)
      console.log(`wrote ${path.relative(process.cwd(), file)} (${count} cases)`)
    }
  }
  if (check && stale) process.exit(1)
}
