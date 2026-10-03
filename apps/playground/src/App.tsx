import * as React from "react"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import { compose, type LayoutPlan } from "@aleeforoughi/feather-liquid"
import { Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from "@aleeforoughi/feather-react"
import { Body } from "./bodies"
import { composeText, RUNS, type Problem } from "./compose"
import { FOUR_CONTEXTS, PRESET_CONTEXTS } from "./contexts"
import { Choice, ContextControls, DEFAULT_CONTROLS, toContext, type Controls } from "./controls"
import { applyTheme, THEME_NAMES, type ThemeName } from "./theme"

// Every valid conformance fixture, by file name.
const FILES = import.meta.glob<{ description: string; ir: unknown }>("../../../conformance/ir/valid/*.json", { eager: true, import: "default" })
const FIXTURES = Object.entries(FILES)
  .map(([path, fixture]) => ({ name: path.split("/").pop()!.replace(/\.json$/, ""), description: fixture.description, text: JSON.stringify(fixture.ir, null, 2) }))
  .sort((a, b) => a.name.localeCompare(b.name))

function Issues({ problems }: { problems: Problem[] }) {
  return (
    <div data-testid="issues" data-slot="playground-issues" role="status" className="rounded-card border border-destructive inset-content type-body-sm">
      <p className="font-medium">{problems.length === 1 ? "1 issue" : `${problems.length} issues`} to fix before this can render</p>
      <ul className="mt-3 flex flex-col gap-2">
        {problems.map((p, i) => (
          <li key={i} data-slot="playground-issue">
            {p.path && <code className="font-mono type-caption">{p.path}</code>} {p.message} <span className="text-fg-secondary">[{p.code}]</span>
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

/** The last reply, and which body sent it. The text stays the bare reply event; the body is beside it. */
function LastReply({ reply }: { reply: { text: string; body: string } | null }) {
  return (
    <div className="flex flex-col gap-label">
      <p className="type-label">
        Last reply <span data-testid="last-reply-body" className="font-normal text-fg-secondary">{reply ? `(sent by the ${reply.body} body)` : ""}</span>
      </p>
      <pre data-testid="last-reply" data-body={reply?.body} className="min-h-control overflow-x-auto rounded-control bg-muted px-control py-3 font-mono type-caption">{reply?.text || "none yet"}</pre>
    </div>
  )
}

export default function App() {
  const [fixture, setFixture] = React.useState(FIXTURES.find((f) => f.name === "ad-campaign-launch")?.name ?? FIXTURES[0]!.name)
  const [text, setText] = React.useState(() => FIXTURES.find((f) => f.name === fixture)!.text)
  const [controls, setControls] = React.useState<Controls>(DEFAULT_CONTROLS)
  const [theme, setTheme] = React.useState<ThemeName>("feather")
  const [reply, setReply] = React.useState<{ text: string; body: string } | null>(null)
  const [preset, setPreset] = React.useState("custom")

  React.useLayoutEffect(() => applyTheme(theme), [theme])

  const context = React.useMemo(() => toContext(controls), [controls])
  const { composed, ms } = React.useMemo(() => composeText(text, context), [text, context])

  const pick = (name: string) => {
    setFixture(name)
    setText(FIXTURES.find((f) => f.name === name)!.text)
    setReply(null)
  }
  const onReply = React.useCallback((r: ReplyEvent, body: string) => setReply({ text: JSON.stringify(r), body }), [])
  // What the Rendered tab shows: the controls' context, or one of the named ones.
  const rendered = React.useMemo((): { plan: LayoutPlan } | null => {
    if (!composed.ok) return null
    const named = PRESET_CONTEXTS.find((c) => c.id === preset)
    if (!named) return { plan: composed.plan }
    const result = compose(composed.experience, named.context)
    return result.ok ? { plan: result.plan } : null
  }, [composed, preset])
  // One plan for each of the four contexts, each rendered by the body its own plan names.
  const four = React.useMemo(() => {
    if (!composed.ok) return []
    return FOUR_CONTEXTS.map((c) => {
      const result = compose(composed.experience, c.context)
      return { ...c, plan: result.ok ? result.plan : null }
    })
  }, [composed])

  return (
    <div className="min-h-screen bg-background text-fg-primary">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-secondary px-container py-3">
        <h1 className="type-title">Feather playground</h1>
        <p data-testid="compose-time" data-compose-ms={ms.toFixed(3)} className="type-body-sm text-fg-secondary">
          Compose time: <span className="font-medium text-fg-primary">{ms.toFixed(3)} ms</span> (average of {RUNS} runs)
        </p>
      </header>
      <div className="grid gap-6 px-container py-6 lg:grid-cols-[minmax(20rem,28rem)_1fr]">
        <section aria-label="Experience and context" className="flex min-w-0 flex-col gap-field">
          <Choice label="Fixture" value={fixture} items={FIXTURES.map((f) => ({ value: f.name, label: f.name }))} onChange={pick} />
          <Choice label="Theme" value={theme} items={THEME_NAMES.map((t) => ({ value: t, label: t }))} onChange={(t) => setTheme(t as ThemeName)} />
          <div className="flex flex-col gap-label">
            <Label htmlFor="ir">Experience IR (JSON)</Label>
            <Textarea id="ir" data-testid="ir-editor" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} className="min-h-72 font-mono type-caption" aria-describedby={composed.ok ? undefined : "ir-issues"} aria-invalid={composed.ok ? undefined : true} />
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
              {composed.ok && rendered ? (
                <>
                  <div className="flex flex-wrap items-end gap-3">
                    <Choice label="Context" className="min-w-72" value={preset} items={[{ value: "custom", label: "The controls on the left" }, ...PRESET_CONTEXTS.map((c) => ({ value: c.id, label: c.title }))]} onChange={setPreset} />
                    <p data-testid="rendered-body" className="pb-3 type-body-sm text-fg-secondary">Body: <span className="font-medium text-fg-primary">{rendered.plan.manifestation}</span></p>
                  </div>
                  {/* Focus is not moved here: the view is remounted as the JSON becomes valid again, and typing must not be interrupted. */}
                  <Body key={rendered.plan.manifestation} plan={rendered.plan} experience={composed.experience} onReply={onReply} />
                </>
              ) : (
                <p className="type-body-sm text-fg-secondary">Nothing to render until the IR is valid.</p>
              )}
              <LastReply reply={reply} />
            </TabsContent>
            <TabsContent value="contexts" className="flex flex-col gap-3 pt-3">
              {composed.ok ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {four.map(({ id, title, plan }) => (
                    <section key={id} data-testid="context-panel" data-body={plan?.manifestation} aria-labelledby={`ctx-${id}`} className="flex min-w-0 flex-col gap-2">
                      <h3 id={`ctx-${id}`} className="type-label">
                        <span data-testid="context-title">{title}</span> <span data-testid="context-body" className="font-normal text-fg-secondary">({plan?.manifestation ?? "no plan"})</span>
                      </h3>
                      {plan && <Body plan={plan} experience={composed.experience} onReply={onReply} />}
                    </section>
                  ))}
                </div>
              ) : (
                <p className="type-body-sm text-fg-secondary">Nothing to render until the IR is valid.</p>
              )}
              <LastReply reply={reply} />
            </TabsContent>
            <TabsContent value="plan" className="pt-3">
              {composed.ok ? <pre data-testid="plan-json" className="overflow-x-auto rounded-card bg-muted inset-content font-mono type-caption">{JSON.stringify(composed.plan, null, 2)}</pre> : <p className="type-body-sm text-fg-secondary">No plan until the IR is valid.</p>}
            </TabsContent>
            <TabsContent value="trace" className="pt-3">
              {composed.ok ? <Trace plan={composed.plan} /> : <p className="type-body-sm text-fg-secondary">No trace until the IR is valid.</p>}
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  )
}
