// The content nodes. Feather has an organism for each decision; the content nodes (text, price, input and so on) are
// built here from Feather's atoms, so a product that renders a plan gets one voice from both. Every visible part has a
// data-slot, every state a data-variant, and nothing names a color: only semantic tokens, through the atoms.
import * as React from "react"
import type {
  ActionNode,
  AutopickNode,
  ChoiceNode,
  ComparisonNode,
  ConfirmationNode,
  DateNode,
  InputNode,
  IRNode,
  LocationNode,
  MediaNode,
  PersonNode,
  PredictedChoiceNode,
  PreferenceNode,
  PriceNode,
  ProgressNode,
  StatusNode,
  TextNode,
  WarningNode,
} from "@aleeforoughi/feather-intent"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  RoleChip,
  StepItem,
  StepList,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  WhyDisclosure,
  confidenceText,
  requesterTag,
  useThemeMotion,
  type Expandable,
} from "@aleeforoughi/feather-react"
import type { PlanNode } from "@aleeforoughi/feather-liquid"
import { formatDate, formatMoney, periodText, plainProblem, safeUrl, upperFirst } from "./format"
import { useRendering, type EmitResult } from "./rendering"

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ")

/** The words an act's outcome is announced with; it takes focus, so the person lands on what happened. */
function Outcome({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <p ref={ref} tabIndex={-1} role="status" data-slot="experience-outcome" className="rounded-md text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {children}
    </p>
  )
}

/** A problem with what the person gave, shown beside the field and announced politely. */
function Problem({ id, children }: { id: string; children?: string }) {
  return (
    <p id={id} role="status" data-slot="experience-problem" className={children ? "text-sm font-medium text-foreground" : "sr-only"}>
      {children ? `That did not work: ${children}` : ""}
    </p>
  )
}

/** "Why?" for a node that has detail and no organism of its own to show it. Starts open as the plan says. */
export function Detail({ expandable, expanded, importance }: { expandable: Expandable; expanded: boolean | undefined; importance: IRNode["importance"] }) {
  const [open, setOpen] = React.useState(expanded ?? false)
  return <WhyDisclosure expandable={expandable} open={open} onOpenChange={setOpen} forceOpen={importance === "critical"} />
}

export function TextAtom({ ir }: { ir: TextNode }) {
  return (
    <p data-slot="experience-text" className="text-sm leading-relaxed break-words whitespace-pre-line text-foreground">
      {ir.text}
    </p>
  )
}

export function ActionAtom({ ir, emphasis }: { ir: ActionNode; emphasis: string }) {
  const { emit } = useRendering()
  return (
    <Button
      type="button"
      data-slot="experience-action"
      variant={emphasis === "primary" || emphasis === "critical" ? "default" : "outline"}
      onClick={() => emit(ir.id, "activate")}
      className="h-auto min-h-8 max-w-full py-1 whitespace-normal"
    >
      {upperFirst(ir.label ?? ir.intent)}
    </Button>
  )
}

export function PriceAtom({ ir }: { ir: PriceNode }) {
  const { plan } = useRendering()
  const period = periodText(ir.period)
  return (
    <p data-slot="experience-price" data-variant={ir.period ?? "once"} className="flex flex-wrap items-baseline gap-x-2 text-sm">
      {ir.label && <span className="text-muted-foreground">{ir.label}</span>}
      <span className="text-base font-semibold text-foreground">{formatMoney(ir.amount, ir.currency, plan.locale)}</span>
      {period && <span className="text-muted-foreground">{period}</span>}
    </p>
  )
}

export function PersonAtom({ ir }: { ir: PersonNode }) {
  return (
    <p data-slot="experience-person" data-variant={ir.kind ?? "human"} className="flex flex-wrap items-center gap-1.5 text-sm">
      <RoleChip title={ir.name} tag={requesterTag({ role: ir.role, kind: ir.kind === "agent" ? "agent" : undefined })} />
    </p>
  )
}

export function DateAtom({ ir }: { ir: DateNode }) {
  const { plan } = useRendering()
  return (
    <p data-slot="experience-date" data-variant={ir.until ? "range" : "single"} className="flex flex-wrap items-baseline gap-x-2 text-sm">
      {ir.label && <span className="text-muted-foreground">{ir.label}</span>}
      <span className="font-medium text-foreground">
        <time dateTime={ir.value}>{formatDate(ir.value, plan.locale)}</time>
        {ir.until && (
          <>
            {" "}
            <span className="font-normal text-muted-foreground">to</span> <time dateTime={ir.until}>{formatDate(ir.until, plan.locale)}</time>
          </>
        )}
      </span>
    </p>
  )
}

export function LocationAtom({ ir }: { ir: LocationNode }) {
  return (
    <div data-slot="experience-location" className="space-y-0.5 text-sm">
      <p className="font-medium text-foreground">
        <span className="sr-only">Location: </span>
        {ir.name}
      </p>
      {ir.address && <p className="text-muted-foreground">{ir.address}</p>}
      {ir.coordinates && (
        <p className="text-muted-foreground">
          <bdi>
            {ir.coordinates.lat}, {ir.coordinates.lng}
          </bdi>
        </p>
      )}
    </div>
  )
}

const STATE_WORD: Record<StatusNode["state"], string> = { idle: "Idle", working: "Working", waiting: "Waiting", done: "Done", failed: "Failed", blocked: "Blocked" }

export function StatusAtom({ ir }: { ir: StatusNode }) {
  const attention = ir.state === "failed" || ir.state === "blocked"
  return (
    <p role="status" data-slot="experience-status" data-variant={ir.state} className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant={attention ? "outline" : "secondary"} className={cx(attention && "border-destructive")}>
        {STATE_WORD[ir.state]}
      </Badge>
      <span className="min-w-0 break-words text-foreground">{ir.label}</span>
    </p>
  )
}

export function ProgressAtom({ ir }: { ir: ProgressNode }) {
  const m = useThemeMotion()
  const id = React.useId()
  const percent = ir.value === undefined ? undefined : Math.round(Math.min(1, Math.max(0, ir.value)) * 100)
  const bar = percent !== undefined || ir.steps === undefined
  return (
    <div data-slot="experience-progress" data-variant={percent === undefined ? "indeterminate" : "determinate"} className="space-y-2 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span id={`${id}-label`} className="font-medium text-foreground">{ir.label}</span>
        {percent !== undefined && <span data-slot="experience-progress-value" className="text-muted-foreground">{percent}%</span>}
      </div>
      {bar && (
        <div
          role="progressbar"
          data-slot="experience-progress-bar"
          aria-labelledby={`${id}-label`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={percent === undefined ? "In progress" : `${percent}%`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            data-slot="experience-progress-fill"
            className={cx("h-full rounded-full bg-primary", percent === undefined && "w-1/3", percent === undefined && !m.reduced && "animate-pulse")}
            style={percent === undefined ? undefined : { width: `${percent}%` }}
          />
        </div>
      )}
      {ir.steps && (
        <StepList aria-labelledby={`${id}-label`}>
          {ir.steps.map((step, i) => (
            <StepItem key={step.id} index={i + 1} status={step.state} title={step.label} />
          ))}
        </StepList>
      )}
    </div>
  )
}

/** The text equivalent of a medium, behind a disclosure so it never crowds the media. */
function Transcript({ text }: { text: string }) {
  return (
    <details data-slot="experience-media-transcript" className="text-sm">
      <summary className="min-h-6 cursor-pointer rounded-md font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">Transcript</summary>
      <p className="mt-1 text-muted-foreground">{text}</p>
    </details>
  )
}

export function MediaAtom({ ir, textEquivalent = false }: { ir: MediaNode; textEquivalent?: boolean }) {
  const src = safeUrl(ir.src)
  const words = ir.caption ?? ir.alt
  // With no audio to hear, the text equivalent stands in place of the audio or video.
  if (textEquivalent) {
    return (
      <figure data-slot="experience-media" data-variant={`${ir.kind}.text`} className="space-y-1 text-sm">
        <p className="font-medium text-foreground">{upperFirst(ir.kind)}: {words ?? "no description"}</p>
        {ir.transcript && <p data-slot="experience-media-text" className="text-muted-foreground">{ir.transcript}</p>}
      </figure>
    )
  }
  return (
    <figure data-slot="experience-media" data-variant={ir.kind} className="space-y-2 text-sm">
      {ir.kind === "image" &&
        (src ? <img src={src} alt={ir.alt ?? ""} loading="lazy" className="max-w-full rounded-lg" /> : <p className="text-muted-foreground">Image: {ir.alt}</p>)}
      {ir.kind === "video" &&
        (src ? (
          <video src={src} controls preload="metadata" aria-label={ir.alt} className="w-full rounded-lg">
            {ir.captions && safeUrl(ir.captions) && <track kind="captions" src={safeUrl(ir.captions)} label="Captions" />}
          </video>
        ) : (
          <p className="text-muted-foreground">Video: {ir.alt}</p>
        ))}
      {ir.kind === "audio" && (src ? <audio src={src} controls preload="metadata" aria-label={words ?? "Audio"} className="w-full" /> : <p className="text-muted-foreground">Audio</p>)}
      {ir.kind === "document" &&
        (src ? (
          <a href={src} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-6 items-center rounded-md font-medium underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {words ?? "Open the document"}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <p className="text-muted-foreground">Document: {words}</p>
        ))}
      {ir.caption && ir.kind !== "document" && <figcaption className="text-muted-foreground">{ir.caption}</figcaption>}
      {ir.transcript && <Transcript text={ir.transcript} />}
    </figure>
  )
}

export function ConfirmationAtom({ ir }: { ir: ConfirmationNode }) {
  return (
    <div role="status" data-slot="experience-confirmation" className="flex items-start gap-2 rounded-lg bg-muted p-2.5 text-sm text-foreground">
      <span aria-hidden>✓</span>
      <span className="min-w-0 break-words">
        <span className="sr-only">Done: </span>
        {ir.text}
      </span>
    </div>
  )
}

export function WarningAtom({ ir }: { ir: WarningNode }) {
  const { emit } = useRendering()
  const danger = ir.severity === "danger"
  const [acknowledged, setAcknowledged] = React.useState(false)
  return (
    <Alert data-slot="experience-warning" data-variant={danger ? "danger" : "caution"} className={cx("border-2", danger ? "border-destructive" : "border-warning")}>
      <AlertTitle>{danger ? "Danger" : "Warning"}</AlertTitle>
      <AlertDescription className="space-y-2 text-foreground">
        <p className="break-words">{ir.text}</p>
        {ir.acknowledge &&
          (acknowledged ? (
            <Outcome>Acknowledged.</Outcome>
          ) : (
            <Button
              type="button"
              data-slot="experience-acknowledge"
              variant="outline"
              onClick={() => {
                if (emit(ir.id, "acknowledge").ok) setAcknowledged(true)
              }}
            >
              Acknowledge
            </Button>
          ))}
      </AlertDescription>
    </Alert>
  )
}

/** Choose one of several, or several: pick, then one deliberate button sends the choice. */
export function ChoiceAtom({ ir, preselected }: { ir: ChoiceNode; preselected: string | undefined }) {
  const { emit } = useRendering()
  const id = React.useId()
  const [single, setSingle] = React.useState<string | undefined>(preselected)
  const [many, setMany] = React.useState<string[]>(ir.selected ?? [])
  const [sent, setSent] = React.useState<string>()
  const [problem, setProblem] = React.useState<string>()
  const multiple = ir.multiple === true
  const label = (optionId: string) => ir.options.find((o) => o.id === optionId)?.label ?? optionId
  const ready = multiple ? many.length > 0 : single !== undefined
  const send = () => {
    const value = multiple ? ir.options.map((o) => o.id).filter((o) => many.includes(o)) : single
    if (value === undefined) return
    const result = emit(ir.id, "choose", value)
    setProblem(result.ok ? undefined : plainProblem(result.message))
    setSent(result.ok ? (Array.isArray(value) ? value.map(label).join(", ") : label(value)) : undefined)
  }
  const promptId = `${id}-prompt`
  const rows = ir.options.map((option) => {
    const optionId = `${id}-${option.id}`
    const descriptionId = `${optionId}-description`
    return (
      <div key={option.id} data-slot="experience-choice-option" data-state={(multiple ? many.includes(option.id) : single === option.id) ? "selected" : "unselected"} className="flex items-start gap-2 rounded-lg p-2 ring-1 ring-foreground/10 data-[state=selected]:ring-2 data-[state=selected]:ring-primary">
        {multiple ? (
          <Checkbox
            id={optionId}
            checked={many.includes(option.id)}
            aria-describedby={option.description ? descriptionId : undefined}
            onCheckedChange={(checked) => setMany((current) => (checked ? [...current, option.id] : current.filter((o) => o !== option.id)))}
            className="mt-0.5"
          />
        ) : (
          <RadioGroupItem value={option.id} id={optionId} aria-describedby={option.description ? descriptionId : undefined} className="mt-0.5" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor={optionId} className="leading-snug break-words">{option.label}</Label>
          {option.description && <p id={descriptionId} className="text-sm break-words text-muted-foreground">{option.description}</p>}
        </div>
      </div>
    )
  })
  return (
    <div data-slot="experience-choice" data-variant={sent ? "chosen" : multiple ? "multiple" : "single"} className="flex flex-col gap-3 text-sm">
      <p id={promptId} data-slot="experience-choice-prompt" className="font-medium text-foreground">{ir.prompt}</p>
      {multiple ? (
        <div role="group" aria-labelledby={promptId} className="grid gap-2">{rows}</div>
      ) : (
        <RadioGroup aria-labelledby={promptId} defaultValue={preselected} onValueChange={(value) => setSingle(String(value))}>{rows}</RadioGroup>
      )}
      <div>
        <Button type="button" data-slot="experience-choice-submit" disabled={!ready} onClick={send} className="h-auto min-h-8 max-w-full py-1 whitespace-normal">
          {multiple ? (many.length > 0 ? `Choose ${many.length} selected` : "Choose") : single ? `Choose ${label(single)}` : "Choose"}
        </Button>
      </div>
      <Problem id={`${id}-problem`}>{problem}</Problem>
      <p role="status" data-slot="experience-choice-status" className="sr-only">{sent ? `Chosen: ${sent}` : ""}</p>
    </div>
  )
}

const INPUT_TYPE: Record<InputNode["kind"], string> = { text: "text", "long-text": "text", number: "number", email: "email", phone: "tel", url: "url", date: "date", money: "number" }
const AUTOCOMPLETE: Partial<Record<InputNode["kind"], string>> = { email: "email", phone: "tel", url: "url" }

/** A fact asked of the person. The validator decides whether it is acceptable; its words show beside the field. */
export function InputAtom({ ir }: { ir: InputNode }) {
  const { emit } = useRendering()
  const id = React.useId()
  const [raw, setRaw] = React.useState(ir.value === undefined ? "" : String(ir.value))
  const [problem, setProblem] = React.useState<string>()
  const [sent, setSent] = React.useState<"submitted" | "skipped">()
  const numeric = ir.kind === "number" || ir.kind === "money"
  const text = raw.trim()
  const report = (result: EmitResult, done: "submitted" | "skipped") => {
    setProblem(result.ok ? undefined : plainProblem(result.message))
    setSent(result.ok ? done : undefined)
  }
  const submit = () => {
    if (text === "") return
    const value = numeric ? Number(text) : text
    if (typeof value === "number" && !Number.isFinite(value)) return setProblem("Enter a number.")
    report(emit(ir.id, "submit", value), "submitted")
  }
  const fieldId = `${id}-field`
  const hintId = `${id}-hint`
  const problemId = `${id}-problem`
  const hint = [ir.kind === "money" && ir.currency ? `Amount in ${ir.currency}.` : undefined, ir.required ? undefined : "Optional.", ir.min !== undefined || ir.max !== undefined ? `Between ${ir.min ?? "any"} and ${ir.max ?? "any"}.` : undefined].filter(Boolean).join(" ")
  const common = {
    id: fieldId,
    "data-slot": "experience-input-field",
    value: raw,
    required: ir.required === true,
    "aria-required": ir.required === true || undefined,
    "aria-invalid": problem ? true : undefined,
    "aria-describedby": [hint ? hintId : "", problem ? problemId : ""].filter(Boolean).join(" ") || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setRaw(e.target.value)
      setSent(undefined)
    },
  }
  return (
    <form
      data-slot="experience-input"
      data-variant={sent ?? (text === "" ? "blank" : "ready")}
      data-kind={ir.kind}
      noValidate
      className="flex flex-col gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Label htmlFor={fieldId} className="leading-snug">{ir.prompt}</Label>
      {ir.kind === "long-text" ? (
        <Textarea {...common} />
      ) : (
        <Input
          {...common}
          type={INPUT_TYPE[ir.kind]}
          inputMode={numeric ? "decimal" : undefined}
          min={numeric ? ir.min : undefined}
          max={numeric ? ir.max : undefined}
          step={numeric ? "any" : undefined}
          autoComplete={AUTOCOMPLETE[ir.kind] ?? "off"}
        />
      )}
      {hint && <p id={hintId} data-slot="experience-input-hint" className="text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" data-slot="experience-input-submit" disabled={text === ""}>Send answer</Button>
        {ir.required !== true && (
          <Button
            type="button"
            data-slot="experience-input-skip"
            variant="outline"
            onClick={() => report(emit(ir.id, "skip"), "skipped")}
          >
            Skip
          </Button>
        )}
      </div>
      <Problem id={problemId}>{problem}</Problem>
      <p role="status" data-slot="experience-input-status" className="sr-only">{sent === "submitted" ? "Answer sent." : sent === "skipped" ? "Skipped." : ""}</p>
    </form>
  )
}

/** A setting the person may change: a switch for on and off, choices for a fixed set, a field for anything else. */
export function PreferenceAtom({ ir }: { ir: PreferenceNode }) {
  const onOff = typeof ir.value === "boolean" && (ir.options === undefined || ir.options.every((o) => typeof o === "boolean"))
  if (onOff) return <SwitchPreference ir={ir} />
  if (ir.options) return <OptionsPreference ir={ir} options={ir.options} />
  return <FieldPreference ir={ir} />
}

function SwitchPreference({ ir }: { ir: PreferenceNode }) {
  const { emit } = useRendering()
  const id = React.useId()
  const [on, setOn] = React.useState(ir.value === true)
  const [problem, setProblem] = React.useState<string>()
  return (
    <div data-slot="experience-preference" data-variant="switch" className="flex flex-col gap-1 text-sm">
      <label className="flex items-center justify-between gap-3 font-medium text-foreground">
        <span id={`${id}-label`} className="min-w-0 break-words">{ir.label}</span>
        <Switch
          checked={on}
          aria-labelledby={`${id}-label`}
          onCheckedChange={(checked) => {
            const result = emit(ir.id, "set", checked)
            if (result.ok) setOn(checked)
            setProblem(result.ok ? undefined : plainProblem(result.message))
          }}
        />
      </label>
      <Problem id={`${id}-problem`}>{problem}</Problem>
      <p role="status" data-slot="experience-preference-status" className="sr-only">{on ? "On" : "Off"}</p>
    </div>
  )
}

function OptionsPreference({ ir, options }: { ir: PreferenceNode; options: Array<string | number | boolean> }) {
  const { emit } = useRendering()
  const id = React.useId()
  const startAt = Math.max(0, options.indexOf(ir.value))
  const [picked, setPicked] = React.useState(startAt)
  const [set, setSet] = React.useState<number>(startAt)
  const [problem, setProblem] = React.useState<string>()
  const wording = (o: string | number | boolean) => (typeof o === "boolean" ? (o ? "On" : "Off") : String(o))
  return (
    <div data-slot="experience-preference" data-variant="options" className="flex flex-col gap-3 text-sm">
      <p id={`${id}-label`} className="font-medium text-foreground">{ir.label}</p>
      <RadioGroup aria-labelledby={`${id}-label`} defaultValue={String(startAt)} onValueChange={(value) => setPicked(Number(value))}>
        {options.map((option, i) => (
          <div key={i} data-slot="experience-preference-option" data-state={picked === i ? "selected" : "unselected"} className="flex items-center gap-2 rounded-lg p-2 ring-1 ring-foreground/10 data-[state=selected]:ring-2 data-[state=selected]:ring-primary">
            <RadioGroupItem value={String(i)} id={`${id}-${i}`} />
            <Label htmlFor={`${id}-${i}`} className="leading-snug break-words">{wording(option)}</Label>
          </div>
        ))}
      </RadioGroup>
      <div>
        <Button
          type="button"
          data-slot="experience-preference-submit"
          disabled={picked === set}
          onClick={() => {
            const result = emit(ir.id, "set", options[picked]!)
            if (result.ok) setSet(picked)
            setProblem(result.ok ? undefined : plainProblem(result.message))
          }}
        >
          {`Set to ${wording(options[picked]!)}`}
        </Button>
      </div>
      <Problem id={`${id}-problem`}>{problem}</Problem>
      <p role="status" data-slot="experience-preference-status" className="sr-only">{`${ir.label}: ${wording(options[set]!)}`}</p>
    </div>
  )
}

function FieldPreference({ ir }: { ir: PreferenceNode }) {
  const { emit } = useRendering()
  const id = React.useId()
  const numeric = typeof ir.value === "number"
  const [raw, setRaw] = React.useState(String(ir.value))
  const [problem, setProblem] = React.useState<string>()
  const [saved, setSaved] = React.useState(false)
  const text = raw.trim()
  return (
    <form
      data-slot="experience-preference"
      data-variant="field"
      noValidate
      className="flex flex-col gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        if (text === "") return
        const value = numeric ? Number(text) : text
        const result = emit(ir.id, "set", value)
        setProblem(result.ok ? undefined : plainProblem(result.message))
        setSaved(result.ok)
      }}
    >
      <Label htmlFor={`${id}-field`}>{ir.label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={`${id}-field`}
          data-slot="experience-preference-field"
          type={numeric ? "number" : "text"}
          step={numeric ? "any" : undefined}
          value={raw}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${id}-problem` : undefined}
          onChange={(e) => {
            setRaw(e.target.value)
            setSaved(false)
          }}
          className="min-w-40 flex-1"
        />
        <Button type="submit" data-slot="experience-preference-submit" disabled={text === ""}>Set</Button>
      </div>
      <Problem id={`${id}-problem`}>{problem}</Problem>
      <p role="status" data-slot="experience-preference-status" className="sr-only">{saved ? `${ir.label} set.` : ""}</p>
    </form>
  )
}

/** The words that name a compared node. */
function nameOf(node: IRNode | undefined, id: string, locale: string): string {
  if (!node) return id
  switch (node.type) {
    case "Alternative":
    case "Action":
      return node.label ?? node.intent
    case "Recommendation":
      return node.intent
    case "Price":
      return node.label ?? formatMoney(node.amount, node.currency, locale)
    case "Person":
    case "Location":
      return node.name
    case "Media":
      return node.alt ?? node.caption ?? node.src
    default:
      return id
  }
}

export function ComparisonAtom({ ir }: { ir: ComparisonNode }) {
  const { nodes, plan } = useRendering()
  const names = ir.items.map((item) => nameOf(nodes.get(item), item, plan.locale))
  const show = (value: string | number | boolean) => (typeof value === "boolean" ? (value ? "Yes" : "No") : String(value))
  return (
    <div data-slot="experience-comparison" className="text-sm">
      <Table>
        <TableCaption className="sr-only">{`Comparison of ${names.join(", ")}`}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="text-start"><span className="sr-only">Criterion</span></TableHead>
            {names.map((name, i) => (
              <TableHead key={ir.items[i]} scope="col" className="text-start whitespace-normal">{name}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ir.criteria.map((criterion) => (
            <TableRow key={criterion.label}>
              <TableHead scope="row" className="text-start whitespace-normal">{criterion.label}</TableHead>
              {ir.items.map((item) => (
                <TableCell key={item} className="whitespace-normal">{criterion.values[item] === undefined ? "" : show(criterion.values[item])}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** What the caller expects the person to pick, shown beside a choice that must not be preselected. It takes no acts. */
export function PredictionNoteAtom({ ir, node }: { ir: PredictedChoiceNode; node: PlanNode }) {
  const { nodes } = useRendering()
  const choice = nodes.get(ir.of)
  const option = choice?.type === "Choice" ? choice.options.find((o) => o.id === ir.option)?.label ?? ir.option : ir.option
  return (
    <p data-slot="experience-prediction-note" data-variant={node.emphasis} className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">Likely: {option}.</span>
      {ir.summary ? ` ${ir.summary}` : ""}
      {ir.confidence !== undefined ? ` ${confidenceText(ir.confidence)}.` : ""}
    </p>
  )
}

/** A decision already made for the person: keep it or undo it, once. */
export function AutopickAtom({ ir }: { ir: AutopickNode }) {
  const { emit } = useRendering()
  const id = React.useId()
  const [outcome, setOutcome] = React.useState<"kept" | "undone">()
  const [problem, setProblem] = React.useState<string>()
  const act = (what: "keep" | "undo") => {
    const result = emit(ir.id, what)
    setProblem(result.ok ? undefined : plainProblem(result.message))
    if (result.ok) setOutcome(what === "keep" ? "kept" : "undone")
  }
  return (
    <div data-slot="experience-autopick" data-variant={outcome ?? "pending"} data-intent={ir.intent} className="flex flex-col gap-2 text-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Decided for you</p>
      <p className="font-medium break-words text-foreground">{ir.summary}</p>
      {ir.undoWithin !== undefined && !outcome && <p data-slot="experience-autopick-window" className="text-muted-foreground">You can undo this for {ir.undoWithin} {ir.undoWithin === 1 ? "second" : "seconds"}.</p>}
      {outcome ? (
        <Outcome>{outcome === "kept" ? "Kept." : "Undone."}</Outcome>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" data-slot="experience-autopick-keep" aria-label={`Keep: ${ir.summary}`} onClick={() => act("keep")}>Keep this</Button>
          <Button type="button" data-slot="experience-autopick-undo" variant="outline" aria-label={`Undo: ${ir.summary}`} onClick={() => act("undo")}>Undo</Button>
        </div>
      )}
      <Problem id={`${id}-problem`}>{problem}</Problem>
    </div>
  )
}
