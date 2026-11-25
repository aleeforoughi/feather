// What the field tables cannot say about the product-flow blocks and knobs (the flows section of spec.ts): ids that must be unique
// and point somewhere, a booking that sends to exactly one place, a calculator whose formulas parse, read only names
// that exist and have a value at every input's bounds, a quiz whose every total has a result, a chart whose rows fit
// its series, a podcast whose chapters and transcript run in order, and a scheme toggle that has somewhere to sit.
import { evaluateFormula, FORMULA_FUNCTIONS, FORMULA_NAME, hexContrast, hexLuminance, isClockTime, isIsoDate, parseFormula, scoreRange, startValue, uncoveredTotals, type CalculatorInput, type FormulaNode, type QuizSpec } from "./flows"
import { AUDIO_FILE } from "./spec"
import type { PageIssue } from "./types"

type Add = (path: string, code: PageIssue["code"], message: string) => void
type Obj = Record<string, unknown>

const isObject = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v)
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObject) : [])
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Slug ids in a list: each a slug, each once. Returns the ids seen. */
function uniqueIds(path: string, items: unknown, add: Add, key = "id", what = "id"): Set<string> {
  const seen = new Set<string>()
  if (!Array.isArray(items)) return seen
  items.forEach((item, i) => {
    const id = isObject(item) ? item[key] : undefined
    if (typeof id !== "string") return
    if (key === "id" && !SLUG.test(id)) add(`${path}/${i}/${key}`, "type", `a ${what} is a slug (a-z, 0-9, hyphens)`)
    else if (seen.has(id)) add(`${path}/${i}/${key}`, "duplicate-id", `the ${what} "${id}" is used twice`)
    seen.add(id)
  })
  return seen
}

/** The checks of one flow block (a no-op for every other kind). */
export function checkFlowBlock(path: string, kind: string, b: Obj, add: Add): void {
  if (kind === "quiz") checkQuiz(path, b, add)
  else if (kind === "booking") checkBooking(path, b, add)
  else if (kind === "calculator") checkCalculator(path, b, add)
  else if (kind === "chart") checkChart(path, b, add)
  else if (kind === "podcast") checkPodcast(path, b, add)
}

function checkQuiz(path: string, b: Obj, add: Add) {
  const scoring = b.scoring === "score" ? "score" : "tally"
  const questions = list(b.questions)
  uniqueIds(`${path}/questions`, b.questions, add, "id", "question id")
  const results = uniqueIds(`${path}/results`, b.results, add, "id", "result id")
  const options = new Map<string, Set<string>>()
  questions.forEach((q, qi) => {
    const at = `${path}/questions/${qi}/options`
    const ids = uniqueIds(at, q.options, add, "id", "option id")
    if (typeof q.id === "string") options.set(q.id, ids)
    list(q.options).forEach((o, oi) => {
      if (scoring === "tally") {
        if (o.score !== undefined) add(`${at}/${oi}/score`, "contradiction", "score is for a scored quiz; set scoring: score, or point this answer to a result")
        if (o.result === undefined) add(`${at}/${oi}/result`, "missing", "in a tally quiz every answer points to a result (its id)")
        else if (typeof o.result === "string" && !results.has(o.result)) add(`${at}/${oi}/result`, "unknown-ref", `"${o.result}" is not a result of this quiz`)
      } else {
        if (o.result !== undefined) add(`${at}/${oi}/result`, "contradiction", "result is for a tally quiz; a scored answer adds its score")
        if (o.score === undefined) add(`${at}/${oi}/score`, "missing", "in a scored quiz every answer has a score")
      }
    })
  })
  list(b.results).forEach((r, ri) => {
    const at = `${path}/results/${ri}`
    if (scoring === "tally" && (r.min !== undefined || r.max !== undefined)) add(`${at}/${r.min !== undefined ? "min" : "max"}`, "contradiction", "min and max are a scored quiz's ranges; set scoring: score")
    if (scoring === "score" && r.min === undefined && r.max === undefined && !isObject(r.match)) add(`${at}/min`, "missing", "in a scored quiz each result has a range (min, max) or a match")
    if (typeof r.min === "number" && typeof r.max === "number" && r.min > r.max) add(`${at}/max`, "out-of-range", `max (${r.max}) is below min (${r.min})`)
    if (isObject(r.match)) {
      for (const [q, o] of Object.entries(r.match)) {
        const opts = options.get(q)
        if (!opts) add(`${at}/match/${q}`, "unknown-ref", `"${q}" is not a question of this quiz`)
        else if (typeof o === "string" && !opts.has(o)) add(`${at}/match/${q}`, "unknown-ref", `"${o}" is not an answer to ${q}`)
      }
    }
  })
  // Every total a scored quiz can reach has a result: otherwise someone would finish and be told nothing.
  if (scoring === "score" && questions.every((q) => list(q.options).every((o) => typeof o.score === "number"))) {
    const quiz = { scoring, questions: questions.map((q) => ({ options: list(q.options) })), results: list(b.results) } as unknown as QuizSpec
    const [lo, hi] = scoreRange(quiz)
    const gaps = uncoveredTotals(quiz.results, lo, hi)
    if (gaps.length) add(`${path}/results`, "contradiction", `no result covers the total${gaps.length > 1 || gaps[0][0] !== gaps[0][1] ? "s" : ""} ${gaps.map(([a, c]) => (a === c ? `${a}` : `${a} to ${c}`)).join(", ")} (the answers reach ${lo} to ${hi})`)
  }
}

function checkBooking(path: string, b: Obj, add: Add) {
  uniqueIds(`${path}/services`, b.services, add, "id", "service id")
  const dates = new Set<string>()
  list(b.days).forEach((d, i) => {
    const at = `${path}/days/${i}`
    if (typeof d.date === "string") {
      if (!isIsoDate(d.date)) add(`${at}/date`, "type", "a date is written YYYY-MM-DD, and is a real day")
      else if (dates.has(d.date)) add(`${at}/date`, "duplicate-id", `${d.date} is listed twice`)
      dates.add(d.date)
    }
    const seen = new Set<string>()
    if (Array.isArray(d.slots)) {
      d.slots.forEach((s, si) => {
        if (typeof s !== "string") return
        if (!isClockTime(s)) add(`${at}/slots/${si}`, "type", "a slot is a time of day, HH:MM (24-hour)")
        else if (seen.has(s)) add(`${at}/slots/${si}`, "duplicate-id", `${s} is listed twice on this day`)
        seen.add(s)
      })
    }
  })
  // It sends to exactly one place: the page's own form handler, an email, or someone else's booking page.
  const targets = (["action", "mailto", "link"] as const).filter((k) => b[k] !== undefined)
  if (targets.length === 0) add(`${path}/action`, "missing", "a booking sends somewhere: action (a form handler), mailto (an address) or link (a booking page)")
  if (targets.length > 1) add(`${path}/${targets[1]}`, "contradiction", `a booking sends to one place; it has ${targets.join(" and ")}`)
  if (typeof b.action === "string" && /^(mailto|tel):|^#/i.test(b.action)) add(`${path}/action`, "bad-href", "action is the address of a form handler (https or a path); an email goes in mailto")
  if (typeof b.link === "string" && !/^https:\/\//i.test(b.link)) add(`${path}/link`, "bad-href", "link is the https address of a booking page")
  if (typeof b.mailto === "string" && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(b.mailto)) add(`${path}/mailto`, "type", "mailto is an email address (name@example.com)")
}

const RESERVED = new Set<string>(FORMULA_FUNCTIONS)

function checkCalculator(path: string, b: Obj, add: Add) {
  const inputs = list(b.inputs)
  const names = new Set<string>()
  const named = (at: string, id: unknown) => {
    if (typeof id !== "string") return
    if (!FORMULA_NAME.test(id)) add(at, "type", "an input or line id is a formula name: a lowercase letter, then letters, digits or underscores")
    else if (RESERVED.has(id)) add(at, "type", `${id} is a function of the formula language; choose another name`)
    else if (names.has(id)) add(at, "duplicate-id", `the name "${id}" is used twice`)
    names.add(id)
  }
  inputs.forEach((input, i) => {
    const at = `${path}/inputs/${i}`
    named(`${at}/id`, input.id)
    const k = input.kind
    const has = (f: string) => input[f] !== undefined
    if (k === "range" || k === "number") {
      if (!has("min")) add(`${at}/min`, "missing", `a ${k} input has a min and a max`)
      if (!has("max")) add(`${at}/max`, "missing", `a ${k} input has a min and a max`)
      if (has("options")) add(`${at}/options`, "unsupported", `options are a radio input's; a ${k} takes min, max and step`)
      const { min, max, step, value } = input as { min?: number; max?: number; step?: number; value?: number }
      if (typeof min === "number" && typeof max === "number") {
        if (min >= max) add(`${at}/max`, "out-of-range", `max (${max}) must be above min (${min})`)
        else if (typeof value === "number" && (value < min || value > max)) add(`${at}/value`, "out-of-range", `the starting value is from ${min} to ${max}`)
        if (typeof step === "number" && step > max - min) add(`${at}/step`, "out-of-range", `the step is at most the range (${max - min})`)
      }
    } else if (k === "radio") {
      for (const f of ["min", "max", "step"]) if (has(f)) add(`${at}/${f}`, "unsupported", `${f} is for a range or number input; a radio takes options`)
      const options = list(input.options)
      if (!has("options")) add(`${at}/options`, "missing", "a radio input has two to six options")
      if (typeof input.value === "number" && options.length && !options.some((o) => o.value === input.value)) add(`${at}/value`, "contradiction", "the starting value is one of the options' values")
    } else if (k === "toggle") {
      for (const f of ["min", "max", "step", "options"]) if (has(f)) add(`${at}/${f}`, "unsupported", `${f} is not a toggle's: a toggle is 1 when on and 0 when off`)
      if (has("value") && input.value !== 0 && input.value !== 1) add(`${at}/value`, "out-of-range", "a toggle starts off (0) or on (1)")
    }
  })
  const inputNames = new Set(names)
  // Lines read the inputs and the lines before them; the total reads every input and line.
  const formulas: { at: string; src: string; scope: Set<string>; name?: string }[] = []
  const known = new Set(inputNames)
  list(b.lines).forEach((line, i) => {
    const at = `${path}/lines/${i}`
    if (typeof line.formula === "string") formulas.push({ at: `${at}/formula`, src: line.formula, scope: new Set(known), ...(typeof line.id === "string" ? { name: line.id } : {}) })
    named(`${at}/id`, line.id)
    if (typeof line.id === "string") known.add(line.id)
  })
  if (typeof b.formula === "string") formulas.push({ at: `${path}/formula`, src: b.formula, scope: new Set(known) })
  const trees: { at: string; tree: FormulaNode; name?: string }[] = []
  for (const f of formulas) {
    const parsed = parseFormula(f.src)
    if (!parsed.ok) {
      add(f.at, "bad-formula", `${parsed.message} (at character ${parsed.at + 1})`)
      continue
    }
    const unknown = parsed.names.filter((n) => !f.scope.has(n))
    for (const n of unknown) add(f.at, "unknown-ref", `${n} is not an input${list(b.lines).length ? " or an earlier line" : ""} of this calculator`)
    if (!unknown.length) trees.push({ at: f.at, tree: parsed.tree, ...(f.name ? { name: f.name } : {}) })
  }
  if (trees.length !== formulas.length) return
  // Every formula has a value at the starting choices and with each input alone at its bounds or options.
  const base = Object.fromEntries(inputs.filter((i) => typeof i.id === "string").map((i) => [i.id as string, startValue(i as unknown as CalculatorInput)]))
  const probes: { scope: Record<string, number>; when: string }[] = [{ scope: base, when: "at the starting choices" }]
  for (const i of inputs as unknown as CalculatorInput[]) {
    if (typeof i.id !== "string") continue
    const values = i.kind === "radio" ? (i.options ?? []).map((o) => o.value) : i.kind === "toggle" ? [0, 1] : [i.min, i.max].filter((v): v is number => typeof v === "number")
    for (const v of values) probes.push({ scope: { ...base, [i.id]: v }, when: `when ${i.id} is ${v}` })
  }
  for (const probe of probes) {
    const scope = { ...probe.scope }
    for (const t of trees) {
      const v = evaluateFormula(t.tree, scope)
      if (t.name) scope[t.name] = v
      if (Number.isNaN(v)) {
        add(t.at, "contradiction", `the formula has no value ${probe.when} (a division by zero?)`)
        return
      }
    }
  }
}

function checkChart(path: string, b: Obj, add: Add) {
  const n = Array.isArray(b.series) ? b.series.length : 0
  list(b.rows).forEach((row, i) => {
    if (Array.isArray(row.values) && n && row.values.length !== n) add(`${path}/rows/${i}/values`, "contradiction", `each row has one value per series (${n}); this one has ${row.values.length}`)
  })
}

function checkPodcast(path: string, b: Obj, add: Add) {
  uniqueIds(`${path}/episodes`, b.episodes, add, "id", "episode id")
  list(b.episodes).forEach((ep, i) => {
    const at = `${path}/episodes/${i}`
    const src = typeof ep.audio === "string" ? ep.audio : isObject(ep.audio) ? ep.audio.src : undefined
    if (typeof src === "string" && !AUDIO_FILE.test(src)) add(`${at}/audio`, "bad-media", "an episode's audio is an audio file (mp3, m4a, aac, ogg, opus, wav or webm)")
    const inOrder = (key: "chapters" | "transcript", what: string) => {
      let last = -1
      list(ep[key]).forEach((item, j) => {
        if (typeof item.at !== "number") return
        if (item.at < last) add(`${at}/${key}/${j}/at`, "contradiction", `${what} run in order: this one starts before the one above it`)
        last = item.at
      })
    }
    inOrder("chapters", "chapters")
    inOrder("transcript", "transcript lines")
  })
}

/** The view-mode switch: it switches the grid's layout, so it sits only on a grid that does not scroll sideways or stack. */
export function checkViews(path: string, b: Obj, add: Add): void {
  if (b.views === undefined) return
  if (typeof b.variant === "string" && b.variant !== "grid") add(`${path}/views`, "contradiction", `views switch the grid's layout; this work is a ${b.variant} (set variant: grid)`)
  const pattern = isObject(b.scroll) ? b.scroll.pattern : undefined
  if (pattern === "stack" || pattern === "horizontal") add(`${path}/views`, "contradiction", `views switch the grid's layout; a ${pattern} scroll replaces it`)
}

/** The page's scheme toggle: it needs an edge to sit in, and its colours must read (hex, text 4.5:1 on the ground). */
export function checkScheme(doc: Obj, add: Add): void {
  const scheme = doc.scheme
  if (!isObject(scheme)) return
  const toggle = scheme.toggle ?? (doc.nav !== undefined ? "nav" : "footer")
  if (toggle === "nav" && doc.nav === undefined) add("/scheme/toggle", "missing", "the toggle sits in the nav; the page has no nav (add one, or set toggle: footer)")
  if (toggle === "footer" && doc.footer === undefined) add(scheme.toggle === undefined ? "/scheme" : "/scheme/toggle", "missing", "the toggle sits in the nav or the footer; the page has neither")
  const colors = scheme.colors
  if (!isObject(colors)) return
  for (const [k, v] of Object.entries(colors)) if (typeof v === "string" && hexLuminance(v) === null) add(`/scheme/colors/${k}`, "type", "a scheme colour is #rgb or #rrggbb")
  const pairs: [string, string, number][] = [["text", "background", 4.5], ["text", "surface", 4.5], ["primaryText", "primary", 4.5], ["accentText", "accent", 4.5]]
  for (const [ink, ground, floor] of pairs) {
    const a = colors[ink]
    const g = colors[ground]
    if (typeof a !== "string" || typeof g !== "string") continue
    const ratio = hexContrast(a, g)
    if (ratio !== null && ratio < floor) add(`/scheme/colors/${ink}`, "contradiction", `${ink} on ${ground} is ${ratio.toFixed(2)}:1; text needs ${floor}:1`)
  }
}
