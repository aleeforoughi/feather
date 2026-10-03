// Merges the per-story results into visual-audit/report.json and prints a summary: counts per rule, then the top
// components and slots by failures, which is the work list for normalization.
import fs from "node:fs"
import path from "node:path"
import type { FullConfig, Reporter, Suite } from "@playwright/test/reporter"
import { fromEngine, HERE, RULES } from "./expected"
import type { Row } from "./run"

const OUT = process.env.AUDIT_OUT ?? HERE
const results = path.join(OUT, ".results")
let isAudit = false

const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
const count = (rows: Row[], key: (r: Row) => string) => {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1)
  return m
}
const pad = (s: string | number, n: number) => String(s).padEnd(n)

export default class AuditReporter implements Reporter {
  onBegin(_config: FullConfig, suite: Suite) {
    isAudit = suite.allTests().some((t) => t.location.file.endsWith("audit.spec.ts"))
    if (isAudit) fs.rmSync(results, { recursive: true, force: true })
  }

  async onEnd() {
    if (!isAudit || !fs.existsSync(results)) return
    const files = fs.readdirSync(results).filter((f) => f.endsWith(".json"))
    const rows: Row[] = []
    let exempted = 0
    let ignored = 0
    const pages = new Set<string>()
    const stories = new Set<string>()
    for (const f of files) {
      const j = JSON.parse(fs.readFileSync(path.join(results, f), "utf8")) as { story: string; theme: string; exempted: number; ignoredExceptions: number; rows: Row[] }
      rows.push(...j.rows)
      exempted += j.exempted
      ignored = j.ignoredExceptions
      pages.add(`${j.theme}/${j.story}`)
      stories.add(j.story)
    }
    const expected = await fromEngine()
    const component = (r: Row) => r.story.split("--")[0]
    const uniq = (r: Row) => [r.story, r.rule, r.property, r.slot, r.selector].join("|")
    const byRule = count(rows, (r) => r.rule)
    const byRuleUnique = count([...new Map(rows.map((r) => [uniq(r), r])).values()], (r) => r.rule)
    const byComponent = count(rows, component)
    const bySlot = count(rows, (r) => r.slot)
    const obj = (m: Map<string, number>) => Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]))
    const report = {
      generatedAt: new Date().toISOString(),
      expectedSource: expected.source,
      expectedNotes: expected.notes,
      stories: stories.size,
      storyThemePages: pages.size,
      failures: rows.length,
      exemptedByOpticalExceptions: exempted,
      ignoredExceptionEntries: ignored,
      byRule: obj(byRule),
      byRuleUnique: obj(byRuleUnique),
      byComponent: obj(byComponent),
      bySlot: obj(bySlot),
      rows,
    }
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report))

    const out: string[] = ["", `Visual audit: ${stories.size} stories, ${pages.size} story/theme pages, expected values from ${expected.source}, ${rows.length} failures (${exempted} exempted by optical-exceptions.json)`]
    out.push("", `${pad("rule", 18)}${pad("failures", 10)}${pad("unique", 8)}what it checks`)
    for (const [rule, what] of Object.entries(RULES)) out.push(`${pad(rule, 18)}${pad(byRule.get(rule) ?? 0, 10)}${pad(byRuleUnique.get(rule) ?? 0, 8)}${what}`)
    out.push("", "Top 15 components (story group) by failures:")
    for (const [k, v] of top(byComponent, 15)) out.push(`  ${pad(v, 8)}${k}`)
    out.push("", "Top 15 elements by data-slot (~ = nearest ancestor slot):")
    for (const [k, v] of top(bySlot, 15)) out.push(`  ${pad(v, 8)}${k}`)
    out.push("", `Full report: ${path.join(OUT, "report.json")}`, "")
    console.log(out.join("\n"))
  }
}
