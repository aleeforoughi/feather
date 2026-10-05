import type { SearchEntry } from "../plugins/docs-source"

const KIND_WEIGHT: Record<SearchEntry["kind"], number> = { node: 0, schema: 1, page: 2, heading: 3 }

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()

/** Client-side search over headings, node names and schema files: every word of the query must appear in the text. */
export function search(entries: SearchEntry[], query: string, limit = 8): SearchEntry[] {
  const q = norm(query)
  if (!q) return []
  const words = q.split(" ")
  const squashed = q.replace(/ /g, "")
  const scored: { entry: SearchEntry; score: number }[] = []
  for (const entry of entries) {
    const text = norm(entry.text)
    const hit = words.every((w) => text.includes(w)) || text.replace(/ /g, "").includes(squashed)
    if (!hit) continue
    const score = (text === q ? 0 : text.startsWith(q) ? 10 : 20) + KIND_WEIGHT[entry.kind] + text.length / 1000
    scored.push({ entry, score })
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.entry)
}
