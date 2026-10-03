// Normalizing what a person typed or said (docs/manifestations.md section 1, Inputs 1). Pure; never throws.

export interface Normalized {
  /** NFC, trimmed, inner whitespace collapsed. Case and trailing punctuation kept: what a value is made from. */
  raw: string
  /** `raw` without trailing ".", "!" and "?" (a value is made from this when it is a number or a date). */
  plain: string
  /** `plain` case-folded with the locale: what words are matched on. A lone "?" stays "?" (it asks for help). */
  text: string
}

/** Lower-cases with the locale's rules, falling back to the default rules for a locale the runtime does not know. */
export function fold(value: string, locale: string): string {
  try {
    return value.toLocaleLowerCase(locale)
  } catch {
    return value.toLowerCase()
  }
}

/** Drops trailing ".", "!" and "?", then trailing space. Linear in the length of the string. */
function stripTrailing(value: string): string {
  let end = value.length
  while (end > 0 && (value[end - 1] === "." || value[end - 1] === "!" || value[end - 1] === "?")) end--
  return end === value.length ? value : value.slice(0, end).trimEnd()
}

/** Unicode NFC, trimmed, whitespace collapsed, trailing punctuation dropped, case folded with the plan's locale. */
export function normalize(input: string, locale: string): Normalized {
  let raw: string
  try {
    raw = input.normalize("NFC").replace(/\s+/g, " ").trim()
  } catch {
    raw = String(input).replace(/\s+/g, " ").trim()
  }
  const plain = stripTrailing(raw)
  const text = plain === "" && raw.includes("?") ? "?" : fold(plain, locale)
  return { raw, plain, text }
}
