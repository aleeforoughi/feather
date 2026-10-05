import type { LayoutPlan } from "@aleeforoughi/feather-liquid"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@aleeforoughi/feather-react"

export function Trace({ plan, highlight = [], only = false }: { plan: LayoutPlan; highlight?: string[]; only?: boolean }) {
  const show = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v))
  return (
    <Table data-testid="trace">
      <TableHeader>
        <TableRow>
          <TableHead>Rule</TableHead>
          <TableHead>Level</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Because</TableHead>
          <TableHead>Overrode</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plan.trace.filter((t) => !only || highlight.includes(t.rule)).map((t, i) => (
          <TableRow key={i} data-rule={t.rule} data-highlighted={highlight.includes(t.rule) ? "true" : undefined} className={highlight.includes(t.rule) ? "bg-muted" : undefined}>
            <TableCell className="font-mono type-caption">{t.rule}</TableCell>
            <TableCell>{t.level}</TableCell>
            <TableCell className="font-mono type-caption">{t.subject}</TableCell>
            <TableCell className="font-mono type-caption">{show(t.value)}</TableCell>
            <TableCell className="whitespace-normal">{t.because}</TableCell>
            <TableCell className="whitespace-normal">
              {t.overrode?.length ? (
                <ul>
                  {t.overrode.map((o, j) => (
                    <li key={j}>
                      <span className="font-mono type-caption">{o.rule}</span> = {show(o.value)}: {o.because}
                    </li>
                  ))}
                </ul>
              ) : (
                "-"
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

