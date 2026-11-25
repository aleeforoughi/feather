// The logic of the product-flow blocks (feather.page/1, wave 5): the calculator's formula language, the quiz's
// scoring, the chart's scale, and the small formats the booking and podcast blocks share. Pure and deterministic: no
// DOM, no clock, no randomness, so the validator, the server render and the browser all agree.

// ---- The formula language (calculator) ----------------------------------------------------------------------------
// A small, safe expression over named inputs: numbers, + - * /, parentheses, unary minus, and the functions min, max
// and round. There is no eval and no property access: a formula is parsed once into a tree of five node kinds, and
// evaluating it can only ever produce a number.

export type FormulaNode =
  | { kind: "num"; value: number }
  | { kind: "name"; name: string }
  | { kind: "neg"; arg: FormulaNode }
  | { kind: "op"; op: "+" | "-" | "*" | "/"; left: FormulaNode; right: FormulaNode }
  | { kind: "call"; fn: FormulaFunction; args: FormulaNode[] }

/** The functions a formula may call. round(x) is to the nearest whole number; round(x, n) to n decimal places (0–4). */
export const FORMULA_FUNCTIONS = ["min", "max", "round"] as const
export type FormulaFunction = (typeof FORMULA_FUNCTIONS)[number]
/** A formula's limits: its length (also the spec's), and how deep its parentheses and calls may nest. */
export const FORMULA_MAX_LENGTH = 400
export const FORMULA_MAX_DEPTH = 24
/** The names a calculator input or line may take: a letter, then letters, digits or underscores. */
export const FORMULA_NAME = /^[a-z][a-z0-9_]*$/

export type ParsedFormula = { ok: true; tree: FormulaNode; names: string[] } | { ok: false; message: string; at: number }

class FormulaSyntax extends Error {
  readonly at: number
  constructor(message: string, at: number) {
    super(message)
    this.at = at
  }
}

type Token = { kind: "num"; value: number; at: number } | { kind: "name"; name: string; at: number } | { kind: "sym"; sym: string; at: number }

function tokenize(src: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === " " || c === "\t" || c === "\n") {
      i++
      continue
    }
    const num = /^(?:\d+(?:\.\d+)?|\.\d+)/.exec(src.slice(i))
    if (num) {
      out.push({ kind: "num", value: Number(num[0]), at: i })
      i += num[0].length
      continue
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))
    if (name) {
      out.push({ kind: "name", name: name[0], at: i })
      i += name[0].length
      continue
    }
    if ("+-*/(),".includes(c)) {
      out.push({ kind: "sym", sym: c, at: i })
      i++
      continue
    }
    throw new FormulaSyntax(`"${c}" is not part of a formula (numbers, names, + - * /, parentheses, min, max, round)`, i)
  }
  return out
}

/** Parses a formula. Returns its tree and the input names it reads, or the first problem and where it is. */
export function parseFormula(src: string): ParsedFormula {
  if (src.length > FORMULA_MAX_LENGTH) return { ok: false, message: `a formula is at most ${FORMULA_MAX_LENGTH} characters`, at: FORMULA_MAX_LENGTH }
  let tokens: Token[]
  try {
    tokens = tokenize(src)
  } catch (e) {
    return { ok: false, message: (e as FormulaSyntax).message, at: (e as FormulaSyntax).at }
  }
  let pos = 0
  const names = new Set<string>()
  const peek = () => tokens[pos]
  const isSym = (t: Token | undefined, s: string) => t?.kind === "sym" && t.sym === s
  const end = () => (tokens.length ? tokens[tokens.length - 1].at + 1 : 0)
  const expect = (s: string) => {
    const t = peek()
    if (!isSym(t, s)) throw new FormulaSyntax(`expected "${s}"${t ? "" : " before the end"}`, t?.at ?? end())
    pos++
  }
  const expr = (depth: number): FormulaNode => {
    if (depth > FORMULA_MAX_DEPTH) throw new FormulaSyntax(`a formula nests at most ${FORMULA_MAX_DEPTH} deep`, peek()?.at ?? end())
    let left = term(depth)
    while (isSym(peek(), "+") || isSym(peek(), "-")) {
      const op = (tokens[pos++] as { sym: "+" | "-" }).sym
      left = { kind: "op", op, left, right: term(depth) }
    }
    return left
  }
  const term = (depth: number): FormulaNode => {
    let left = unary(depth)
    while (isSym(peek(), "*") || isSym(peek(), "/")) {
      const op = (tokens[pos++] as { sym: "*" | "/" }).sym
      left = { kind: "op", op, left, right: unary(depth) }
    }
    return left
  }
  const unary = (depth: number): FormulaNode => {
    if (isSym(peek(), "-")) {
      pos++
      return { kind: "neg", arg: unary(depth + 1) }
    }
    if (isSym(peek(), "+")) {
      pos++
      return unary(depth + 1)
    }
    return primary(depth)
  }
  const primary = (depth: number): FormulaNode => {
    const t = peek()
    if (!t) throw new FormulaSyntax("the formula ends too soon", end())
    if (t.kind === "num") {
      pos++
      return { kind: "num", value: t.value }
    }
    if (t.kind === "name") {
      pos++
      if (isSym(peek(), "(")) {
        if (!(FORMULA_FUNCTIONS as readonly string[]).includes(t.name)) throw new FormulaSyntax(`${t.name} is not a function (min, max, round)`, t.at)
        pos++
        const args: FormulaNode[] = []
        if (!isSym(peek(), ")")) {
          args.push(expr(depth + 1))
          while (isSym(peek(), ",")) {
            pos++
            args.push(expr(depth + 1))
          }
        }
        expect(")")
        const fn = t.name as FormulaFunction
        if (fn === "round" && (args.length < 1 || args.length > 2)) throw new FormulaSyntax("round takes a value and, optionally, decimal places", t.at)
        if (fn !== "round" && args.length < 2) throw new FormulaSyntax(`${fn} takes two or more values`, t.at)
        return { kind: "call", fn, args }
      }
      if ((FORMULA_FUNCTIONS as readonly string[]).includes(t.name)) throw new FormulaSyntax(`${t.name} is a function: write ${t.name}(…)`, t.at)
      names.add(t.name)
      return { kind: "name", name: t.name }
    }
    if (isSym(t, "(")) {
      pos++
      const inner = expr(depth + 1)
      expect(")")
      return inner
    }
    throw new FormulaSyntax(`unexpected "${(t as { sym: string }).sym}"`, t.at)
  }
  try {
    if (!tokens.length) throw new FormulaSyntax("the formula is empty", 0)
    const tree = expr(0)
    if (pos < tokens.length) throw new FormulaSyntax(`unexpected "${tokenText(tokens[pos])}"`, tokens[pos].at)
    return { ok: true, tree, names: [...names] }
  } catch (e) {
    if (e instanceof FormulaSyntax) return { ok: false, message: e.message, at: e.at }
    throw e
  }
}

const tokenText = (t: Token) => (t.kind === "num" ? String(t.value) : t.kind === "name" ? t.name : t.sym)

/** A formula's value with the given names. NaN when it has none (a division by zero, an unknown name): never thrown. */
export function evaluateFormula(tree: FormulaNode, scope: Readonly<Record<string, number>>): number {
  switch (tree.kind) {
    case "num":
      return tree.value
    case "name":
      return Object.prototype.hasOwnProperty.call(scope, tree.name) ? scope[tree.name] : Number.NaN
    case "neg":
      return -evaluateFormula(tree.arg, scope)
    case "op": {
      const a = evaluateFormula(tree.left, scope)
      const b = evaluateFormula(tree.right, scope)
      const v = tree.op === "+" ? a + b : tree.op === "-" ? a - b : tree.op === "*" ? a * b : b === 0 ? Number.NaN : a / b
      return Number.isFinite(v) ? v : Number.NaN
    }
    case "call": {
      const values = tree.args.map((a) => evaluateFormula(a, scope))
      if (values.some((v) => Number.isNaN(v))) return Number.NaN
      if (tree.fn === "min") return Math.min(...values)
      if (tree.fn === "max") return Math.max(...values)
      const places = values.length > 1 ? Math.max(0, Math.min(4, Math.round(values[1]))) : 0
      return roundHalfAway(values[0], places)
    }
  }
}

/** Rounds half away from zero, as people round prices (Math.round rounds -2.5 to -2), in decimal: 1.005 to two places
 * is 1.01, as written, not 1.00 as its binary value would give. */
function roundHalfAway(x: number, places: number): number {
  const shifted = Number(`${Math.abs(x)}e${places}`)
  const whole = Number.isFinite(shifted) ? Math.round(shifted) : Math.round(Math.abs(x) * 10 ** places)
  const back = Number(`${whole}e-${places}`)
  return Math.sign(x) * (Number.isFinite(back) ? back : whole / 10 ** places)
}

/** Parses and evaluates in one step (NaN when the formula does not parse). */
export function formulaValue(src: string, scope: Readonly<Record<string, number>>): number {
  const parsed = parseFormula(src)
  return parsed.ok ? evaluateFormula(parsed.tree, scope) : Number.NaN
}

// ---- The calculator's inputs ----------------------------------------------------------------------------------------

export type CalculatorInputKind = "range" | "number" | "radio" | "toggle"
export interface CalculatorInput {
  id: string
  label: string
  kind: CalculatorInputKind
  min?: number
  max?: number
  step?: number
  value?: number
  unit?: string
  help?: string
  options?: { label: string; value: number }[]
}
export interface CalculatorLine {
  id?: string
  label: string
  formula: string
}

/** An input's starting value: its `value`, else its minimum, its first option, or off. */
export function startValue(input: CalculatorInput): number {
  if (input.value !== undefined) return input.value
  if (input.kind === "radio") return input.options?.[0]?.value ?? 0
  if (input.kind === "toggle") return 0
  return input.min ?? 0
}

/** Every input at its starting value. */
export const startScope = (inputs: readonly CalculatorInput[]): Record<string, number> => Object.fromEntries(inputs.map((i) => [i.id, startValue(i)]))

/** The lines, then the total, with the inputs' values: each line may read the inputs and the lines before it. */
export function priceOf(inputs: Readonly<Record<string, number>>, lines: readonly CalculatorLine[], formula: string): { lines: number[]; total: number } {
  const scope: Record<string, number> = { ...inputs }
  const values = lines.map((line) => {
    const v = formulaValue(line.formula, scope)
    if (line.id) scope[line.id] = v
    return v
  })
  return { lines: values, total: formulaValue(formula, scope) }
}

/** A number as money or a measure: the prefix, grouped digits at the given decimals, the suffix. "—" when it has no
 * value. Grouping is fixed (commas) so the server and every browser write the same string. */
export function formatAmount(v: number, { prefix = "", suffix = "", decimals = 0 }: { prefix?: string; suffix?: string; decimals?: number } = {}): string {
  if (!Number.isFinite(v)) return "—"
  const sign = v < 0 ? "−" : ""
  const [whole, frac] = Math.abs(v).toFixed(decimals).split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${sign}${prefix}${grouped}${frac ? `.${frac}` : ""}${suffix}`
}

// ---- The quiz -----------------------------------------------------------------------------------------------------

export interface QuizOption {
  id: string
  label: string
  /** tally: the result this answer counts toward. */
  result?: string
  /** score: the points this answer adds. */
  score?: number
}
export interface QuizQuestion {
  id: string
  q: string
  help?: string
  options: QuizOption[]
}
export interface QuizResultEntry {
  id: string
  title: string
  body?: string
  href?: string
  label?: string
  /** score: the lowest and highest totals that give this result (inclusive). */
  min?: number
  max?: number
  /** An exact combination of answers (question id → option id) that gives this result before any scoring. */
  match?: Record<string, string>
}
export interface QuizSpec {
  scoring?: "tally" | "score"
  questions: QuizQuestion[]
  results: QuizResultEntry[]
}

/** The total of a scored quiz's answers. */
export function quizScore(quiz: QuizSpec, answers: Readonly<Record<string, string>>): number {
  return quiz.questions.reduce((sum, q) => sum + (q.options.find((o) => o.id === answers[q.id])?.score ?? 0), 0)
}

/**
 * The result of a quiz: a result whose `match` the answers meet exactly comes first (the first in order); otherwise
 * scoring decides. tally: the result most answers point to, a tie going to the one listed first. score: the first
 * result whose min–max range holds the total. Null until every question is answered, or when nothing applies.
 */
export function quizResult(quiz: QuizSpec, answers: Readonly<Record<string, string>>): QuizResultEntry | null {
  if (quiz.questions.some((q) => !q.options.some((o) => o.id === answers[q.id]))) return null
  const matched = quiz.results.find((r) => r.match && Object.keys(r.match).length > 0 && Object.entries(r.match).every(([q, o]) => answers[q] === o))
  if (matched) return matched
  if ((quiz.scoring ?? "tally") === "score") {
    const total = quizScore(quiz, answers)
    return quiz.results.find((r) => (r.min !== undefined || r.max !== undefined) && total >= (r.min ?? -Infinity) && total <= (r.max ?? Infinity)) ?? null
  }
  const votes = new Map<string, number>()
  for (const q of quiz.questions) {
    const r = q.options.find((o) => o.id === answers[q.id])?.result
    if (r) votes.set(r, (votes.get(r) ?? 0) + 1)
  }
  let best: QuizResultEntry | null = null
  let most = 0
  for (const r of quiz.results) {
    const n = votes.get(r.id) ?? 0
    if (n > most) {
      best = r
      most = n
    }
  }
  return best
}

/** The lowest and highest totals a scored quiz can reach. */
export function scoreRange(quiz: QuizSpec): [number, number] {
  let lo = 0
  let hi = 0
  for (const q of quiz.questions) {
    const scores = q.options.map((o) => o.score ?? 0)
    lo += Math.min(...scores)
    hi += Math.max(...scores)
  }
  return [lo, hi]
}

/** The whole-number totals from lo to hi that no result's range holds (as [from, to] runs). Scores are whole. */
export function uncoveredTotals(results: readonly Pick<QuizResultEntry, "min" | "max">[], lo: number, hi: number): [number, number][] {
  const ranges = results
    .filter((r) => r.min !== undefined || r.max !== undefined)
    .map((r) => [Math.max(lo, Math.ceil(r.min ?? lo)), Math.min(hi, Math.floor(r.max ?? hi))] as [number, number])
    .filter(([a, b]) => a <= b)
    .sort((a, b) => a[0] - b[0])
  const gaps: [number, number][] = []
  let next = lo
  for (const [a, b] of ranges) {
    if (a > next) gaps.push([next, a - 1])
    next = Math.max(next, b + 1)
  }
  if (next <= hi) gaps.push([next, hi])
  return gaps
}

// ---- The chart ----------------------------------------------------------------------------------------------------

/** A readable axis for values from lo to hi: zero always included (bars start at zero), a step of 1, 2, 2.5 or 5
 * times a power of ten, and about `count` intervals. */
export function niceScale(lo: number, hi: number, count = 4): { min: number; max: number; step: number; ticks: number[] } {
  const a = Math.min(0, lo)
  const b = Math.max(0, hi)
  const span = b - a || 1
  const raw = span / Math.max(1, count)
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power
  const min = Math.floor(a / step) * step
  const max = Math.ceil(b / step) * step || step
  const ticks: number[] = []
  for (let t = min; t <= max + step / 1e6; t += step) ticks.push(Number(t.toFixed(10)))
  return { min, max, step, ticks }
}

// ---- Time and dates ----------------------------------------------------------------------------------------------

/** Seconds as m:ss, or h:mm:ss from an hour. */
export function clockTime(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`
}

/** Seconds in words, for a screen reader ("1 minute 5 seconds"). */
export function spokenTime(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const parts: string[] = []
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`)
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`)
  if (r || !parts.length) parts.push(`${r} second${r === 1 ? "" : "s"}`)
  return parts.join(" ")
}

/** A real calendar date written YYYY-MM-DD. */
export function isIsoDate(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

/** A time of day written HH:MM (24-hour). */
export const isClockTime = (v: string): boolean => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v)

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/** A date in words ("Monday 1 December"), the same on the server and in every browser. A page in another language
 * gives each day its own `label`. */
export function dateWords(iso: string): string {
  if (!isIsoDate(iso)) return iso
  const [y, m, d] = iso.split("-").map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DAYS[day]} ${d} ${MONTHS[m - 1]}`
}

// ---- Colour (the scheme's contrast check) ------------------------------------------------------------------------

/** A #rgb or #rrggbb colour's relative luminance (WCAG), or null for anything else. */
export function hexLuminance(hex: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const full = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1]
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The contrast ratio of two #hex colours, or null when either is not one. */
export function hexContrast(a: string, b: string): number | null {
  const la = hexLuminance(a)
  const lb = hexLuminance(b)
  if (la === null || lb === null) return null
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
