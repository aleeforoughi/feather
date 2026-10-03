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

/**
 * Whether a value turn without options takes a number. Only then is a lone spoken number mapped; for text ("two"
 * as a name or a reason) it would change what the person said.
 */
function takesNumber(ir: IRNode | undefined): boolean {
  switch (ir?.type) {
    case "Input":
      return ir.kind === "number" || ir.kind === "money"
    case "Alternative":
      return ir.input === "Price"
    case "Preference":
      return typeof ir.value === "number"
    default:
      return false
  }
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
    case "value": {
      const ir = irs.get(turn.parts.find((p) => p.kind === "question")?.node ?? "")
      if (turn.choices.length > 0) {
        mapped =
          ir?.type === "Choice" && ir.multiple === true
            ? alternative.split(",").map((token) => spokenToDigits(token, locale)).join(", ")
            : spokenToDigits(alternative, locale)
      } else if (takesNumber(ir)) {
        const whole = NUMBERS.get(normalize(alternative, locale).text)
        if (whole !== undefined) mapped = whole
      }
      break
    }
    default:
      break
  }
  return mapped === alternative ? [alternative] : [mapped, alternative]
}
