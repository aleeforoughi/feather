import * as React from "react"
import { Section } from "@aleeforoughi/feather-expression"
import { dateWords } from "../core/flows"
import { Choice, CHOICE_PILL, FIELD, FIELD_HELP, FIELD_LABEL, MARK, useFocusOnChange } from "./controls"
import { KnobBody, KnobTitle, useKnobs } from "./knobs"
import { BUTTON_PRIMARY, BUTTON_QUIET, join, useRegion, type BlockProps } from "./shared"

const STEPS = ["service", "time", "details", "review"] as const
type Step = (typeof STEPS)[number]
const STEP_TITLE: Record<Step, string> = { service: "Choose a service", time: "Choose a date and time", details: "Your details", review: "Check and confirm" }

const hostOf = (href: string) => {
  try {
    return new URL(href).host
  } catch {
    return href
  }
}

/**
 * A booking flow (feather.page/1, wave 5): service, then date and time, then details, then a review where every
 * choice can be changed before anything is sent. The slots are the page's (a page has no calendar behind it); each is
 * a native radio, and the days are listed, never a grid. It sends to one place: the page's `action` (a real form
 * post), an email through `mailto` (opened in the person's own mail app, sent only when they send it), or a hand-over
 * to someone else's booking page (`link`). With no script it is one honest form, every part showing.
 */
export function BookingBlock({ block }: BlockProps<"booking">) {
  const { id, titleId, labelled } = useRegion(block, "Book a time")
  const knobs = useKnobs<"steps">("booking", block, { space: "l" })
  const base = id ?? titleId.replace(/-title$/, "")
  const [step, setStep] = React.useState<Step>("service")
  const [service, setService] = React.useState(block.services.length === 1 ? block.services[0].id : "")
  const [slot, setSlot] = React.useState("")
  const [details, setDetails] = React.useState({ name: "", email: "", phone: "", note: "" })
  const [nudge, setNudge] = React.useState("")
  const focus = useFocusOnChange(step)
  const form = React.useRef<HTMLFormElement>(null)
  const index = STEPS.indexOf(step)
  const chosen = block.services.find((s) => s.id === service)
  const [date, time] = slot.split("T")
  const day = block.days.find((d) => d.date === date)
  const when = slot ? `${day?.label ?? dateWords(date)}, ${time}` : ""

  const go = (to: Step) => {
    setNudge("")
    setStep(to)
  }
  const next = () => {
    if (step === "service" && !service) return setNudge("Choose a service to go on.")
    if (step === "time" && !slot) return setNudge("Choose a time to go on.")
    if (step === "details") {
      const fields = [...(form.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-step="details"] input, [data-step="details"] textarea') ?? [])]
      const bad = fields.find((f) => !f.checkValidity())
      if (bad) {
        bad.reportValidity()
        bad.focus()
        return
      }
    }
    go(STEPS[Math.min(STEPS.length - 1, index + 1)])
  }
  const summary = [`Service: ${chosen?.name ?? ""}`, `Time: ${when}${block.zone ? ` (${block.zone})` : ""}`, `Name: ${details.name}`, `Email: ${details.email}`, ...(block.ask?.phone && details.phone ? [`Phone: ${details.phone}`] : []), ...(block.ask?.note && details.note ? [`Note: ${details.note}`] : [])].join("\n")
  const mailto = block.mailto ? `mailto:${block.mailto}?${new URLSearchParams({ subject: `Booking request: ${chosen?.name ?? block.title}`, body: summary }).toString().replace(/\+/g, "%20")}` : undefined
  const send = block.confirm ?? (block.link ? `Continue on ${hostOf(block.link)}` : block.mailto ? "Write the email" : "Send the request")
  const formProps = block.action ? { action: block.action, method: "post" } : block.mailto ? { action: `mailto:${block.mailto}`, method: "post", encType: "text/plain" } : {}
  const stepped = (s: Step) => ({ "data-step": s, "data-state": step === s ? "current" : "hidden", className: "flex flex-col gap-4 scripting:data-[state=hidden]:hidden" })
  const heading = (s: Step, i: number) => (
    <legend data-slot="booking-legend" className="mb-4 flex flex-col gap-2">
      <span data-slot="booking-count" className="type-caps numeric text-fg-secondary">{`Step ${i + 1} of ${STEPS.length}`}</span>
      <h3 ref={step === s ? (focus as React.Ref<HTMLHeadingElement>) : undefined} tabIndex={-1} data-slot="booking-step-title" className="type-heading-2 text-fg-primary focus-ring">
        {STEP_TITLE[s]}
      </h3>
    </legend>
  )
  const field = (name: "name" | "email" | "phone" | "note", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div data-slot="booking-field" className="flex flex-col gap-2">
      <label data-slot="booking-label" htmlFor={`${base}-${name}`} className={FIELD_LABEL}>
        {label}
        {props.required ? null : <span data-slot="booking-optional" className="type-caption text-fg-secondary">{" (optional)"}</span>}
      </label>
      {name === "note" ? (
        <textarea data-slot="booking-input" id={`${base}-${name}`} name={name} rows={4} value={details.note} onChange={(e) => setDetails((d) => ({ ...d, note: e.target.value }))} className={join(FIELD, "py-3")} />
      ) : (
        <input data-slot="booking-input" id={`${base}-${name}`} name={name} value={details[name]} onChange={(e) => setDetails((d) => ({ ...d, [name]: e.target.value }))} className={FIELD} {...props} />
      )}
    </div>
  )
  return (
    <Section id={id} data-block="booking" {...labelled} {...knobs.section}>
      <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
        {block.title}
      </KnobTitle>
      <KnobBody knobs={knobs}>
        <div data-slot="booking" className="col-span-full flex max-w-3xl flex-col gap-8">
          {block.body ? (
            <p data-slot="booking-body" className="max-w-prose type-body-lg text-prose text-fg-secondary">
              {block.body}
            </p>
          ) : null}
          <ol data-slot="booking-steps" aria-label="Steps" className="flex flex-wrap gap-x-6 gap-y-2 noscript:hidden">
            {STEPS.map((s, i) => (
              <li key={s} data-slot="booking-steps-item" data-state={i < index ? "done" : i === index ? "current" : "next"} aria-current={i === index ? "step" : undefined} className="type-label text-fg-secondary data-[state=current]:text-fg-primary">
                {`${i + 1}. ${STEP_TITLE[s].replace(/^Choose an? /, "").replace(/^./, (c) => c.toUpperCase())}`}
              </li>
            ))}
          </ol>
          <form ref={form} data-slot="booking-form" className="flex flex-col gap-8" {...formProps} onSubmit={(e) => (step !== "review" ? (e.preventDefault(), next()) : undefined)}>
            <fieldset data-slot="booking-step" {...stepped("service")}>
              {heading("service", 0)}
              {block.services.map((s) => (
                <Choice key={s.id} slot="booking-service" name="service" value={s.name} checked={service === s.id} onChange={() => { setService(s.id); setNudge("") }} required hint={[s.duration, s.price].filter(Boolean).join(" · ") || undefined}>
                  <span data-slot="booking-service-name" className="type-title">{s.name}</span>
                  {s.body ? <span data-slot="booking-service-body" className="block type-body-sm text-fg-secondary">{s.body}</span> : null}
                </Choice>
              ))}
            </fieldset>
            <fieldset data-slot="booking-step" {...stepped("time")}>
              {heading("time", 1)}
              {block.zone ? (
                <p data-slot="booking-zone" className={FIELD_HELP}>
                  {block.zone}
                </p>
              ) : null}
              <ul data-slot="booking-days" role="list" className="flex flex-col gap-6">
                {block.days.map((d) => {
                  const label = d.label ?? dateWords(d.date)
                  return (
                    <li key={d.date} data-slot="booking-day">
                      <fieldset data-slot="booking-day-group" className="flex flex-col gap-3">
                        <legend data-slot="booking-day-label" className="mb-3 type-title text-fg-primary">
                          <time dateTime={d.date} data-slot="booking-date">{label}</time>
                        </legend>
                        <div data-slot="booking-slots" className="flex flex-wrap gap-2">
                          {d.slots.map((t) => {
                            const value = `${d.date}T${t}`
                            return (
                              <label key={t} data-slot="booking-slot" className={CHOICE_PILL}>
                                <input type="radio" data-slot="booking-slot-input" name="slot" value={value} required checked={slot === value} onChange={() => { setSlot(value); setNudge("") }} aria-label={`${label}, ${t}`} className={MARK} />
                                <span data-slot="booking-slot-time" aria-hidden="true">{t}</span>
                              </label>
                            )
                          })}
                        </div>
                      </fieldset>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
            <fieldset data-slot="booking-step" {...stepped("details")}>
              {heading("details", 2)}
              {field("name", "Your name", { required: true, autoComplete: "name" })}
              {field("email", "Email", { required: true, type: "email", autoComplete: "email", inputMode: "email" })}
              {block.ask?.phone ? field("phone", "Phone", { type: "tel", autoComplete: "tel", inputMode: "tel" }) : null}
              {block.ask?.note ? field("note", "Anything we should know") : null}
            </fieldset>
            <div data-slot="booking-step" {...stepped("review")} className="flex flex-col gap-4 noscript:hidden scripting:data-[state=hidden]:hidden">
              <div data-slot="booking-legend" className="flex flex-col gap-2">
                <span data-slot="booking-count" className="type-caps numeric text-fg-secondary">{`Step 4 of ${STEPS.length}`}</span>
                <h3 ref={step === "review" ? (focus as React.Ref<HTMLHeadingElement>) : undefined} tabIndex={-1} data-slot="booking-step-title" className="type-heading-2 text-fg-primary focus-ring">
                  {STEP_TITLE.review}
                </h3>
              </div>
              <dl data-slot="booking-review" className="flex flex-col">
                {([
                  ["Service", chosen?.name ?? "", "service"],
                  ["Time", `${when}${block.zone ? ` (${block.zone})` : ""}`, "time"],
                  ["Name", details.name, "details"],
                  ["Email", details.email, "details"],
                  ...(block.ask?.phone && details.phone ? [["Phone", details.phone, "details"]] : []),
                  ...(block.ask?.note && details.note ? [["Note", details.note, "details"]] : []),
                ] as [string, string, Step][]).map(([k, v, s]) => (
                  <div key={k} data-slot="booking-review-row" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-line-primary py-3">
                    <div data-slot="booking-review-text" className="flex min-w-0 flex-col gap-1">
                      <dt data-slot="booking-review-key" className="type-caps text-fg-secondary">
                        {k}
                      </dt>
                      <dd data-slot="booking-review-value" className="type-body text-fg-primary">
                        {v}
                      </dd>
                    </div>
                    <button type="button" data-slot="booking-change" onClick={() => go(s)} className={BUTTON_QUIET}>
                      Change<span data-slot="booking-change-what" className="sr-only">{` ${k.toLowerCase()}`}</span>
                    </button>
                  </div>
                ))}
              </dl>
              {block.mailto ? (
                <p data-slot="booking-mail-note" className={FIELD_HELP}>
                  This opens your email app with the request written out. Nothing is sent until you send it.
                </p>
              ) : block.link ? (
                <p data-slot="booking-mail-note" className={FIELD_HELP}>
                  {`You finish booking on ${hostOf(block.link)}; have these details to hand.`}
                </p>
              ) : null}
            </div>
            <p data-slot="booking-nudge" aria-live="polite" className="type-body text-fg-primary noscript:hidden">
              {nudge}
            </p>
            <div data-slot="booking-actions" className="flex flex-wrap gap-3">
              {step === "review" || block.link ? (
                block.link ? (
                  <a href={block.link} data-slot="booking-send" className={join(BUTTON_PRIMARY, step !== "review" && "scripting:hidden")}>
                    {send}
                  </a>
                ) : mailto ? (
                  <a href={mailto} data-slot="booking-send" className={BUTTON_PRIMARY}>
                    {send}
                  </a>
                ) : (
                  <button type="submit" data-slot="booking-send" className={BUTTON_PRIMARY}>
                    {send}
                  </button>
                )
              ) : (
                <button type="button" data-slot="booking-next" onClick={next} className={join(BUTTON_PRIMARY, "noscript:hidden")}>
                  {step === "details" ? "Review" : "Next"}
                </button>
              )}
              {!block.link && step !== "review" ? (
                <button type="submit" data-slot="booking-send-static" className={join(BUTTON_PRIMARY, "scripting:hidden")}>
                  {block.mailto ? "Send by email" : send}
                </button>
              ) : null}
              {index > 0 ? (
                <button type="button" data-slot="booking-back" onClick={() => go(STEPS[index - 1])} className={join(BUTTON_QUIET, "noscript:hidden")}>
                  Back
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </KnobBody>
    </Section>
  )
}
