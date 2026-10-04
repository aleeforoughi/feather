// The controls a scenario touches in the rendered DOM, as steps. Web and switch render the same DOM (the switch body
// is a layer over PlanView), so both drivers read one script; what differs is how a step is carried out: a click and
// typing for web, next and select keys for switch. The script uses only the documented contract: `data-feather-node`
// and the organisms' `data-slot`s.
import type { IRNode } from "@aleeforoughi/feather-intent"
import type { Scenario } from "../scenarios.ts"

export type Find = (root: HTMLElement) => HTMLElement | null

export type Step =
  | { kind: "press"; find: Find; what: string; /** Skipped when this says so (a checkbox already as wanted). */ skip?: (el: HTMLElement) => boolean }
  | { kind: "type"; find: Find; what: string; text: string }

export interface Script {
  /** Steps of the single act: everything before the deliberate step. */
  act: Step[]
  /** The deliberate step, when the plan's node needs one. */
  deliberate: Step[]
}

const slot = (name: string): Find => (root) => root.querySelector<HTMLElement>(`[data-slot="${name}"]`)
const nth =
  (selector: string, i: number): Find =>
  (root) =>
    root.querySelectorAll<HTMLElement>(selector)[i] ?? null
/** The element itself when it matches (the node's host may be the form's own root), else the first match inside it. */
const within =
  (selector: string): Find =>
  (root) =>
    root.matches(selector) ? root : root.querySelector<HTMLElement>(selector)

/** A form field's control: [data-slot=form-group-control] inside [data-slot=form-group-field][data-field-id]. If the slot is a wrapper, the input inside it. */
const formControl =
  (id: string): Find =>
  (root) => {
    const el = within(`[data-slot="form-group-field"][data-field-id="${id}"] [data-slot="form-group-control"]`)(root)
    if (!el) return null
    return el.matches("input, textarea, select") ? el : (el.querySelector<HTMLElement>("input, textarea, select") ?? el)
  }

/** The submit button, only when its accessible name is the form's submitLabel (or its intent): a wrong name is a failure. */
const formSubmit =
  (name: string): Find =>
  (root) => {
    const el = within('[data-slot="form-group-submit"]')(root)
    const got = (el?.getAttribute("aria-label") ?? el?.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase()
    return el && got === name.trim().toLowerCase() ? el : null
  }

const press = (what: string, find: Find, skip?: (el: HTMLElement) => boolean): Step => ({ kind: "press", find, what, skip })
const type = (what: string, find: Find, text: string): Step => ({ kind: "type", find, what, text })
const checked = (el: HTMLElement) => el.getAttribute("aria-checked") === "true" || el.hasAttribute("data-checked")

/** The text a person types for a value. */
export function typed(value: unknown): string {
  if (typeof value === "object" && value !== null && "amount" in value) return String((value as { amount: unknown }).amount)
  return String(value)
}

/** The steps that reach the scenario's reply on the web, or throws for a node the contract does not let it reach. */
export function scriptFor(ir: IRNode, s: Scenario, ctx: { predictedOptions: string[] }): Script {
  const act = (...steps: Step[]): Script => ({ act: steps, deliberate: [] })
  const armed = (first: Step, then: Step): Script => (s.deliberate ? { act: [first], deliberate: [then] } : act(first))

  switch (ir.type) {
    case "Action":
      return act(press("the action button", slot("experience-action")))
    case "Warning":
      return act(press("Acknowledge", slot("experience-acknowledge")))
    case "Autopick":
      return act(press(s.act === "keep" ? "Keep this" : "Undo", slot(s.act === "keep" ? "experience-autopick-keep" : "experience-autopick-undo")))
    case "Recommendation":
      return armed(press("Accept recommendation", slot("recommendation-accept")), press("Yes, …", slot("recommendation-confirm")))
    case "IrreversibleAction":
      if (s.backOut) return { act: [press("the arming button", slot("irreversible-action-arm"))], deliberate: [press("Cancel", slot("irreversible-action-cancel"))] }
      return armed(press("the arming button", slot("irreversible-action-arm")), press("Yes, …", slot("irreversible-action-confirm")))
    case "Approval": {
      if (s.act === "approve") return armed(press("Approve", slot("approval-approve")), press("Yes, approve", slot("approval-confirm")))
      const steps = [press("Reject", slot("approval-reject"))]
      if (!s.noReason) steps.push(type("the reason", slot("approval-reason"), String(s.value)))
      steps.push(press("Send rejection", slot("approval-send-rejection")))
      return act(...steps)
    }
    case "Choice": {
      const wanted = ir.multiple === true ? (s.value as string[]) : [s.value as string]
      const indexes = wanted.map((id) => ir.options.findIndex((o) => o.id === id))
      if (ir.multiple === true) {
        const boxes = ir.options.map((_, i) => press(`option ${i + 1}`, nth('[data-slot="experience-choice"] [role="checkbox"]', i), (el) => checked(el) === indexes.includes(i)))
        return act(...boxes, press("Choose", slot("experience-choice-submit")))
      }
      return act(press(`option ${indexes[0]! + 1}`, nth('[data-slot="experience-choice"] [role="radio"]', indexes[0]!)), press("Choose", slot("experience-choice-submit")))
    }
    case "PredictedChoice": {
      if (s.act === "accept") return act(press("Keep …", slot("predicted-choice-action")))
      // The options of the Choice it is merged into, in order; the radios are in the same order.
      const index = ctx.predictedOptions.indexOf(s.value as string)
      return act(press(`option ${index + 1}`, nth('[data-slot="predicted-choice"] [role="radio"]', index)), press("Use …", slot("predicted-choice-action")))
    }
    case "Input": {
      if (s.act === "skip") return act(press("Skip", slot("experience-input-skip")))
      return act(type("the answer", slot("experience-input-field"), typed(s.value)), press("Send answer", slot("experience-input-submit")))
    }
    case "Form": {
      if (s.act === "skip") return act(press("Skip the form", within('[data-slot="form-group-skip"]')))
      // Every field in the scenario's answers is typed, in the form's order; a field left out is not touched.
      const answers = (s.value ?? {}) as Record<string, unknown>
      const typing = ir.fields.filter((f) => answers[f.id] !== undefined).map((f) => type(`the field "${f.prompt}"`, formControl(f.id), typed(answers[f.id])))
      return act(...typing, press(`the submit button "${ir.submitLabel ?? ir.intent}"`, formSubmit(ir.submitLabel ?? ir.intent)))
    }
    case "Correction":
      return act(type("the correction", slot("correction-input-field"), String(s.value)), press("Submit correction", slot("correction-input-submit")))
    case "Preference": {
      // On and off is a switch, a fixed set is choices, anything else is a field: decided by the IR's own value and options.
      if (typeof ir.value === "boolean" && (ir.options === undefined || ir.options.every((o) => typeof o === "boolean"))) return act(press("the switch", (r) => r.querySelector<HTMLElement>('[role="switch"]')))
      if (ir.options) {
        const i = ir.options.indexOf(s.value as string | number | boolean)
        return act(press(`option ${i + 1}`, nth('[data-slot="experience-preference"] [role="radio"]', i)), press("Set to …", slot("experience-preference-submit")))
      }
      return act(type("the value", slot("experience-preference-field"), typed(s.value)), press("Set", slot("experience-preference-submit")))
    }
    case "ExploreMore": {
      if (ir.topics && ir.topics.length > 0) {
        const topic = String(s.value)
        return act(
          press("More about…", slot("explore-more-trigger")),
          press(`the topic ${topic}`, () => Array.from(document.querySelectorAll<HTMLElement>('[data-slot="explore-more-topic"]')).find((el) => el.textContent?.trim() === topic) ?? null),
        )
      }
      return act(press("the explore button", slot("explore-more-button")))
    }
    case "Alternative": {
      if (!ir.input) return act(press("the alternative", slot("alternative-list-button")))
      // A Price takes the experience's own currency (the field's default); the scenario expects exactly that.
      return act(press("the alternative", slot("alternative-list-button")), type("the value", slot("alternative-list-input"), typed(s.value)), press("Use this", slot("alternative-list-submit")))
    }
    default:
      throw new Error(`no web control is known for ${ir.type}`)
  }
}
