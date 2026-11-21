// Splitting display text for a word, line or character reveal. The real text stays in the DOM for screen readers and
// search; the split pieces are presentation (aria-hidden). Lines need layout, so they are grouped only after the
// fonts have loaded (document.fonts.ready), never before: a split made with the fallback face breaks wrong.

export type SplitBy = "line" | "word" | "char"

/** Words and the spaces between them, so joining the pieces gives the text back. */
export function splitWords(text: string): string[] {
  return text.split(/(\s+)/).filter((p) => p.length > 0)
}

/** Characters (by code point, so emoji and accents stay whole), per word. */
export function splitChars(word: string): string[] {
  return [...word]
}

/** Groups elements into lines by their top edge (elements on one line share it within 2px). */
export function groupLines<T extends { offsetTop: number }>(elements: T[]): T[][] {
  const lines: T[][] = []
  let top: number | null = null
  for (const el of elements) {
    if (top === null || Math.abs(el.offsetTop - top) > 2) {
      lines.push([el])
      top = el.offsetTop
    } else lines[lines.length - 1].push(el)
  }
  return lines
}

/** Resolves when the page's fonts have loaded (at once where the Font Loading API is missing). */
export function fontsReady(): Promise<void> {
  const fonts = typeof document !== "undefined" ? (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts : undefined
  return fonts?.ready ? fonts.ready.then(() => undefined) : Promise.resolve()
}
