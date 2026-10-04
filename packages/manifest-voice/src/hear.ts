// What was said, made safe for the dialog. Spoken numbers become digits, but only where a number is what the turn
// takes. Nothing here is fuzzy: the dialog still matches exactly.
import { normalize, nodeIndex, type Turn } from "@aleeforoughi/feather-dialog"
import type { IRNode } from "@aleeforoughi/feather-intent"
import type { LayoutPlan } from "@aleeforoughi/feather-liquid"

const CARDINALS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]
const NUMBERS = new Map<string, string>([...CARDINALS.map((w, i): [string, string] => [w, String(i)]), ...ORDINALS.map((w, i): [string, string] => [w, String(i + 1)])])
const OPTION_N = /^(?:option|number) (\S+)$/

/** A word or digits for a number, as digits. */
function digits(word: string): string | undefined {
  return /^\d{1,6}$/.test(word) ? word : NUMBERS.get(word)
}

/**
 * Maps a spoken number to digits. It applies only to the WHOLE utterance ("two", "second") or to the N of "option N" and
 * "number N", never to a word inside a longer answer, so "two adults and a child" is left alone. Anything else comes back
 * unchanged.
 */
export function spokenToDigits(text: string, locale: string): string {
  const t = normalize(text, locale).text
  const whole = NUMBERS.get(t)
  if (whole !== undefined) return whole
  const opt = OPTION_N.exec(t)
  const n = opt ? digits(opt[1]!) : undefined
  return n ?? text
}

/** "yeah" and "correct" are yes; "nope" is no. */
export function readbackWord(text: string, locale: string): string {
  const t = normalize(text, locale).text
  if (t === "yeah" || t === "correct") return "yes"
  if (t === "nope") return "no"
  return text
}

const TENS = new Map<string, number>([["twenty", 20], ["thirty", 30], ["forty", 40], ["fifty", 50], ["sixty", 60], ["seventy", 70], ["eighty", 80], ["ninety", 90]])
const UNITS = new Map<string, number>(CARDINALS.slice(0, 20).map((w, i): [string, number] => [w, i]))
const DIGIT_WORDS = new Map<string, string>([...CARDINALS.slice(0, 10).map((w, i): [string, string] => [w, String(i)]), ["oh", "0"]])

/** "twenty five", "one hundred and four", "forty": a whole number below a thousand, said in words; undefined for anything else. */
function spokenInteger(words: string[]): number | undefined {
  let total = 0
  let seen = false
  let i = 0
  const hundred = words.indexOf("hundred")
  if (hundred >= 0) {
    const head = hundred === 0 ? 1 : UNITS.get(words[0]!)
    if (hundred > 1 || head === undefined || head < 1 || head > 9) return undefined
    total = head * 100
    seen = true
    i = hundred + 1
    if (words[i] === "and") i++
  }
  const rest = words.slice(i)
  if (rest.length === 0) return seen ? total : undefined
  const [first, second] = rest
  if (rest.length === 1) {
    const n = UNITS.get(first!) ?? TENS.get(first!)
    return n === undefined ? undefined : total + n
  }
  const tens = TENS.get(first!)
  const unit = UNITS.get(second!)
  return rest.length === 2 && tens !== undefined && unit !== undefined && unit >= 1 && unit <= 9 ? total + tens + unit : undefined
}

/** A number said in words, with an optional "point" and digits after it ("twenty five point five"), as digits. */
function spokenNumberToDigits(text: string): string | undefined {
  const words = text.split(" ").filter((w) => w !== "")
  if (words.length === 0) return undefined
  const point = words.indexOf("point")
  const whole = spokenInteger(point < 0 ? words : words.slice(0, point))
  if (whole === undefined) return undefined
  if (point < 0) return String(whole)
  const fraction = words.slice(point + 1).map((w) => DIGIT_WORDS.get(w) ?? (/^\d$/.test(w) ? w : undefined))
  return fraction.length > 0 && fraction.every((d) => d !== undefined) ? `${whole}.${fraction.join("")}` : undefined
}

/** "plus nine seven one five oh ...": digit words, "plus" and digits, as a phone number; undefined unless it is only that. */
function spokenPhone(text: string): string | undefined {
  const out: string[] = []
  for (const w of text.split(" ").filter((t) => t !== "")) {
    const d = DIGIT_WORDS.get(w) ?? (/^\d+$/.test(w) ? w : w === "plus" ? "+" : w === "dash" || w === "hyphen" ? "-" : undefined)
    if (d === undefined) return undefined
    out.push(d)
  }
  const joined = out.join("")
  return /\d.*\d.*\d/.test(joined) && joined !== text ? joined : undefined
}

const SYMBOLS = new Map<string, string>([["at", "@"], ["dot", "."], ["underscore", "_"], ["dash", "-"], ["hyphen", "-"], ["slash", "/"], ["colon", ":"]])

/** Said symbols as symbols and spelled letters joined: "sam at example dot com" is sam@example.com. Mechanical, never a guess. */
function spokenSymbols(text: string, needs: string[]): string | undefined {
  const words = text.split(" ").filter((w) => w !== "")
  if (!needs.every((n) => words.includes(n))) return undefined
  return words.map((w) => SYMBOLS.get(w) ?? w).join("")
}

/**
 * What a value turn asks for, when it asks for a typed value: the kind of an Input, of a Form field (the question names
 * it), of a Price, or of a number Preference. Text kinds are never changed.
 */
function askedKind(ir: IRNode | undefined, field: string | undefined): string | undefined {
  switch (ir?.type) {
    case "Input":
      return ir.kind
    case "Form":
      return ir.fields.find((f) => f.id === field)?.kind
    case "Alternative":
      return ir.input === "Price" ? "money" : undefined
    case "Preference":
      return typeof ir.value === "number" ? "number" : undefined
    default:
      return undefined
  }
}

/**
 * A spoken answer for a kind of value, as it would be typed; undefined when nothing applies. Numbers and money: words as
 * digits. Phone: digit words as digits. Email and web address: "at", "dot" and the like as symbols. Dates and text are said
 * as they are written.
 */
export function spokenAnswer(text: string, kind: string, locale: string): string | undefined {
  const t = normalize(text, locale).text
  switch (kind) {
    case "number":
    case "money":
      return spokenNumberToDigits(t)
    case "phone":
      return spokenPhone(t)
    case "email":
      return spokenSymbols(t, ["at", "dot"])
    case "url":
      return spokenSymbols(t, ["dot"])
    default:
      return undefined
  }
}

/** "change two", "change number two", "two", "option two" as digits; the rest ("change phone") is left alone. */
function reviewWord(text: string, locale: string): string {
  const t = normalize(text, locale).text
  const m = /^(change|edit)(?: (?:number|option|question))? (\S+)$/.exec(t)
  if (m) {
    const n = digits(m[2]!)
    return n === undefined ? text : `${m[1]} ${n}`
  }
  const bare = /^(?:(?:number|option|question) )?(\S+)$/.exec(t)
  const n = bare ? digits(bare[1]!) : undefined
  return n ?? readbackWord(text, locale)
}

/**
 * What to try for one alternative in this turn, in order. The mapped form first, then what was said (a label that is
 * itself a number word still matches). A confirm turn is never mapped: only the exact keyword commits.
 */
export function candidates(alternative: string, turn: Turn, plan: LayoutPlan, irs: Map<string, IRNode> = nodeIndex(plan)): string[] {
  const locale = plan.locale
  let mapped = alternative
  switch (turn.state) {
    case "readback":
      mapped = readbackWord(alternative, locale)
      break
    case "browse":
      mapped = spokenToDigits(alternative, locale)
      break
    case "review":
      mapped = reviewWord(alternative, locale)
      break
    case "value": {
      const asked = turn.parts.find((p) => p.kind === "question")
      const ir = irs.get(asked?.node ?? "")
      const kind = askedKind(ir, asked?.field)
      if (turn.choices.length > 0) {
        mapped =
          ir?.type === "Choice" && ir.multiple === true
            ? alternative.split(",").map((token) => spokenToDigits(token, locale)).join(", ")
            : spokenToDigits(alternative, locale)
      } else if (kind !== undefined) {
        // A lone spoken number is a number only where the turn takes one; "two" as a name stays "two".
        mapped = spokenAnswer(alternative, kind, locale) ?? alternative
      }
      break
    }
    default:
      break
  }
  return mapped === alternative ? [alternative] : [mapped, alternative]
}
