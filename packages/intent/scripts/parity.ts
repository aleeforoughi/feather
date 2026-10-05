// Writes the parity corpus the Python package (packages/python) is tested against: conformance/parity/ir.json and
// conformance/parity/reply.json. Each case is a document (or a reply) and what validate() / validateReply() in this
// package answers for it, issues in order with their messages. Python must give the same, word for word.
//   node packages/intent/scripts/parity.ts          (writes the corpus)
//   node packages/intent/scripts/parity.ts --check  (reports a stale corpus)
// The cases are deterministic: mutations of every valid fixture in conformance/ir/valid, thinned by a fixed stride.
import fs from "node:fs"
import path from "node:path"
import { NODE_SPECS, actsFor, applyUpdate, validate, validateReply } from "../src/index.ts"
import type { Experience, IRNode } from "../src/index.ts"

const root = path.resolve(import.meta.dirname, "../../../conformance")
export const IR_CORPUS_PATH = path.join(root, "parity/ir.json")
export const REPLY_CORPUS_PATH = path.join(root, "parity/reply.json")
export const UPDATE_CORPUS_PATH = path.join(root, "parity/update.json")
export const URL_CORPUS_PATH = path.join(root, "parity/url.json")

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }
type Obj = { [k: string]: Json }
type Loc = Array<string | number>
type IssueOut = { code: string; path: string; message: string; node?: string }
export type IrCase = { name: string; ir: Json; issues: IssueOut[] }
export type ReplyCase = { name: string; experience: string; reply: Json | null; issues: Array<{ code: string; message: string }> }
/** An update, the experience it is applied to (a key into `experiences`), and what applyUpdate() answers: the experience it makes, or its issues. */
export type UpdateCase = { name: string; experience: string; update: Json; ok: boolean; result?: Json; issues?: Array<{ code: string; path: string; message: string }> }
export type UpdateCorpus = { experiences: Record<string, Json>; cases: UpdateCase[] }
export type ReplyCorpus ={ experiences: Record<string, Json>; cases: ReplyCase[] }

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
    const capable = ns.filter((n) => ["Action", "Choice", "Input", "Form", "Approval", "Recommendation", "IrreversibleAction"].includes(n.type as string))
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
  each("Form", "no fields", (n) => void (n.fields = []))
  each("Form", "fields that are not a list", (n) => void (n.fields = { a: 1 }))
  each("Form", "a field that is not an object", (n) => void ((n.fields as Json[])[0] = "a field"))
  each("Form", "two fields with one id", (n) => void ((n.fields as Obj[]).push({ ...(n.fields as Obj[])[0] })))
  each("Form", "a field without an id", (n) => void delete (n.fields as Obj[])[0].id)
  each("Form", "a field with a bad id", (n) => void ((n.fields as Obj[])[0].id = "1st field"))
  each("Form", "a field without a prompt", (n) => void delete (n.fields as Obj[])[0].prompt)
  each("Form", "a field without a kind", (n) => void delete (n.fields as Obj[])[0].kind)
  each("Form", "a field kind that is not a kind", (n) => void ((n.fields as Obj[])[0].kind = "color"))
  each("Form", "a money field without a currency", (n) => {
    const f = (n.fields as Obj[])[0]
    f.kind = "money"
    delete f.currency
  })
  each("Form", "a field with min above max", (n) => {
    const f = (n.fields as Obj[])[0]
    f.min = 10
    f.max = 1
  })
  each("Form", "a field with a presentational key", (n) => void ((n.fields as Obj[])[0].color = "red"))
  each("Form", "a field with an unknown key", (n) => void ((n.fields as Obj[])[0].hint = "x"))
  each("Form", "a group too long", (n) => void ((n.fields as Obj[])[0].group = "g".repeat(61)))
  each("Form", "a submit label too long", (n) => void (n.submitLabel = "s".repeat(61)))
  each("Form", "no intent", (n) => void delete n.intent)
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
  for (const [value, label] of [[null, "null"], [42, "a number"], ["text", "a string"], [[], "an array"], [true, "true"], [{}, "an empty object"], [[{ ir: "feather.ir/1" }], "an array with an object in it"]] as Array<[Json, string]>) {
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
  // L6: revision and resolution, branch by branch.
  for (const [name, doc] of lifecycleDocuments()) push(name, doc)
  // The invalid fixtures too: their expected issues are checked separately, but the words are checked here.
  for (const [fixture, { ir }] of load("invalid")) push(`invalid/${fixture}`, ir)
  return cases
}

const TEXT: Obj = { type: "Text", id: "intro", text: "Hello." }
const DONE: Obj = { outcome: "done", summary: "Booked: direct flight, 9:40." }

/** Documents that exercise `revision`, `resolved` and the nodes rule that depends on it, one branch each. */
function lifecycleDocuments(): Array<[string, Json]> {
  const out: Array<[string, Json]> = []
  const doc = (label: string, extra: Obj, nodes: Json | undefined = [TEXT]) => {
    const d: Obj = { ir: "feather.ir/1", experience: "plan_trip", ...clone(extra) }
    if (nodes !== undefined) d.nodes = clone(nodes)
    out.push([`lifecycle: ${label}`, d])
  }
  for (const [label, revision] of [
    ["0", 0], ["1", 1], ["7", 7], ["-1", -1], ["1.5", 1.5], ["1e21", 1e21], ["2.0 as an integer", 2], ["a string", "1"], ["null", null], ["true", true], ["an array", []], ["an object", {}], ["huge", 123456789012345680000],
  ] as Array<[string, Json]>) doc(`revision ${label}`, { revision })
  doc("no revision", {})
  // Resolutions, valid.
  doc("resolved with no nodes", { resolved: DONE }, [])
  doc("resolved with nodes", { resolved: DONE })
  doc("resolved, revision and no nodes", { revision: 3, resolved: DONE }, [])
  doc("resolved cancelled", { resolved: { outcome: "cancelled", summary: "Cancelled." } }, [])
  doc("resolved failed", { resolved: { outcome: "failed", summary: "The flight sold out." } }, [])
  doc("resolved with a minimal artifact", { resolved: { ...DONE, artifact: { label: "Receipt" } } }, [])
  for (const kind of ["document", "image", "video", "audio", "link", "data"]) doc(`artifact of kind ${kind}`, { resolved: { ...DONE, artifact: { label: "Thing", href: "https://example.com/x", kind } } }, [])
  doc("artifact with a non-http href", { resolved: { ...DONE, artifact: { label: "Thing", href: "javascript:alert(1)" } } }, [])
  doc("summary of exactly 120 code points", { resolved: { outcome: "done", summary: "😀".repeat(120) } }, [])
  doc("summary of 121 code points", { resolved: { outcome: "done", summary: "😀".repeat(121) } }, [])
  doc("summary of 120 letters", { resolved: { outcome: "done", summary: "é".repeat(120) } }, [])
  doc("artifact label of 121 code points", { resolved: { ...DONE, artifact: { label: "x".repeat(121) } } }, [])
  doc("artifact label of 120 code points", { resolved: { ...DONE, artifact: { label: "x".repeat(120) } } }, [])
  doc("artifact href of 4001 code points", { resolved: { ...DONE, artifact: { label: "x", href: "h".repeat(4001) } } }, [])
  doc("artifact href of 4000 code points", { resolved: { ...DONE, artifact: { label: "x", href: "h".repeat(4000) } } }, [])
  // Resolutions, invalid: each branch of the check.
  for (const [label, resolved] of [
    ["null", null], ["a string", "done"], ["an array", []], ["a number", 3], ["an empty object", {}], ["a boolean", false],
    ["no outcome", { summary: "x" }], ["an outcome that is a number", { outcome: 1, summary: "x" }], ["an unknown outcome", { outcome: "finished", summary: "x" }], ["an outcome in capitals", { outcome: "DONE", summary: "x" }],
    ["a null outcome", { outcome: null, summary: "x" }],
    ["no summary", { outcome: "done" }], ["a summary that is a number", { outcome: "done", summary: 5 }], ["a null summary", { outcome: "done", summary: null }], ["an empty summary", { outcome: "done", summary: "" }], ["a blank summary", { outcome: "done", summary: "  \t " }],
    ["a summary over several lines", { outcome: "done", summary: "One.\nTwo." }], ["a summary ending in a newline", { outcome: "done", summary: "One.\n" }], ["a summary that is too long", { outcome: "done", summary: "x".repeat(121) }],
    ["a long summary over several lines", { outcome: "done", summary: `${"x".repeat(130)}\ny` }], ["a summary with a carriage return", { outcome: "done", summary: "One.\rTwo." }],
    ["a presentational field", { ...DONE, color: "green" }], ["an unknown field", { ...DONE, reason: "x" }], ["a misspelled field", { ...DONE, sumary: "x" }], ["a field with a slash", { ...DONE, "a/b~c": 1 }],
    ["an op field", { ...DONE, op: "resolve" }], ["an integer-like key", { ...DONE, 7: 1 }],
    ["an artifact that is null", { ...DONE, artifact: null }], ["an artifact that is a string", { ...DONE, artifact: "x" }], ["an artifact that is an array", { ...DONE, artifact: [] }], ["an empty artifact", { ...DONE, artifact: {} }],
    ["an artifact without a label", { ...DONE, artifact: { href: "https://example.com" } }], ["an artifact label that is a number", { ...DONE, artifact: { label: 5 } }], ["an empty artifact label", { ...DONE, artifact: { label: "" } }], ["a blank artifact label", { ...DONE, artifact: { label: "   " } }],
    ["a too long artifact label", { ...DONE, artifact: { label: "x".repeat(200) } }], ["an artifact href that is a number", { ...DONE, artifact: { label: "x", href: 5 } }], ["an empty artifact href", { ...DONE, artifact: { label: "x", href: "" } }],
    ["a blank artifact href", { ...DONE, artifact: { label: "x", href: " " } }], ["a too long artifact href", { ...DONE, artifact: { label: "x", href: "h".repeat(5000) } }], ["an unknown artifact kind", { ...DONE, artifact: { label: "x", kind: "archive" } }],
    ["an artifact kind that is a number", { ...DONE, artifact: { label: "x", kind: 1 } }], ["a null artifact kind", { ...DONE, artifact: { label: "x", kind: null } }], ["an artifact with a presentational field", { ...DONE, artifact: { label: "x", icon: "file" } }],
    ["an artifact with an unknown field", { ...DONE, artifact: { label: "x", size: 1, mime: "x" } }], ["an artifact with a misspelled field", { ...DONE, artifact: { lable: "x" } }],
    ["everything wrong", { outcome: "x", summary: "", artifact: { label: 1, href: 2, kind: 3, zzz: 4 }, color: "red" }],
  ] as Array<[string, Json]>) {
    doc(`resolution is ${label}`, { resolved }, [])
    doc(`resolution is ${label}, with nodes`, { resolved })
  }
  // Nodes, open and resolved.
  doc("open with empty nodes", {}, [])
  doc("open with revision and empty nodes", { revision: 2 }, [])
  doc("resolved with no nodes field", { resolved: DONE }, undefined)
  doc("resolved with nodes that are not an array", { resolved: DONE }, { 0: TEXT })
  doc("resolved with a null node", { resolved: DONE }, [null])
  doc("resolved with a broken node", { resolved: DONE }, [{ type: "Text", id: "t", text: "" }])
  doc("resolved with duplicate nodes", { resolved: DONE }, [TEXT, TEXT])
  doc("resolved with two primaries", { resolved: DONE }, [{ type: "Action", id: "a", intent: "go", primary: true }, { type: "Action", id: "b", intent: "go on", primary: true }])
  doc("a broken resolution and a broken revision and empty nodes", { revision: -2, resolved: { outcome: "x" } }, [])
  doc("a broken revision, open, with empty nodes", { revision: "x" }, [])
  doc("a top-level resolved typo", { resolvd: DONE }, [])
  doc("resolved in a document with a locale", { locale: "ar-AE", revision: 1, resolved: DONE }, [])
  return out
}

// ── Replies ─────────────────────────────────────────────────────────────────────────────────────────────────────

const optionIds = (n: Obj | undefined): string[] => (n && n.type === "Choice" ? (n.options as Obj[]).map((o) => o.id as string) : [])

/** An answer that fits what an Input, or a Form field, asks for. */
function answerFor(n: Obj): Json {
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
    case "Input":
      return act === "submit" ? answerFor(n) : undefined
    case "Form":
      return act === "submit" ? Object.fromEntries((n.fields as Obj[]).map((f) => [f.id as string, answerFor(f)])) : undefined
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
  if (n.type === "Form" && act === "submit") {
    const fields = n.fields as Obj[]
    const all = fits(n, act, ns) as Record<string, Json>
    const first = fields[0].id as string
    const required = fields.filter((f) => f.required === true).map((f) => f.id as string)
    const without = (id: string) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== id))
    out.push(["every field", all], ["only the first field", { [first]: all[first] }], ["an unknown field", { ...all, nope: "x" }], ["an array of answers", Object.values(all)])
    for (const id of required) out.push([`without required ${id}`, without(id)])
    for (const f of fields) {
      const id = f.id as string
      out.push([`${id} blank`, { ...all, [id]: "  " }], [`${id} as a number`, { ...all, [id]: 5 }], [`${id} as text`, { ...all, [id]: "five" }], [`${id} null`, { ...all, [id]: null }], [`${id} too long`, { ...all, [id]: "x".repeat(typeof f.maxLength === "number" ? f.maxLength + 1 : 4001) }])
      if (f.kind === "email") out.push([`${id} not an email`, { ...all, [id]: "not an email" }])
      if (f.kind === "phone") out.push([`${id} not a phone`, { ...all, [id]: "call me" }])
      if (f.kind === "date") out.push([`${id} not a date`, { ...all, [id]: "next week" }], [`${id} impossible date`, { ...all, [id]: "2026-02-30" }])
      if (typeof f.min === "number") out.push([`${id} below min`, { ...all, [id]: (f.min as number) - 1 }])
    }
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
    push(fixture, "an integer-like key", { experience: name, node: ns[0]?.id ?? "ghost", act: "x", 7: 1 })
  })
  // A resolved experience takes no replies, whatever they are (L6): the ones that would have fit, and ones that never would.
  const ended: Array<[string, Json]> = [
    ["no nodes", { ir: "feather.ir/1", experience: "plan_trip", revision: 2, resolved: { outcome: "done", summary: "Booked." }, nodes: [] }],
    ["cancelled, with its history", { ir: "feather.ir/1", experience: "plan_trip", resolved: { outcome: "cancelled", summary: "Cancelled.", artifact: { label: "Receipt" } }, nodes: [{ type: "Approval", id: "ok", intent: "approve", request: "Book it?" }, { type: "Text", id: "t", text: "Done." }] }],
    ["failed", { ir: "feather.ir/1", experience: "plan_trip", revision: 5, resolved: { outcome: "failed", summary: "Sold out." }, nodes: [{ type: "Action", id: "go", intent: "go" }] }],
  ]
  for (const [label, ir] of ended) {
    const key = `resolved/${label}`
    experiences[key] = ir
    const nodeId = ((ir as Obj).nodes as Obj[])[0]?.id ?? "ghost"
    push(key, "an act on a node", { experience: "plan_trip", node: nodeId, act: "approve" })
    push(key, "an act on a node that is not there", { experience: "plan_trip", node: "ghost", act: "activate" })
    push(key, "the wrong experience", { experience: "other", node: nodeId, act: "activate" })
    push(key, "an empty reply", {})
    push(key, "a reply that is null", null)
    push(key, "a reply that is a number", 5)
    push(key, "a reply with an extra field", { experience: "plan_trip", node: nodeId, act: "activate", extra: 1 })
  }
  // The same for the resolved fixtures, and for a resolution that is not valid: the experience is judged first.
  experiences["resolved/invalid resolution"] = { ir: "feather.ir/1", experience: "plan_trip", resolved: { outcome: "finished", summary: "" }, nodes: [] }
  experiences["resolved/invalid revision"] = { ir: "feather.ir/1", experience: "plan_trip", revision: -1, resolved: { outcome: "done", summary: "x" }, nodes: [] }
  for (const key of ["resolved/invalid resolution", "resolved/invalid revision"]) push(key, "any reply", { experience: "plan_trip", node: "y", act: "z" })
  // An experience that is not valid: nothing can be replied to.
  for (const [fixture, { ir }] of load("invalid").slice(0, 8)) {
    experiences[`invalid/${fixture}`] = ir
    push(`invalid/${fixture}`, "any reply", { experience: "x", node: "y", act: "z" })
  }
  return { experiences, cases }
}

// ── Updates (L6) ──────────────────────────────────────────────────────────────────────────────────────────────

const updateFixtures = (dir: string) =>
  fs
    .readdirSync(path.join(root, "update", dir))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => [f.replace(/\.json$/, ""), JSON.parse(fs.readFileSync(path.join(root, "update", dir, f), "utf8")) as Obj] as const)

const TRIP: Obj = {
  ir: "feather.ir/1",
  experience: "plan_trip",
  locale: "en",
  revision: 4,
  nodes: [
    { type: "Progress", id: "work", label: "Finding flights", value: 0.5, steps: [{ id: "search", label: "Search", state: "done" }, { id: "rank", label: "Rank", state: "active" }] },
    { type: "Text", id: "intro", text: "Hello." },
    { type: "Recommendation", id: "rec", intent: "take the flight", summary: "Direct, 9:40", confidence: 0.8 },
    { type: "Action", id: "go", intent: "see more" },
  ],
}

/** What applyUpdate() answers for the updates the conformance fixtures hold, and for ones that reach every branch of it. */
export function buildUpdateCorpus(): UpdateCorpus {
  const experiences: Record<string, Json> = {}
  const cases: UpdateCase[] = []
  const seen = new Set<string>()
  const push = (name: string, key: string, update: unknown) => {
    if (seen.has(name)) return
    seen.add(name)
    const sent = JSON.parse(JSON.stringify(update ?? null)) as Json
    const result = applyUpdate(experiences[key] as unknown as Experience, sent)
    cases.push(
      result.ok
        ? { name, experience: key, update: sent, ok: true, result: JSON.parse(JSON.stringify(result.experience)) as Json }
        : { name, experience: key, update: sent, ok: false, issues: result.issues.map((i) => ({ code: i.code, path: i.path, message: i.message })) },
    )
  }

  for (const [name, fixture] of updateFixtures("valid")) {
    // A stream: each update applies to what the one before it made.
    let current = fixture.experience as Json
    ;(fixture.updates as Json[]).forEach((u, i) => {
      const key = `valid/${name}@${i}`
      experiences[key] = current
      push(`valid/${name}: update ${i + 1}`, key, u)
      const result = applyUpdate(current as unknown as Experience, u)
      if (!result.ok) throw new Error(`valid update fixture ${name} (${i + 1}) is refused: ${JSON.stringify(result.issues)}`)
      current = JSON.parse(JSON.stringify(result.experience)) as Json
    })
  }
  for (const [name, fixture] of updateFixtures("invalid")) {
    const key = `invalid/${name}`
    experiences[key] = fixture.experience as Json
    push(key, key, fixture.update)
  }

  experiences.trip = TRIP
  const noRevision = clone(TRIP)
  delete noRevision.revision
  experiences["trip without a revision"] = noRevision
  experiences.single = { ir: "feather.ir/1", experience: "plan_trip", revision: 1, nodes: [{ type: "Text", id: "only", text: "Only." }] }
  experiences.resolved = load("valid").find(([n]) => n === "resolved-booking")![1].ir
  experiences["resolved with history"] = load("valid").find(([n]) => n === "resolved-cancelled-with-history")![1].ir
  experiences["not valid"] = { ir: "feather.ir/1", experience: "plan_trip", nodes: [] }
  experiences["not an experience"] = 5
  experiences["with a primary"] = { ir: "feather.ir/1", experience: "plan_trip", revision: 0, nodes: [{ type: "Action", id: "a", intent: "go", primary: true }, { type: "Text", id: "t", text: "x" }] }
  experiences["revision 2.0"] = { ir: "feather.ir/1", experience: "plan_trip", revision: 2.0, nodes: [{ type: "Text", id: "t", text: "x" }] }

  const u = (revision: unknown, ops: unknown, extra: Obj = {}): Obj => ({ update: "feather.update/1", experience: "plan_trip", revision, ops, ...extra }) as Obj
  const text = (id: string, body = "Hi."): Obj => ({ type: "Text", id, text: body })
  const run = (label: string, update: unknown, key = "trip") => push(`${key}: ${label}`, key, update)
  const next: Record<string, number> = { trip: 5, single: 2, "trip without a revision": 1, "with a primary": 1 }
  const ops = (label: string, list: unknown, key = "trip", revision: number = next[key]) => run(label, u(revision, list), key)

  // The update itself.
  for (const [label, value] of [["null", null], ["a number", 5], ["a string", "x"], ["an array", []], ["true", true], ["an empty object", {}]] as Array<[string, Json]>) run(`the update is ${label}`, value)
  run("an extra field", u(5, [{ op: "remove", id: "go" }], { extra: 1 }))
  run("a presentational field", u(5, [{ op: "remove", id: "go" }], { theme: "dark" }))
  run("a misspelled field", u(5, [{ op: "remove", id: "go" }], { opps: [] }))
  run("an integer-like key and a slash key", u(5, [{ op: "remove", id: "go" }], { 7: 1, "a/b": 2 }))
  const noUpdate = u(5, [{ op: "remove", id: "go" }])
  delete noUpdate.update
  run("no update version", noUpdate)
  for (const [label, value] of [["another version", "feather.update/1"], ["a number", 0], ["null", null], ["an ir version", "feather.ir/1"], ["an empty string", ""], ["a long string", "😀".repeat(60)]] as Array<[string, Json]>) run(`update version is ${label}`, u(5, [{ op: "remove", id: "go" }], { update: value }))
  run("an unsupported version and a wrong experience", u(5, [], { update: "x", experience: "other" }))
  const noExperience = u(5, [{ op: "remove", id: "go" }])
  delete noExperience.experience
  run("no experience", noExperience)
  for (const [label, value] of [["another", "other_trip"], ["a number", 5], ["null", null], ["an empty string", ""], ["a long string", "x".repeat(100)]] as Array<[string, Json]>) run(`the experience is ${label}`, u(5, [{ op: "remove", id: "go" }], { experience: value }))
  const noRev = u(5, [{ op: "remove", id: "go" }])
  delete noRev.revision
  run("no revision", noRev)
  for (const [label, value] of [["the same", 4], ["behind", 3], ["zero", 0], ["negative", -1], ["two ahead", 6], ["far ahead", 1000], ["a fraction", 5.5], ["a string", "5"], ["null", null], ["true", true], ["an array", [5]], ["an object", {}], ["huge", 1e21]] as Array<[string, Json]>) {
    run(`revision is ${label}`, u(value, [{ op: "remove", id: "go" }]))
  }
  run("a stale revision and a bad op", u(9, [{ op: "nope" }]))
  run("a stale revision and an empty update", u(9, []))
  run("a stale revision on an experience with no revision", u(2, [{ op: "remove", id: "go" }]), "trip without a revision")
  run("the first update", u(1, [{ op: "remove", id: "go" }]), "trip without a revision")
  run("the first update, from revision 0", u(1, [{ op: "remove", id: "a" }]), "with a primary")
  run("a revision written 2.0 on the experience", u(3, [{ op: "remove", id: "t" }, { op: "add", node: text("u") }]), "revision 2.0")
  run("a stale revision on a revision written 2.0", u(2, [{ op: "remove", id: "t" }]), "revision 2.0")
  run("a missing revision on a revision written 2.0", { update: "feather.update/1", experience: "plan_trip", ops: [] }, "revision 2.0")

  // The experience it applies to.
  run("an experience that is not valid", u(1, [{ op: "add", node: text("t") }]), "not valid")
  run("an experience that is not an object", u(1, [{ op: "add", node: text("t") }]), "not an experience")
  run("a resolved experience", u(4, [{ op: "add", node: text("t") }]), "resolved")
  run("a resolved experience and a stale revision", u(9, [{ op: "add", node: text("t") }]), "resolved")
  run("a resolved experience and no ops", { update: "feather.update/1", experience: "plan_trip", revision: 4 }, "resolved")
  run("a resolved experience, wrong experience", u(4, [], { experience: "x" }), "resolved")
  run("a resolved experience with history", u(1, [{ op: "remove", id: "t" }]), "resolved with history")

  // Ops, as a list.
  run("no ops", u(5, undefined))
  for (const [label, value] of [["an object", { op: "remove" }], ["a string", "remove"], ["null", null], ["a number", 3]] as Array<[string, Json]>) run(`ops is ${label}`, u(5, value))
  ops("an empty list", [])
  for (const [label, value] of [["null", null], ["a number", 5], ["a string", "remove"], ["an array", []], ["true", true]] as Array<[string, Json]>) ops(`an op that is ${label}`, [value])
  ops("an op with no name", [{ id: "go" }])
  for (const [label, value] of [["unknown", "destroy"], ["a number", 5], ["null", null], ["in capitals", "REMOVE"], ["empty", ""], ["a prototype key", "toString"], ["__proto__", "__proto__"], ["an array", ["add"]], ["constructor", "constructor"]] as Array<[string, Json]>) ops(`an op that is ${label}`, [{ op: value, id: "go" }])
  ops("a good op, then a bad one", [{ op: "remove", id: "go" }, { op: "destroy" }])
  ops("a bad op, then a good one", [{ op: "destroy" }, { op: "remove", id: "go" }])
  ops("several bad ops", [null, { op: "x" }, { id: "go" }, { op: "remove" }, { op: "patch", id: "ghost", set: { a: 1 } }])

  // add
  ops("add at the end", [{ op: "add", node: text("t") }])
  ops("add after a node", [{ op: "add", node: text("t"), after: "work" }])
  ops("add after the last node", [{ op: "add", node: text("t"), after: "go" }])
  ops("add several, in order", [{ op: "add", node: text("a"), after: "work" }, { op: "add", node: text("b"), after: "a" }, { op: "add", node: text("c") }])
  ops("add after a node an earlier op added", [{ op: "add", node: text("a") }, { op: "add", node: text("b"), after: "a" }])
  ops("add after a node an earlier op removed", [{ op: "remove", id: "intro" }, { op: "add", node: text("b"), after: "intro" }])
  ops("add with an id an earlier op removed", [{ op: "remove", id: "intro" }, { op: "add", node: text("intro", "Again.") }])
  ops("add an id that is there", [{ op: "add", node: text("intro") }])
  ops("add an id an earlier op added", [{ op: "add", node: text("a") }, { op: "add", node: text("a") }])
  ops("add after a node that is not there", [{ op: "add", node: text("t"), after: "ghost" }])
  for (const [label, value] of [["a number", 5], ["null", null], ["an object", {}], ["an array", ["intro"]], ["an empty string", ""]] as Array<[string, Json]>) ops(`add after ${label}`, [{ op: "add", node: text("t"), after: value }])
  ops("add with no node", [{ op: "add" }])
  for (const [label, value] of [["null", null], ["a string", "x"], ["a number", 5], ["an array", [text("t")]]] as Array<[string, Json]>) ops(`add a node that is ${label}`, [{ op: "add", node: value }])
  ops("add a node with no id", [{ op: "add", node: { type: "Text", text: "x" } }])
  for (const [label, value] of [["a number", 5], ["null", null], ["an object", {}]] as Array<[string, Json]>) ops(`add a node whose id is ${label}`, [{ op: "add", node: { type: "Text", id: value, text: "x" } }])
  ops("add a node with a bad id", [{ op: "add", node: text("1 bad id") }])
  ops("add a node with no type", [{ op: "add", node: { id: "t", text: "x" } }])
  ops("add a node of an unknown type", [{ op: "add", node: { type: "Recomendation", id: "t" } }])
  ops("add a node with an empty text", [{ op: "add", node: text("t", "") }])
  ops("add a node with a presentational field", [{ op: "add", node: { ...text("t"), color: "red" } }])
  ops("add a second primary", [{ op: "add", node: { type: "Action", id: "b", intent: "go on", primary: true } }], "with a primary")
  ops("add a second primary after unsetting the first", [{ op: "add", node: { type: "Action", id: "b", intent: "go on", primary: true } }, { op: "patch", id: "a", set: { primary: null } }], "with a primary")
  ops("add an irreversible act with nothing confirming it", [{ op: "add", node: { type: "Action", id: "b", intent: "pay", reversible: false } }])
  ops("add a node that refers to one that is not there", [{ op: "add", node: { type: "Alternative", id: "alt", intent: "other", for: "ghost" } }])
  ops("add a node that refers to one that is there", [{ op: "add", node: { type: "Alternative", id: "alt", intent: "other", for: "rec" }, after: "rec" }])
  ops("add an alternative before its target", [{ op: "add", node: { type: "Alternative", id: "alt", intent: "other", for: "rec" }, after: "work" }])
  ops("add with an unknown field", [{ op: "add", node: text("t"), where: "end" }])
  ops("add with a presentational field", [{ op: "add", node: text("t"), color: "red" }])
  ops("add with a misspelled field", [{ op: "add", nod: text("t") }])
  ops("add with a slash in a field name", [{ op: "add", node: text("t"), "a/b~c": 1 }])
  ops("add with fields of other ops", [{ op: "add", node: text("t"), id: "x", set: {} }])
  ops("add a form", [{ op: "add", node: { type: "Form", id: "f", intent: "answer", fields: [{ id: "a", prompt: "A?", kind: "text" }] } }])
  ops("add the same node twice, in two places", [{ op: "add", node: text("t"), after: "work" }, { op: "add", node: text("t"), after: "go" }])
  ops("add many nodes", Array.from({ length: 30 }, (_, i) => ({ op: "add", node: text(`n${i}`) })))

  // replace
  ops("replace a node", [{ op: "replace", node: { type: "Text", id: "intro", text: "New words." } }])
  ops("replace with a node of another type", [{ op: "replace", node: { type: "Action", id: "intro", intent: "do it" } }])
  ops("replace a node that is not there", [{ op: "replace", node: text("ghost") }])
  ops("replace with no node", [{ op: "replace" }])
  ops("replace with a node that is not an object", [{ op: "replace", node: "x" }])
  ops("replace with a node with no id", [{ op: "replace", node: { type: "Text", text: "x" } }])
  ops("replace with a node whose id is a number", [{ op: "replace", node: { type: "Text", id: 7, text: "x" } }])
  ops("replace with an invalid node", [{ op: "replace", node: { type: "Text", id: "intro", text: "" } }])
  ops("replace with an unknown type", [{ op: "replace", node: { type: "Spaceship", id: "intro" } }])
  ops("replace a node an earlier op removed", [{ op: "remove", id: "intro" }, { op: "replace", node: text("intro") }])
  ops("replace a node an earlier op added", [{ op: "add", node: text("t") }, { op: "replace", node: text("t", "Changed.") }])
  ops("replace with fields of other ops", [{ op: "replace", node: text("intro"), after: "work", id: "intro" }])
  ops("replace the target of a reference with a node of the wrong type", [{ op: "add", node: { type: "Alternative", id: "alt", intent: "other", for: "rec" } }, { op: "replace", node: text("rec") }])

  // patch
  ops("patch a field", [{ op: "patch", id: "work", set: { value: 0.75 } }])
  ops("patch several fields", [{ op: "patch", id: "rec", set: { summary: "Direct, 10:40", confidence: 0.9, intent: "take it" } }])
  ops("patch a field that was not there", [{ op: "patch", id: "intro", set: { importance: "high" } }])
  ops("patch a field to null", [{ op: "patch", id: "rec", set: { confidence: null } }])
  ops("patch a field that is not there to null", [{ op: "patch", id: "intro", set: { importance: null } }])
  ops("patch a required field to null", [{ op: "patch", id: "intro", set: { text: null } }])
  ops("patch every field to null", [{ op: "patch", id: "rec", set: { intent: null, summary: null, confidence: null } }])
  ops("patch with a nested value", [{ op: "patch", id: "work", set: { steps: [{ id: "a", label: "A", state: "done" }] } }])
  ops("patch the same node twice", [{ op: "patch", id: "work", set: { value: 0.6 } }, { op: "patch", id: "work", set: { value: 0.7, label: "Booking" } }])
  ops("patch a node an earlier op added", [{ op: "add", node: text("t") }, { op: "patch", id: "t", set: { text: "Patched." } }])
  ops("patch a node an earlier op replaced", [{ op: "replace", node: { type: "Text", id: "intro", text: "Replaced." } }, { op: "patch", id: "intro", set: { text: "Patched." } }])
  ops("patch a node an earlier op removed", [{ op: "remove", id: "intro" }, { op: "patch", id: "intro", set: { text: "x" } }])
  ops("patch a node that is not there", [{ op: "patch", id: "ghost", set: { a: 1 } }])
  ops("patch with no id", [{ op: "patch", set: { a: 1 } }])
  for (const [label, value] of [["a number", 5], ["null", null], ["an object", {}], ["an array", ["go"]]] as Array<[string, Json]>) ops(`patch an id that is ${label}`, [{ op: "patch", id: value, set: { a: 1 } }])
  ops("patch with no set", [{ op: "patch", id: "work" }])
  for (const [label, value] of [["null", null], ["an array", [1]], ["a string", "x"], ["a number", 5], ["true", true]] as Array<[string, Json]>) ops(`patch with a set that is ${label}`, [{ op: "patch", id: "work", set: value }])
  ops("patch with an empty set", [{ op: "patch", id: "work", set: {} }])
  ops("patch the id", [{ op: "patch", id: "work", set: { id: "other" } }])
  ops("patch the type", [{ op: "patch", id: "work", set: { type: "Text" } }])
  ops("patch the id and the type", [{ op: "patch", id: "work", set: { id: "x", type: "Text", value: 1 } }])
  ops("patch the id of a node that is not there", [{ op: "patch", id: "ghost", set: { id: "x" } }])
  ops("patch with no node and an empty set", [{ op: "patch", set: {} }])
  ops("patch to a value of the wrong type", [{ op: "patch", id: "work", set: { value: "half" } }])
  ops("patch to an out-of-range value", [{ op: "patch", id: "work", set: { value: 1.5 } }])
  ops("patch in an unknown field", [{ op: "patch", id: "work", set: { zzz: 1 } }])
  ops("patch in a presentational field", [{ op: "patch", id: "work", set: { color: "red" } }])
  ops("patch in a misspelled field", [{ op: "patch", id: "work", set: { lable: "x" } }])
  ops("patch in a field name with a slash", [{ op: "patch", id: "work", set: { "a/b~c": 1 } }])
  ops("patch with an integer-like field name", [{ op: "patch", id: "work", set: { 7: 1 } }])
  ops("patch with an unknown field on the op", [{ op: "patch", id: "work", set: { value: 1 }, node: text("x") }])
  ops("patch in a primary that makes two", [{ op: "patch", id: "t", set: { primary: true } }], "with a primary")
  ops("patch reversible false onto an act", [{ op: "patch", id: "go", set: { reversible: false } }])
  ops("patch an expandable", [{ op: "patch", id: "rec", set: { expandable: { why: "Because." } } }])
  ops("patch a text that is too long", [{ op: "patch", id: "intro", set: { text: "x".repeat(4001) } }])
  ops("patch nulls into fields that are not there and are", [{ op: "patch", id: "rec", set: { expandable: null, confidence: null } }])

  // remove
  ops("remove a node", [{ op: "remove", id: "go" }])
  ops("remove the first node", [{ op: "remove", id: "work" }])
  ops("remove two nodes", [{ op: "remove", id: "work" }, { op: "remove", id: "rec" }])
  ops("remove a node that is not there", [{ op: "remove", id: "ghost" }])
  ops("remove a node twice", [{ op: "remove", id: "go" }, { op: "remove", id: "go" }])
  ops("remove with no id", [{ op: "remove" }])
  for (const [label, value] of [["a number", 5], ["null", null], ["an object", {}]] as Array<[string, Json]>) ops(`remove an id that is ${label}`, [{ op: "remove", id: value }])
  ops("remove everything", [{ op: "remove", id: "work" }, { op: "remove", id: "intro" }, { op: "remove", id: "rec" }, { op: "remove", id: "go" }])
  ops("remove the only node", [{ op: "remove", id: "only" }], "single")
  ops("remove the only node and add another", [{ op: "remove", id: "only" }, { op: "add", node: text("t") }], "single")
  ops("remove the target of a reference", [{ op: "add", node: { type: "Alternative", id: "alt", intent: "other", for: "rec" }, after: "rec" }, { op: "remove", id: "rec" }])
  ops("remove the target of a reference an op later adds", [{ op: "remove", id: "rec" }, { op: "add", node: { type: "Alternative", id: "alt", intent: "other", for: "rec" } }])
  ops("remove with an unknown field on the op", [{ op: "remove", id: "go", why: "x" }])
  ops("remove with a presentational field on the op", [{ op: "remove", id: "go", style: "x" }])
  ops("remove and add the same id", [{ op: "remove", id: "go" }, { op: "add", node: { type: "Action", id: "go", intent: "see all" } }])

  // resolve
  const resolve = (extra: Obj) => ({ op: "resolve", ...extra })
  ops("resolve", [resolve(DONE)])
  ops("resolve, cancelled", [resolve({ outcome: "cancelled", summary: "Cancelled." })])
  ops("resolve, failed", [resolve({ outcome: "failed", summary: "Sold out." })])
  ops("resolve with an artifact", [resolve({ ...DONE, artifact: { label: "Booking", href: "https://example.com/b/1", kind: "document" } })])
  ops("resolve with a minimal artifact", [resolve({ ...DONE, artifact: { label: "Booking" } })])
  ops("resolve and remove everything", [{ op: "remove", id: "work" }, { op: "remove", id: "intro" }, { op: "remove", id: "rec" }, { op: "remove", id: "go" }, resolve(DONE)])
  ops("resolve after patching and adding", [{ op: "patch", id: "work", set: { value: 1 } }, { op: "add", node: text("t") }, resolve(DONE)])
  ops("resolve the only node away", [{ op: "remove", id: "only" }, resolve(DONE)], "single")
  ops("resolve with an invalid node left in", [{ op: "add", node: text("t", "") }, resolve(DONE)])
  ops("resolve with no outcome", [resolve({ summary: "x" })])
  ops("resolve with no summary", [resolve({ outcome: "done" })])
  ops("resolve with nothing", [resolve({})])
  ops("resolve with an unknown outcome", [resolve({ outcome: "finished", summary: "x" })])
  ops("resolve with an outcome that is a number", [resolve({ outcome: 1, summary: "x" })])
  ops("resolve with a summary that is a number", [resolve({ outcome: "done", summary: 1 })])
  ops("resolve with an empty summary", [resolve({ outcome: "done", summary: "" })])
  ops("resolve with a blank summary", [resolve({ outcome: "done", summary: "   " })])
  ops("resolve with a summary over two lines", [resolve({ outcome: "done", summary: "One.\nTwo." })])
  ops("resolve with a summary that is too long", [resolve({ outcome: "done", summary: "x".repeat(121) })])
  ops("resolve with a summary of 120 code points", [resolve({ outcome: "done", summary: "😀".repeat(120) })])
  ops("resolve with a summary of 121 code points", [resolve({ outcome: "done", summary: "😀".repeat(121) })])
  ops("resolve with an unknown field", [resolve({ ...DONE, reason: "x" })])
  ops("resolve with a presentational field", [resolve({ ...DONE, color: "green" })])
  ops("resolve with a misspelled field", [resolve({ ...DONE, sumary: "x" })])
  ops("resolve with fields of other ops", [resolve({ ...DONE, id: "go", node: text("t") })])
  for (const [label, artifact] of [
    ["null", null], ["a string", "x"], ["an array", []], ["empty", {}], ["with no label", { href: "https://example.com" }], ["with a label that is a number", { label: 5 }], ["with an empty label", { label: "" }],
    ["with a blank label", { label: " " }], ["with a long label", { label: "x".repeat(121) }], ["with an href that is a number", { label: "x", href: 5 }], ["with an empty href", { label: "x", href: "" }],
    ["with a long href", { label: "x", href: "h".repeat(4001) }], ["with an unknown kind", { label: "x", kind: "archive" }], ["with a kind that is a number", { label: "x", kind: 3 }],
    ["with an unknown field", { label: "x", mime: "x" }], ["with a presentational field", { label: "x", icon: "f" }], ["with a misspelled field", { lable: "x" }],
  ] as Array<[string, Json]>) ops(`resolve with an artifact ${label}`, [resolve({ ...DONE, artifact })])
  ops("resolve with everything wrong", [resolve({ outcome: "x", summary: "", artifact: { label: 1, href: 2, kind: 3, zzz: 4 }, color: "red", id: "go" })])
  ops("an op after resolve", [resolve(DONE), { op: "remove", id: "go" }])
  ops("two resolves", [resolve(DONE), resolve({ outcome: "failed", summary: "Again." })])
  ops("several ops after resolve", [resolve(DONE), { op: "add", node: text("t") }, null, { op: "nope" }, { op: "remove", id: "go" }])
  ops("a bad resolve and an op after it", [resolve({ outcome: "x" }), { op: "remove", id: "go" }])
  ops("resolve, then an unknown op", [resolve(DONE), { op: "destroy" }])
  ops("resolve, then an op with no name", [resolve(DONE), { id: "go" }])
  ops("resolve, then an op that is not an object", [resolve(DONE), 5])
  ops("resolve after a bad add", [{ op: "add", node: text("intro") }, resolve(DONE)])

  // All or nothing, and the result.
  ops("a good op and a bad one, so none lands", [{ op: "patch", id: "work", set: { value: 1 } }, { op: "remove", id: "ghost" }])
  ops("a good op and one whose result is invalid", [{ op: "patch", id: "work", set: { value: 1 } }, { op: "add", node: text("t", "") }])
  ops("an invalid result, one problem", [{ op: "add", node: text("t", "") }])
  ops("an invalid result, several problems", [{ op: "add", node: text("t", "") }, { op: "add", node: { type: "Spaceship", id: "s" } }, { op: "patch", id: "work", set: { value: 7 } }])
  ops("an invalid result across nodes", [{ op: "patch", id: "go", set: { primary: true } }, { op: "patch", id: "rec", set: { primary: true } }])
  ops("many invalid nodes in the result", Array.from({ length: 150 }, (_, i) => ({ op: "add", node: text(`n${i}`, "") })))
  ops("exactly the issue limit in the result", Array.from({ length: 100 }, (_, i) => ({ op: "add", node: text(`n${i}`, "") })))
  ops("one past the issue limit in the result", Array.from({ length: 101 }, (_, i) => ({ op: "add", node: text(`n${i}`, "") })))
  ops("99 problems in the result", Array.from({ length: 99 }, (_, i) => ({ op: "add", node: text(`n${i}`, "") })))
  ops("exactly the issue limit in ops", Array.from({ length: 100 }, () => ({ op: "remove", id: "ghost" })))
  ops("one past the issue limit in ops", Array.from({ length: 101 }, () => ({ op: "remove", id: "ghost" })))
  ops("many more than the issue limit in ops", Array.from({ length: 300 }, () => ({ op: "remove", id: "ghost" })))
  ops("99 problems in ops", Array.from({ length: 99 }, () => ({ op: "remove", id: "ghost" })))
  ops("a stale revision, then the issue limit", Array.from({ length: 101 }, () => null), "trip", 9)
  ops("unicode ids and names", [{ op: "add", node: { type: "Text", id: "é", text: "Héllo" } }, { op: "patch", id: "é", set: { zébra: 1 } }])
  ops("an emoji summary and label", [resolve({ outcome: "done", summary: "✈️ Booked", artifact: { label: "🎫 Ticket", href: "https://example.com/é" } })])
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
  const updates = buildUpdateCorpus()
  const outputs: Array<[string, string, number]> = [
    [IR_CORPUS_PATH, `${JSON.stringify(ir)}\n`, ir.length],
    [REPLY_CORPUS_PATH, `${JSON.stringify(replies)}\n`, replies.cases.length],
    [UPDATE_CORPUS_PATH, `${JSON.stringify(updates)}\n`, updates.cases.length],
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
