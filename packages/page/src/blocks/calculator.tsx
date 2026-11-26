import * as React from "react"
import { Section } from "@aleeforoughi/feather-expression"
import { formatAmount, priceOf, startScope, startValue } from "../core/flows"
import type { CalculatorInputSpec } from "../core/types"
import { Choice, FIELD, FIELD_HELP, FIELD_LABEL, MARK, RANGE } from "./controls"
import { KnobBody, KnobTitle, useKnobs } from "./knobs"
import { join, useRegion, type BlockProps } from "./shared"

const clamp = (v: number, i: CalculatorInputSpec) => Math.min(i.max ?? Infinity, Math.max(i.min ?? -Infinity, v))
const withUnit = (v: number, unit?: string) => `${formatAmount(v, { decimals: Number.isInteger(v) ? 0 : 2 })}${unit ? ` ${unit}` : ""}`

/**
 * A pricing calculator (feather.page/1, wave 5). The inputs are native (a slider, a number field, a radio group, a
 * switch) and the price is the page's own formula in a small safe language, evaluated with no eval; the total and its
 * breakdown sit in a polite live region, so a change is announced once it settles. Variants: split (the inputs beside
 * the total, which stays in view on wide screens) and stacked (the total under the inputs). With no script the inputs
 * cannot count, so they give way to the starting prices: the total at the starting choices and what each choice
 * makes it.
 */
export function CalculatorBlock({ block }: BlockProps<"calculator">) {
  const { id, titleId, labelled } = useRegion(block, "Price calculator")
  const knobs = useKnobs<"split" | "stacked">("calculator", block, { space: "l" })
  const base = id ?? titleId.replace(/-title$/, "")
  const [scope, setScope] = React.useState<Record<string, number>>(() => startScope(block.inputs))
  // A number field keeps what is typed; the price reads it clamped to the field's bounds.
  const [typed, setTyped] = React.useState<Record<string, string>>({})
  const lines = block.lines ?? []
  const price = priceOf(scope, lines, block.formula)
  const fmt = { prefix: block.prefix, suffix: block.suffix, decimals: block.decimals ?? 0 }
  const set = (name: string, v: number) => setScope((s) => ({ ...s, [name]: v }))
  const split = (knobs.variant ?? "split") === "split"
  const totalLabel = block.total ?? "Estimated total"

  const control = (input: CalculatorInputSpec) => {
    const at = `${base}-${input.id}`
    const help = input.help ? (
      <p id={`${at}-help`} data-slot="calculator-help" className={FIELD_HELP}>
        {input.help}
      </p>
    ) : null
    const described = input.help ? { "aria-describedby": `${at}-help` } : {}
    if (input.kind === "radio") {
      return (
        <fieldset key={input.id} data-slot="calculator-input" data-variant="radio" className="flex flex-col gap-3" {...described}>
          <legend data-slot="calculator-label" className={join(FIELD_LABEL, "mb-3")}>
            {input.label}
          </legend>
          {(input.options ?? []).map((o) => (
            <Choice key={o.label} slot="calculator-option" name={at} value={String(o.value)} checked={scope[input.id] === o.value} onChange={() => set(input.id, o.value)}>
              {o.label}
            </Choice>
          ))}
          {help}
        </fieldset>
      )
    }
    if (input.kind === "toggle") {
      return (
        <div key={input.id} data-slot="calculator-input" data-variant="toggle" className="flex flex-col gap-2">
          <label data-slot="calculator-switch" className="flex min-h-12 cursor-pointer items-center justify-between gap-6">
            <span data-slot="calculator-label" className={FIELD_LABEL}>
              {input.label}
            </span>
            <input type="checkbox" role="switch" data-slot="calculator-switch-input" checked={scope[input.id] === 1} onChange={(e) => set(input.id, e.target.checked ? 1 : 0)} className={MARK} {...described} />
          </label>
          {help}
        </div>
      )
    }
    const value = scope[input.id]
    const text = withUnit(value, input.unit)
    return (
      <div key={input.id} data-slot="calculator-input" data-variant={input.kind} className="flex flex-col gap-2">
        <div data-slot="calculator-input-head" className="flex items-baseline justify-between gap-6">
          <label data-slot="calculator-label" htmlFor={at} className={FIELD_LABEL}>
            {input.label}
          </label>
          {input.kind === "range" ? (
            <output data-slot="calculator-value" htmlFor={at} aria-hidden="true" className="type-title numeric text-fg-primary">
              {text}
            </output>
          ) : null}
        </div>
        {input.kind === "range" ? (
          <input type="range" id={at} data-slot="calculator-range" min={input.min} max={input.max} step={input.step ?? 1} value={value} aria-valuetext={text} onChange={(e) => set(input.id, Number(e.target.value))} className={RANGE} {...described} />
        ) : (
          <div data-slot="calculator-number" className="flex items-center gap-3">
            <input
              type="number"
              id={at}
              data-slot="calculator-number-input"
              inputMode="decimal"
              min={input.min}
              max={input.max}
              step={input.step ?? 1}
              value={typed[input.id] ?? String(value)}
              onChange={(e) => {
                setTyped((t) => ({ ...t, [input.id]: e.target.value }))
                const v = Number(e.target.value)
                if (e.target.value.trim() !== "" && Number.isFinite(v)) set(input.id, clamp(v, input))
              }}
              onBlur={() => setTyped(({ [input.id]: _drop, ...rest }) => (void _drop, rest))}
              className={join(FIELD, "max-w-xs numeric")}
              {...described}
            />
            {input.unit ? (
              <span data-slot="calculator-unit" className="type-body text-fg-secondary">
                {input.unit}
              </span>
            ) : null}
          </div>
        )}
        {help}
      </div>
    )
  }

  // The starting prices, for a page read with no script: the total at the starting choices, then what each choice
  // alone makes it (each option, each switch on, each slider at its ends).
  const start = startScope(block.inputs)
  const rows: [string, number][] = [["At the starting choices", priceOf(start, lines, block.formula).total]]
  for (const input of block.inputs) {
    const alone = (v: number) => priceOf({ ...start, [input.id]: v }, lines, block.formula).total
    if (input.kind === "radio") for (const o of input.options ?? []) if (o.value !== startValue(input)) rows.push([`${input.label}: ${o.label}`, alone(o.value)])
    if (input.kind === "toggle") rows.push([`${input.label}: ${startValue(input) === 1 ? "off" : "on"}`, alone(startValue(input) === 1 ? 0 : 1)])
    if ((input.kind === "range" || input.kind === "number") && input.max !== undefined && input.max !== startValue(input)) rows.push([`${input.label}: ${withUnit(input.max, input.unit)}`, alone(input.max)])
  }

  return (
    <Section id={id} data-block="calculator" {...labelled} {...knobs.section}>
      <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
        {block.title}
      </KnobTitle>
      <KnobBody knobs={knobs}>
        <div data-slot="calculator" className="col-span-full flex flex-col gap-8">
          {block.body ? (
            <p data-slot="calculator-body" className="max-w-prose type-body-lg text-prose text-fg-secondary">
              {block.body}
            </p>
          ) : null}
          <form data-slot="calculator-form" onSubmit={(e) => e.preventDefault()} className={join("grid grid-cols-1 gap-8 noscript:hidden", split && knobs.align !== "split" && "lg:grid-cols-12 lg:items-start")}>
            <div data-slot="calculator-inputs" className={join("flex flex-col gap-8", split && knobs.align !== "split" && "lg:col-span-7")}>
              {block.inputs.map(control)}
            </div>
            <div
              data-slot="calculator-total"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={join("flex flex-col gap-4 rounded-card border border-line-primary bg-surface-raised p-6", split && knobs.align !== "split" && "lg:sticky lg:top-24 lg:col-span-5")}
            >
              <span data-slot="calculator-total-label" className="type-caps text-fg-secondary">
                {totalLabel}
              </span>
              <span data-slot="calculator-total-value" className="type-display-s numeric text-fg-primary">
                {formatAmount(price.total, fmt)}
              </span>
              {lines.length ? (
                <dl data-slot="calculator-lines" className="flex flex-col">
                  {lines.map((line, i) => (
                    <div key={line.label} data-slot="calculator-line" className="flex items-baseline justify-between gap-6 border-t border-line-primary py-2">
                      <dt data-slot="calculator-line-label" className="type-body-sm text-fg-secondary">
                        {line.label}
                      </dt>
                      <dd data-slot="calculator-line-value" className="type-body-sm numeric text-fg-primary">
                        {formatAmount(price.lines[i], fmt)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </form>
          <div data-slot="calculator-static" className="flex flex-col gap-4 scripting:hidden">
            <table data-slot="calculator-prices" className="w-full max-w-3xl border-collapse text-start">
              <caption data-slot="calculator-prices-caption" className="mb-4 text-start type-title text-fg-primary">
                {`${totalLabel}: starting prices`}
              </caption>
              <thead data-slot="calculator-prices-head">
                <tr data-slot="calculator-prices-row" className="border-b border-line-primary">
                  <th scope="col" data-slot="calculator-prices-th" className="py-3 pe-6 text-start type-caps text-fg-secondary">
                    Choice
                  </th>
                  <th scope="col" data-slot="calculator-prices-th" className="py-3 text-end type-caps text-fg-secondary">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody data-slot="calculator-prices-body">
                {rows.map(([label, v]) => (
                  <tr key={label} data-slot="calculator-prices-row" className="border-b border-line-primary">
                    <th scope="row" data-slot="calculator-prices-choice" className="py-3 pe-6 text-start type-body font-normal text-fg-primary">
                      {label}
                    </th>
                    <td data-slot="calculator-prices-total" className="py-3 text-end type-body numeric text-fg-primary">
                      {formatAmount(v, fmt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.note ? (
            <p data-slot="calculator-note" className={FIELD_HELP}>
              {block.note}
            </p>
          ) : null}
        </div>
      </KnobBody>
    </Section>
  )
}
