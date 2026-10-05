// What a turn sounds like (docs/manifestations.md section 3). Pure: text in, text out. Nothing here refers to anything
// a person would have to see.
import type { Choice, Part, Turn } from "@aleeforoughi/feather-dialog"
import type { LayoutPlan } from "@aleeforoughi/feather-liquid"

export interface Speech {
  text: string
  /** The plan's locale. */
  lang: string
  kind: Part["kind"] | "choices"
  /** Silence to leave after it, in milliseconds. The host decides whether to honour it. */
  pauseAfterMs?: number
}

/** More options than this are numbered: "Say one for Small, two for Medium, ..." */
export const MAX_SPOKEN_WORDS = 3

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]
/** The number as it is spoken: words up to twenty, which is as far as `hear` maps back; digits beyond. */
export const spokenNumber = (n: number) => NUMBER_WORDS[n] ?? String(n)

const PAUSE: Partial<Record<Speech["kind"], number>> = { content: 200, consequence: 600, outcome: 300, update: 300, problem: 300, hint: 200, choices: 0 }

/**
 * Feather's own wording that assumes a screen or a keyboard ("the words shown", "Type", "above the maximum") becomes
 * wording that works for the ear. Only Feather's words: what the caller wrote (content, consequences, labels) is
 * said verbatim, because rewording it could change what it means ("See you tomorrow", "Prices above 5 AED").
 */
export function plain(text: string): string {
  return text
    .replace(/\bthe words shown\b/gi, "one of the choices")
    .replace(/\bis (above|below) the (maximum|minimum)\b/g, (_m, d: string, w: string) => `is ${d === "above" ? "more" : "less"} than the ${w}`)
    .replace(/\s+(?:below|above)\b(?=[\s.,!?]|$)/gi, "")
    .replace(/\b(Click|Tap)\b(\s+on)?/g, "Choose")
    .replace(/\b(click|tap)\b(\s+on)?/g, "choose")
    .replace(/\bSee\b/g, "Hear")
    .replace(/\bsee\b/g, "hear")
    .replace(/\b(buttons?)\b/gi, (m) => (m.toLowerCase().endsWith("s") ? "choices" : "choice"))
    .replace(/\bscreens?\b/gi, "device")
    .replace(/\bType\b/g, "Say")
    .replace(/\btype\b/g, "say")
}

const stripEnd = (s: string) => s.replace(/[.!?\s]+$/, "")

/** "Say a, or b." / "Say a, b, or c." */
function sayList(words: string[]): string {
  if (words.length === 1) return `Say ${words[0]}.`
  return `Say ${words.slice(0, -1).join(", ")}, or ${words[words.length - 1]}.`
}

/** How a list of choices is said. In browse, an act's own word ("approve") is said when it is unique; a value's id never is. */
export function sayChoices(choices: Choice[], state: Turn["state"]): string {
  if (choices.length === 0) return ""
  // A label is the caller's words, said as written, so the person can say it back.
  if (choices.length > MAX_SPOKEN_WORDS) return `Say ${choices.map((c) => `${spokenNumber(c.n)} for ${stripEnd(c.label)}`).join(", ")}.`
  return sayList(choices.map((c) => stripEnd(state === "browse" && c.words[0] !== undefined ? c.words[0] : c.label)))
}

/** The keyword the dialog asks for, from the question it asked. */
function keywordIn(question: string): string {
  return /"([^"]*)" to go ahead/.exec(question)?.[1] ?? "confirm"
}

/** What to say for a turn, in order: content, then consequences in full, then what the person can say. */
export function speechFor(turn: Turn, plan: LayoutPlan): Speech[] {
  const lang = plan.locale
  const out: Speech[] = []
  const add = (kind: Speech["kind"], text: string) => {
    const pauseAfterMs = PAUSE[kind]
    out.push({ text, lang, kind, ...(pauseAfterMs ? { pauseAfterMs } : {}) })
  }
  const choices = sayChoices(turn.choices, turn.state)
  for (const part of turn.parts) {
    if (part.kind === "question") {
      if (turn.state === "browse") {
        if (choices) add("choices", choices)
        continue
      }
      if (turn.state === "confirm") {
        add("question", `Say "${keywordIn(part.text)}" to go ahead, or "cancel".`)
        continue
      }
      add("question", plain(part.text))
      if (turn.state === "value" && choices) add("choices", choices)
      continue
    }
    // Problems and hints are Feather's words; content, consequences and outcomes carry the caller's, verbatim.
    add(part.kind, part.kind === "problem" || part.kind === "hint" ? plain(part.text) : part.text)
  }
  return out
}
