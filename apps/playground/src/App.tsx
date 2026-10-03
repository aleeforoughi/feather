import * as React from "react"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import { REFERENCE_CONTEXTS, type LayoutPlan } from "@aleeforoughi/feather-liquid"
import { FeatherExperience, PlanView } from "@aleeforoughi/feather-manifest-web"
import { Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from "@aleeforoughi/feather-react"
import { composeText, RUNS, type Problem } from "./compose"
import { ContextControls, DEFAULT_CONTROLS, toContext, type Controls } from "./controls"
import { applyTheme, THEME_NAMES, type ThemeName } from "./theme"

// Every valid conformance fixture, by file name.
const FILES = import.meta.glob<{ description: string; ir: unknown }>("../../../conformance/ir/valid/*.json", { eager: true, import: "default" })
const FIXTURES = Object.entries(FILES)
  .map(([path, fixture]) => ({ name: path.split("/").pop()!.replace(/\.json$/, ""), description: fixture.description, text: JSON.stringify(fixture.ir, null, 2) }))
  .sort((a, b) => a.name.localeCompare(b.name))

const SELECT = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function Issues({ problems }: { problems: Problem[] }) {
  return (
    <div data-testid="issues" data-slot="playground-issues" role="status" className="rounded-lg border-2 border-destructive p-3 text-sm">
      <p className="font-medium">{problems.length === 1 ? "1 issue" : `${problems.length} issues`} to fix before this can render</p>
      <ul className="mt-2 flex flex-col gap-2">
        {problems.map((p, i) => (
          <li key={i} data-slot="playground-issue">
            {p.path && <code className="font-mono text-xs">{p.path}</code>} {p.message} <span className="text-muted-foreground">[{p.code}]</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Trace({ plan }: { plan: LayoutPlan }) {
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
        {plan.trace.map((t, i) => (
          <TableRow key={i}>
            <TableCell className="font-mono text-xs">{t.rule}</TableCell>
            <TableCell>{t.level}</TableCell>
            <TableCell className="font-mono text-xs">{t.subject}</TableCell>
            <TableCell className="font-mono text-xs">{show(t.value)}</TableCell>
            <TableCell className="whitespace-normal">{t.because}</TableCell>
            <TableCell className="whitespace-normal">
              {t.overrode?.length ? (
                <ul>
                  {t.overrode.map((o, j) => (
                    <li key={j}>
                      <span className="font-mono text-xs">{o.rule}</span> = {show(o.value)}: {o.because}
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

export default function App() {
  const [fixture, setFixture] = React.useState(FIXTURES.find((f) => f.name === "ad-campaign-launch")?.name ?? FIXTURES[0]!.name)
  const [text, setText] = React.useState(() => FIXTURES.find((f) => f.name === fixture)!.text)
  const [controls, setControls] = React.useState<Controls>(DEFAULT_CONTROLS)
  const [theme, setTheme] = React.useState<ThemeName>("paper-sharp")
  const [reply, setReply] = React.useState<string>("")

  React.useLayoutEffect(() => applyTheme(theme), [theme])

  const context = React.useMemo(() => toContext(controls), [controls])
  const { composed, ms } = React.useMemo(() => composeText(text, context), [text, context])

  const pick = (name: string) => {
    setFixture(name)
    setText(FIXTURES.find((f) => f.name === name)!.text)
    setReply("")
  }
  const onReply = React.useCallback((r: ReplyEvent) => setReply(JSON.stringify(r)), [])
  const noop = React.useCallback(() => {}, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h1 className="font-heading text-lg font-semibold">Feather playground</h1>
        <p data-testid="compose-time" data-compose-ms={ms.toFixed(3)} className="text-sm text-muted-foreground">
          Compose time: <span className="font-medium text-foreground">{ms.toFixed(3)} ms</span> (average of {RUNS} runs)
        </p>
      </header>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(20rem,28rem)_1fr]">
        <section aria-label="Experience and context" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="fixture">Fixture</Label>
            <select id="fixture" className={SELECT} value={fixture} onChange={(e) => pick(e.target.value)}>
              {FIXTURES.map((f) => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="theme">Theme</Label>
            <select id="theme" className={SELECT} value={theme} onChange={(e) => setTheme(e.target.value as ThemeName)}>
              {THEME_NAMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ir">Experience IR (JSON)</Label>
            <Textarea id="ir" data-testid="ir-editor" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} className="min-h-72 font-mono text-xs" aria-describedby={composed.ok ? undefined : "ir-issues"} aria-invalid={composed.ok ? undefined : true} />
          </div>
          {!composed.ok && <div id="ir-issues"><Issues problems={composed.problems} /></div>}
          <ContextControls value={controls} onChange={setControls} />
        </section>

        <section aria-label="Result" className="min-w-0">
          <Tabs defaultValue="rendered">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="rendered">Rendered</TabsTrigger>
              <TabsTrigger value="contexts">Four contexts</TabsTrigger>
              <TabsTrigger value="plan">Plan</TabsTrigger>
              <TabsTrigger value="trace">Trace</TabsTrigger>
            </TabsList>
            <TabsContent value="rendered" className="flex flex-col gap-3 pt-3">
              {composed.ok ? (
                // Focus is not moved here: the view is remounted as the JSON becomes valid again, and typing must not be interrupted.
                <PlanView plan={composed.plan} experience={composed.experience} onReply={onReply} autoFocus={false} />
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to render until the IR is valid.</p>
              )}
              <div>
                <p className="text-sm font-medium">Last reply</p>
                <pre data-testid="last-reply" className="mt-1 min-h-8 overflow-x-auto rounded-lg bg-muted p-2 font-mono text-xs">{reply || "none yet"}</pre>
              </div>
            </TabsContent>
            <TabsContent value="contexts" className="pt-3">
              {composed.ok ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {Object.entries(REFERENCE_CONTEXTS).map(([name, { title, context: ctx }]) => (
                    <section key={name} data-testid="context-panel" aria-labelledby={`ctx-${name}`} className="flex min-w-0 flex-col gap-2">
                      <h3 id={`ctx-${name}`} data-testid="context-title" className="text-sm font-semibold">{title}</h3>
                      <FeatherExperience experience={composed.experience} context={ctx} onReply={noop} autoFocus={false} />
                    </section>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to render until the IR is valid.</p>
              )}
            </TabsContent>
            <TabsContent value="plan" className="pt-3">
              {composed.ok ? <pre data-testid="plan-json" className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{JSON.stringify(composed.plan, null, 2)}</pre> : <p className="text-sm text-muted-foreground">No plan until the IR is valid.</p>}
            </TabsContent>
            <TabsContent value="trace" className="pt-3">
              {composed.ok ? <Trace plan={composed.plan} /> : <p className="text-sm text-muted-foreground">No trace until the IR is valid.</p>}
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  )
}
