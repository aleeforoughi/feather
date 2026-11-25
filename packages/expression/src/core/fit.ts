// Fit (docs/visual-system.md section 14.1): display type never runs past its box. foundation.css caps each display step
// (and the heading roles, where a text asks) at what fits the box it sits in, measured in the text's longest run that
// cannot break. This is the text side: the runs, their length, and the style that tells the CSS. A text whose runs
// are all within the house measure needs nothing from here, so it renders exactly as it always did.

/** The characters a display line always holds: foundation.css's --display-measure. Every display step is capped so a
 * run this long fits its box; only a longer run is written into the markup (as --fit-chars). */
export const FIT_MEASURE = 10

/** Where a text may break: any space but the no-break ones (U+00A0 and U+202F join a number to its unit). */
const BREAK = /[^\S\u00a0\u202f]+/
const BREAKS = /([^\S\u00a0\u202f]+)/
/** Punctuation and symbols at a run's ends ("themselves.", "“Scene”"): narrow, and not what decides the fit. */
const EDGES = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu

/** The runs of a text that cannot break. */
export function runs(text: string): string[] {
  return text.split(BREAK).filter((r) => r.length > 0)
}

/** A run's length in characters (code points), without the punctuation at its ends. */
export function runLength(run: string): number {
  return [...run.replace(EDGES, "")].length
}

/** The longest run of one or more texts (a swap title's sentence and its words), in characters. */
export function longestRun(...texts: string[]): number {
  return texts.reduce((n, t) => runs(t).reduce((m, r) => Math.max(m, runLength(r)), n), 0)
}

/** Whether a run is longer than the measure: it is set as its own unbreakable piece (fit-word), which hyphenates only
 * when it cannot fit even at the floor. */
export function isLongRun(run: string): boolean {
  return runLength(run) > FIT_MEASURE
}

/** The text split into runs and the spaces between them, so joining the parts gives the text back. */
export function fitParts(text: string): string[] {
  return text.split(BREAKS).filter((p) => p.length > 0)
}

/** The --fit-chars foundation.css caps a text's size with: its longest run, or undefined when every run is within the
 * measure (the CSS already holds those). */
export function fitChars(...texts: string[]): number | undefined {
  const n = longestRun(...texts)
  return n > FIT_MEASURE ? n : undefined
}

/** The space between a number and its unit: a no-break space while the two fit the measure together ("12 years",
 * "40 %"), so they stay on one line; a plain space for a longer pair ("1,250 kilometres"), so the unit may wrap under
 * the number rather than the figure run past its box. */
export function unitSpace(value: string, unit: string): string {
  return runLength(`${value}${unit}`) + 1 > FIT_MEASURE ? " " : "\u00a0"
}

/** A number and its unit as one text, joined by unitSpace. */
export function joinUnit(value: string, unit?: string): string {
  return unit ? `${value}${unitSpace(value, unit)}${unit}` : value
}
