// "By person": shape a context from one reference persona and/or one reference capability profile, on a phone or a
// desktop, and see the plan it composes. The choice lives in component state only: nothing is stored, logged or put
// in the URL (Feather keeps nothing about people).
import * as React from "react"
import type { RenderContext } from "@aleeforoughi/feather-context"
import type { Experience, ReplyEvent } from "@aleeforoughi/feather-intent"
import { compose, REFERENCE_CAPABILITIES, REFERENCE_PERSONAS, type LayoutPlan } from "@aleeforoughi/feather-liquid"
import { Checkbox, Label } from "@aleeforoughi/feather-react"
import { Body } from "./bodies"
import { Choice } from "./controls"
import { Trace } from "./trace"

/** The rules a persona or capability profile reaches. */
export const PERSON_RULES = ["autonomy", "reading", "density-and-targets", "output-routing", "contrast"]

const NONE = "none"
const personaKeys = Object.keys(REFERENCE_PERSONAS) as (keyof typeof REFERENCE_PERSONAS)[]
const capabilityKeys = Object.keys(REFERENCE_CAPABILITIES) as (keyof typeof REFERENCE_CAPABILITIES)[]

export function PersonView({ experience, onReply }: { experience: Experience; onReply: (reply: ReplyEvent, body: string) => void }) {
  const [persona, setPersona] = React.useState(NONE)
  const [capability, setCapability] = React.useState(NONE)
  const [surface, setSurface] = React.useState("phone")
  const [only, setOnly] = React.useState(true)
  const onlyId = React.useId()

  const p = persona === NONE ? undefined : REFERENCE_PERSONAS[persona as keyof typeof REFERENCE_PERSONAS]
  const c = capability === NONE ? undefined : REFERENCE_CAPABILITIES[capability as keyof typeof REFERENCE_CAPABILITIES]
  const plan = React.useMemo((): LayoutPlan | null => {
    const context: RenderContext = {
      device: { surface: surface as "phone" | "desktop", width: surface === "phone" ? 390 : 1280 },
      ...(p ? { persona: p.persona } : {}),
      ...(c ? { capability: c.capability } : {}),
    }
    const result = compose(experience, context)
    return result.ok ? result.plan : null
  }, [experience, surface, p, c])

  return (
    <div data-testid="person-view" className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Choice label="Persona" value={persona} items={[{ value: NONE, label: "None" }, ...personaKeys.map((k) => ({ value: k, label: REFERENCE_PERSONAS[k].title }))]} onChange={(v) => setPersona(v || NONE)} />
        <Choice label="Capability profile" value={capability} items={[{ value: NONE, label: "None" }, ...capabilityKeys.map((k) => ({ value: k, label: REFERENCE_CAPABILITIES[k].title }))]} onChange={(v) => setCapability(v || NONE)} />
        <Choice label="Device" value={surface} items={[{ value: "phone", label: "Phone" }, { value: "desktop", label: "Desktop" }]} onChange={(v) => setSurface(v || "phone")} />
      </div>
      <div data-testid="person-changes" role="status" className="flex flex-col gap-1 rounded-card border border-line-secondary inset-content type-body-sm">
        {p || c ? (
          <>
            {p && <p><span className="font-medium">{p.title}:</span> {p.changes}</p>}
            {c && <p><span className="font-medium">{c.title}:</span> {c.changes}</p>}
          </>
        ) : (
          <p className="text-fg-secondary">No persona or capability chosen: the plan follows the device alone.</p>
        )}
      </div>
      {plan ? (
        <>
          <p data-testid="person-body" className="type-body-sm text-fg-secondary">Body: <span className="font-medium text-fg-primary">{plan.manifestation}</span></p>
          <Body key={plan.manifestation} plan={plan} experience={experience} onReply={onReply} />
          <div className="flex items-center gap-2">
            <Checkbox id={onlyId} checked={only} onCheckedChange={(v) => setOnly(v === true)} />
            <Label htmlFor={onlyId}>Show only the rules a person shapes ({PERSON_RULES.join(", ")})</Label>
          </div>
          <Trace plan={plan} highlight={PERSON_RULES} only={only} />
        </>
      ) : (
        <p className="type-body-sm text-fg-secondary">Nothing to render for this context.</p>
      )}
    </div>
  )
}
