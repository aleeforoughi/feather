import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react"
import { buildTheme, contrastRatio, FONTS, fontSlug, SIGNATURES, PACES, SURFACES, FOCUS, CONTRASTS, RADIUS_TIERS, DENSITY, ELEVATION, HEADING_WEIGHTS, PERSONALITIES, type BrandTokens } from "@aleeforoughi/feather-tokens"
import { Alert, AlertDescription, AlertTitle } from "../../../../../packages/react/src/components/ui/alert"
import { Badge } from "../../../../../packages/react/src/components/ui/badge"
import { Button } from "../../../../../packages/react/src/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../packages/react/src/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "../../../../../packages/react/src/components/ui/field"
import { Input } from "../../../../../packages/react/src/components/ui/input"
import { Progress } from "../../../../../packages/react/src/components/ui/progress"
import { Switch } from "../../../../../packages/react/src/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../packages/react/src/components/ui/tabs"
import { defaultBlocks } from "../../../../../packages/page/src/blocks/index"
import { BLOCKS } from "../../../../../packages/page/src/blocks/fixtures"
import { THEMES } from "../../../.storybook/themes"
import "./docs.css"

// Every Feather font ships as a CSS file in the tokens package; load the ones the form picks, when it picks them.
const FONT_FILES = import.meta.glob("../../../../../packages/tokens/fonts/*.css")
const loaded = new Set<string>()
function loadFont(name: unknown) {
  if (typeof name !== "string" || loaded.has(name)) return
  const file = FONT_FILES[`../../../../../packages/tokens/fonts/${fontSlug(name)}.css`]
  if (file) {
    loaded.add(name)
    void file()
  }
}

const STYLE_ID = "feather-builder-theme"
type FontValue = string | Record<string, unknown>
const CUSTOM = "__custom__"

interface Form {
  schema: "feather-tokens/3" | "feather-tokens/4"
  name: string
  background: string
  surface: string
  text: string
  primary: string
  accent: string
  destructive: string
  display: FontValue
  body: FontValue
  mono: FontValue | ""
  headingWeight: string
  shape: string
  density: string
  elevation: string
  motion: string
  pace: string
  signature: string
  contrast: string
  surfaceKind: string
  blur: string
  grain: string
  focus: string
  loudness: string
  personality: string
  blocks: string[]
  mediaScrim: string
  /** What the form has no field for (components, a voice face, an open display scale…): carried through untouched. */
  extra: Record<string, unknown>
}

const START: Form = {
  schema: "feather-tokens/3",
  name: "My brand",
  background: "#F7F7F5",
  surface: "#FFFFFF",
  text: "#18181B",
  primary: "#3B3BF5",
  accent: "#3B3BF5",
  destructive: "",
  display: "Sora",
  body: "Inter",
  mono: "",
  headingWeight: "",
  shape: "rounded",
  density: "comfortable",
  elevation: "soft",
  motion: "calm",
  pace: "calm",
  signature: "expo-out",
  contrast: "quiet",
  surfaceKind: "flat",
  blur: "",
  grain: "",
  focus: "accent",
  loudness: "1",
  personality: "",
  blocks: ["", "", "", ""],
  mediaScrim: "",
  extra: {},
}

/** A reference brand (or any brand file) into the form. Anything without a field stays in `extra`. */
function fromTokens(t: BrandTokens & Record<string, unknown>): Form {
  const { schema, name, colors, typography, shape, density, elevation, motion, pace, signature, contrast, surface, blur, grain, focus, loudness, personality, ...rest } = t as Record<string, unknown> & BrandTokens
  const { fontFamily, headingWeight, ...typeRest } = (typography ?? {}) as BrandTokens["typography"] & Record<string, unknown>
  const c = (colors ?? {}) as Record<string, string>
  const { background, surface: surf, text, primary, accent, destructive, blocks: colorBlocks, mediaScrim, ...colorRest } = c as unknown as Record<string, string> & { blocks?: { surface: string; ink?: string }[] }
  const extra: Record<string, unknown> = { ...rest }
  // Block surfaces get fields; an ink the brand wrote by hand has none, so keep the pairs that carry one as they are.
  const customInk = Array.isArray(colorBlocks) && colorBlocks.some((b) => b.ink)
  if (customInk) (colorRest as Record<string, unknown>).blocks = colorBlocks
  if (Object.keys(colorRest).length) extra.colors = colorRest
  if (Object.keys(typeRest).length) extra.typography = typeRest
  const preset = typeof personality === "string" ? PERSONALITIES[personality as keyof typeof PERSONALITIES] : undefined
  const font = (v: unknown): FontValue => (typeof v === "string" ? v : v && typeof v === "object" ? (v as Record<string, unknown>) : "")
  return {
    ...START,
    schema: (schema as string) === "feather-tokens/4" ? "feather-tokens/4" : "feather-tokens/3",
    name: String(name ?? "My brand"),
    background: background ?? START.background,
    surface: surf ?? START.surface,
    text: text ?? START.text,
    primary: primary ?? START.primary,
    accent: accent ?? primary ?? START.accent,
    destructive: destructive ?? "",
    display: font(fontFamily?.display) || "Inter",
    body: font(fontFamily?.body) || "Inter",
    mono: font(fontFamily?.mono),
    headingWeight: headingWeight ? String(headingWeight) : "",
    shape: shape ?? START.shape,
    density: density ?? START.density,
    elevation: elevation ?? START.elevation,
    motion: typeof motion === "string" ? motion : (pace ?? preset?.pace) === "snappy" ? "snappy" : "calm",
    pace: (pace as string) ?? preset?.pace ?? (motion as string) ?? "calm",
    signature: typeof signature === "string" ? signature : signature ? "custom" : (preset?.signature ?? "expo-out"),
    contrast: (contrast as string) ?? "quiet",
    surfaceKind: (surface as string) ?? "flat",
    blur: blur === undefined ? "" : String(blur),
    grain: grain === undefined ? "" : String(grain),
    // A /2 brand keeps its primary ring when it moves to /3 (migrateTokens does the same).
    focus: (focus as string) ?? (schema === "feather-tokens/2" || schema === undefined ? "primary" : "accent"),
    loudness: loudness === undefined ? "1" : String(loudness),
    personality: personality === undefined ? "" : String(personality),
    blocks: [0, 1, 2, 3].map((i) => (!customInk && Array.isArray(colorBlocks) ? (colorBlocks[i]?.surface ?? "") : "")),
    mediaScrim: mediaScrim ?? "",
    extra: signature && typeof signature === "object" ? { ...extra, signature } : extra,
  }
}

/** The form into the brand file a product would keep in brand/tokens.json. */
function toTokens(f: Form): Record<string, unknown> {
  // Colour blocks are written in order: the leading filled fields become block-1.., and the engine picks each ink.
  const blocks: { surface: string }[] = []
  for (const b of f.blocks) {
    if (!b) break
    blocks.push({ surface: b })
  }
  // A personality sets pace and signature; they are written only when the form differs from it.
  const preset = f.schema === "feather-tokens/4" && f.personality ? PERSONALITIES[f.personality as keyof typeof PERSONALITIES] : undefined
  const extra = f.extra as Record<string, unknown> & { colors?: Record<string, string>; typography?: Record<string, unknown>; signature?: unknown }
  const out: Record<string, unknown> = {
    schema: f.schema,
    name: f.name,
    colors: {
      background: f.background,
      surface: f.surface,
      text: f.text,
      primary: f.primary,
      accent: f.accent,
      ...(f.destructive ? { destructive: f.destructive } : {}),
      ...(f.schema === "feather-tokens/4" && blocks.length > 0 ? { blocks } : {}),
      ...(f.schema === "feather-tokens/4" && f.mediaScrim ? { mediaScrim: f.mediaScrim } : {}),
      ...(extra.colors ?? {}),
    },
    typography: {
      fontFamily: { display: f.display, body: f.body, ...(f.mono ? { mono: f.mono } : {}) },
      ...(f.headingWeight ? { headingWeight: Number(f.headingWeight) } : {}),
      ...(extra.typography ?? {}),
    },
    shape: f.shape,
    density: f.density,
    elevation: f.elevation,
    motion: f.motion,
    ...(preset && f.pace === preset.pace ? {} : { pace: f.pace }),
    ...(preset && f.signature === preset.signature ? {} : { signature: f.signature === "custom" ? extra.signature : f.signature }),
    contrast: f.contrast,
    surface: f.surfaceKind,
    ...(f.surfaceKind === "glass" && f.blur ? { blur: Number(f.blur) } : {}),
    ...(f.surfaceKind === "film" && f.grain ? { grain: Number(f.grain) } : {}),
    focus: f.focus,
  }
  if (f.schema === "feather-tokens/4") {
    out.loudness = Number(f.loudness)
    if (f.personality) out.personality = f.personality
  }
  for (const [k, v] of Object.entries(extra)) if (!["colors", "typography", "signature"].includes(k)) out[k] = v
  return out
}

function Select({ id, label, value, options, onChange, hint }: { id: string; label: string; value: string; options: readonly (string | number)[]; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className="fd-label" htmlFor={id}>{label}</label>
      <select id={id} className="fd-field" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined}>
        {options.map((o) => (
          <option key={o} value={String(o)}>{o === "" ? "(none)" : String(o)}</option>
        ))}
      </select>
      {hint ? <small id={`${id}-hint`} style={{ display: "block", fontSize: 11, opacity: 0.75, marginTop: 2 }}>{hint}</small> : null}
    </div>
  )
}

function ColorField({ id, label, value, onChange, optional }: { id: string; label: string; value: string; onChange: (v: string) => void; optional?: boolean }) {
  const valid = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
  const picker = valid ? (value.length === 4 ? `#${[1, 2, 3].map((i) => value[i]! + value[i]!).join("")}` : value) : "#000000"
  return (
    <div>
      <label className="fd-label" htmlFor={id}>{label}{optional ? " (optional)" : ""}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input id={id} className="fd-field" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} aria-invalid={value !== "" && !valid} placeholder={optional ? "engine default" : "#RRGGBB"} />
        <input type="color" aria-label={`${label} picker`} value={picker} onChange={(e) => onChange(e.target.value.toUpperCase())} style={{ width: 44, height: 44, padding: 2, flex: "0 0 44px" }} />
      </div>
    </div>
  )
}

function FontSelect({ id, label, value, onChange, optional }: { id: string; label: string; value: FontValue; onChange: (v: string) => void; optional?: boolean }) {
  const custom = typeof value === "object"
  const names = Object.keys(FONTS)
  return (
    <div>
      <label className="fd-label" htmlFor={id}>{label}</label>
      <select id={id} className="fd-field" value={custom ? CUSTOM : value} onChange={(e) => e.target.value !== CUSTOM && onChange(e.target.value)}>
        {optional ? <option value="">(none)</option> : null}
        {custom ? <option value={CUSTOM}>Open font: {String((value as Record<string, unknown>).family)} (kept as is)</option> : null}
        {names.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  )
}

export function ThemeBuilder() {
  const uid = useId()
  const id = (n: string) => `${uid}-${n}`
  const [form, setForm] = useState<Form>(START)
  const [copied, setCopied] = useState("")
  const set = <K extends keyof Form>(key: K) => (v: Form[K]) => setForm((f) => ({ ...f, [key]: v }))
  const dark = useRef<boolean | null>(null)

  const tokens = useMemo(() => toTokens(form), [form])
  const built = useMemo(() => buildTheme(tokens), [tokens])
  const json = useMemo(() => JSON.stringify(tokens, null, 2), [tokens])

  // The built theme goes on the whole docs page, after the toolbar's brand, so the previews below and the page's own
  // swatches follow it. It leaves with the page.
  useEffect(() => {
    if (dark.current === null) dark.current = document.documentElement.classList.contains("dark")
    document.getElementById(STYLE_ID)?.remove()
    if (built.ok) {
      const style = document.createElement("style")
      style.id = STYLE_ID
      style.textContent = built.css
      document.head.appendChild(style)
      const ratio = contrastRatio(form.background, "#000000")
      document.documentElement.classList.toggle("dark", ratio !== null && ratio < 4)
    }
  }, [built, form.background])
  useEffect(
    () => () => {
      document.getElementById(STYLE_ID)?.remove()
      if (dark.current !== null) document.documentElement.classList.toggle("dark", dark.current)
    },
    []
  )
  useEffect(() => {
    loadFont(form.display)
    loadFont(form.body)
    loadFont(form.mono)
  }, [form.display, form.body, form.mono])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied("Copied the brand JSON.")
    } catch {
      setCopied("Copy is blocked here: select the text below and copy it.")
    }
  }, [json])
  const download = () => {
    const url = URL.createObjectURL(new Blob([`${json}\n`], { type: "application/json" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "tokens.json"
    a.click()
    URL.revokeObjectURL(url)
    setCopied("Downloaded tokens.json. Put it at brand/tokens.json and run feather-brand.")
  }

  const refs = Object.keys(THEMES)
  const v4 = form.schema === "feather-tokens/4"

  return (
    <div className="fd">
      <div className="fd-split">
        <form onSubmit={(e) => e.preventDefault()} aria-label="Brand settings">
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="fd-group">Start</legend>
            <div className="fd-form">
              <div>
                <label className="fd-label" htmlFor={id("name")}>Brand name</label>
                <input id={id("name")} className="fd-field" value={form.name} onChange={(e) => set("name")(e.target.value)} />
              </div>
              <Select id={id("schema")} label="Schema" value={form.schema} options={["feather-tokens/3", "feather-tokens/4"]} onChange={(v) => set("schema")(v as Form["schema"])} hint="/4 adds loudness and the colour-block roles" />
              <div>
                <label className="fd-label" htmlFor={id("from")}>Start from a reference brand</label>
                <select
                  id={id("from")}
                  className="fd-field"
                  defaultValue=""
                  onChange={(e) => {
                    const t = THEMES[e.target.value]
                    if (t) setForm(fromTokens(t.tokens as BrandTokens & Record<string, unknown>))
                  }}
                >
                  <option value="">(keep what is here)</option>
                  {refs.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="fd-group">Colours</legend>
            <div className="fd-form">
              <ColorField id={id("bg")} label="Background" value={form.background} onChange={set("background")} />
              <ColorField id={id("surface")} label="Surface" value={form.surface} onChange={set("surface")} />
              <ColorField id={id("text")} label="Text" value={form.text} onChange={set("text")} />
              <ColorField id={id("primary")} label="Primary" value={form.primary} onChange={set("primary")} />
              <ColorField id={id("accent")} label="Accent" value={form.accent} onChange={set("accent")} />
              <ColorField id={id("destructive")} label="Destructive" value={form.destructive} onChange={set("destructive")} optional />
            </div>
          </fieldset>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="fd-group">Type</legend>
            <div className="fd-form">
              <FontSelect id={id("display")} label="Display font" value={form.display} onChange={set("display")} />
              <FontSelect id={id("body")} label="Body font" value={form.body} onChange={set("body")} />
              <FontSelect id={id("mono")} label="Mono font" value={form.mono} onChange={set("mono")} optional />
              <Select id={id("hw")} label="Heading weight" value={form.headingWeight} options={["", ...HEADING_WEIGHTS]} onChange={set("headingWeight")} hint="(none): the role's own" />
            </div>
          </fieldset>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="fd-group">Shape and feel</legend>
            <div className="fd-form">
              <Select id={id("shape")} label="Shape" value={form.shape} options={Object.keys(RADIUS_TIERS)} onChange={set("shape")} />
              <Select id={id("density")} label="Density" value={form.density} options={Object.keys(DENSITY)} onChange={set("density")} />
              <Select id={id("elevation")} label="Elevation" value={form.elevation} options={Object.keys(ELEVATION)} onChange={set("elevation")} />
              <Select id={id("motion")} label="Product motion" value={form.motion} options={["calm", "snappy"]} onChange={set("motion")} />
            </div>
          </fieldset>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="fd-group">Expression (the website layer)</legend>
            <div className="fd-form">
              <Select id={id("pace")} label="Pace" value={form.pace} options={PACES} onChange={set("pace")} hint="must match product motion unless cinematic" />
              <Select id={id("sig")} label="Signature curve" value={form.signature} options={[...Object.keys(SIGNATURES), ...(form.signature === "custom" ? ["custom"] : [])]} onChange={set("signature")} />
              <Select id={id("contrast")} label="Contrast" value={form.contrast} options={Object.keys(CONTRASTS)} onChange={set("contrast")} />
              <Select id={id("surfk")} label="Surface" value={form.surfaceKind} options={SURFACES} onChange={set("surfaceKind")} />
              {form.surfaceKind === "glass" ? (
                <div>
                  <label className="fd-label" htmlFor={id("blur")}>Blur, px (8 to 30)</label>
                  <input id={id("blur")} className="fd-field" type="number" min={8} max={30} value={form.blur} onChange={(e) => set("blur")(e.target.value)} />
                </div>
              ) : null}
              {form.surfaceKind === "film" ? (
                <div>
                  <label className="fd-label" htmlFor={id("grain")}>Grain (0.02 to 0.08)</label>
                  <input id={id("grain")} className="fd-field" type="number" step="0.01" min={0.02} max={0.08} value={form.grain} onChange={(e) => set("grain")(e.target.value)} />
                </div>
              ) : null}
              <Select id={id("focus")} label="Focus ring" value={form.focus} options={FOCUS} onChange={set("focus")} />
            </div>
          </fieldset>

          {v4 ? (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="fd-group">Brand-level (/4)</legend>
              <div className="fd-form">
                <Select id={id("loud")} label="Loudness" value={form.loudness} options={[0, 1, 2, 3]} onChange={set("loudness")} hint="0 quiet, 1 composed, 2 expressive, 3 spectacle" />
                <Select
                  id={id("pers")}
                  label="Personality"
                  value={form.personality}
                  options={["", ...Object.keys(PERSONALITIES)]}
                  onChange={(v) => {
                    const preset = PERSONALITIES[v as keyof typeof PERSONALITIES]
                    // A personality sets pace and signature together; the form follows so the JSON stays short.
                    setForm((f) => ({ ...f, personality: v, ...(preset ? { pace: preset.pace, signature: preset.signature, motion: preset.pace === "snappy" ? "snappy" : "calm" } : {}) }))
                  }}
                  hint="sets pace and signature together"
                />
                <ColorField id={id("scrim")} label="Media scrim colour" value={form.mediaScrim} onChange={set("mediaScrim")} optional />
              </div>
              <p className="fd-label" style={{ margin: "4px 0 0" }}>Colour blocks, in order (the engine picks each ink)</p>
              <div className="fd-form">
                {form.blocks.map((b, i) => (
                  <ColorField key={i} id={id(`block${i}`)} label={`Block ${i + 1} surface`} value={b} onChange={(v) => setForm((f) => ({ ...f, blocks: f.blocks.map((x, j) => (j === i ? v : x)) }))} optional />
                ))}
              </div>
            </fieldset>
          ) : null}
        </form>

        <div>
          <div role="status" aria-live="polite">
            {built.ok ? (
              <p className="fd-ok">The engine accepts this brand. {Object.entries(built.summary).map(([k, v]) => `${k}: ${v}`).join(", ")}.</p>
            ) : (
              <div className="fd-problems">
                <strong>The engine refuses this brand ({built.problems.length}):</strong>
                <ul style={{ margin: "6px 0 0", padding: "0 0 0 16px" }}>
                  {built.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="fd-row" style={{ margin: "8px 0" }}>
            <button type="button" className="fd-btn" onClick={copy}>Copy brand JSON</button>
            <button type="button" className="fd-btn" onClick={download}>Download tokens.json</button>
          </div>
          <p role="status" style={{ fontSize: 13, minHeight: 20, margin: "0 0 6px" }}>{copied}</p>
          <label className="fd-label" htmlFor={id("json")}>Brand JSON ({built.ok ? "valid" : "not valid yet"})</label>
          <textarea id={id("json")} className="fd-pre" readOnly value={json} rows={12} style={{ width: "100%", fontFamily: "ui-monospace, monospace" }} />
        </div>
      </div>

      <h3 style={{ margin: "28px 0 8px" }}>Preview</h3>
      <p style={{ fontSize: 13, opacity: 0.8 }}>
        Real components and a page block, in the brand above. While this page is open the whole page wears it, so the swatches on other Foundations pages return to the toolbar&apos;s brand when you leave.
      </p>
      {built.ok ? <Preview v4={v4} /> : <p>Fix the problems above to see the preview.</p>}
    </div>
  )
}

function Preview({ v4 }: { v4: boolean }): ReactNode {
  return (
    <div className="bg-background text-foreground" style={{ border: "1px solid var(--border-secondary)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: 24, display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <Card>
          <CardHeader>
            <CardTitle>Plan your launch</CardTitle>
            <CardDescription>Cards, buttons and fields take the brand&apos;s shape, density and colour.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="tb-email">Email</FieldLabel>
              <Input id="tb-email" placeholder="you@example.com" />
              <FieldDescription>We only use it for receipts.</FieldDescription>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button>Continue</Button>
              <Button variant="outline">Back</Button>
              <Button variant="secondary">Save</Button>
              <Button variant="destructive">Delete</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>New</Badge>
              <Badge variant="secondary">Draft</Badge>
              <Badge variant="outline">Beta</Badge>
              <Switch aria-label="Notifications" defaultChecked />
            </div>
            <Progress value={62} aria-label="Progress" />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Tabs defaultValue="a">
            <TabsList>
              <TabsTrigger value="a">Overview</TabsTrigger>
              <TabsTrigger value="b">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="a" className="type-body-sm text-fg-secondary">A summary of everything in the workspace.</TabsContent>
            <TabsContent value="b" className="type-body-sm text-fg-secondary">Recent changes by you and your team.</TabsContent>
          </Tabs>
          <Alert>
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>Alerts use the surface, the lines and the text roles.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Payment failed</AlertTitle>
            <AlertDescription>The destructive colour reads at 4.5:1 or the engine refuses the brand.</AlertDescription>
          </Alert>
        </div>
      </div>
      {v4 ? (
        <div style={{ borderTop: "1px solid var(--border-secondary)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ background: `var(--block-${n})`, color: `var(--block-${n}-ink)`, padding: 20, fontSize: 13 }}>
              <strong>block-{n}</strong>
              <div style={{ opacity: 0.85 }}>A coloured section and the ink that reads on it.</div>
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ borderTop: "1px solid var(--border-secondary)" }}>
        <defaultBlocks.hero block={BLOCKS.hero} />
      </div>
      <div style={{ borderTop: "1px solid var(--border-secondary)" }}>
        <defaultBlocks.numbers block={BLOCKS.numbers} />
      </div>
    </div>
  )
}
