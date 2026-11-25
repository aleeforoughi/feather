import { Counter, Grid, Section, fitStyle, formatCount, joinUnit, useLocale } from "@aleeforoughi/feather-expression"
import type { NumbersVariant } from "../core/types"
import { KnobBody, KnobTitle, useKnobs } from "./knobs"
import { BlockTitle, join, useRegion, type BlockProps } from "./shared"

type Item = BlockProps<"numbers">["block"]["items"][number]

/** A number as text in the page's locale, the unit after it as Counter writes it (a no-break space, or a plain one for a long pair). */
const plain = (item: Item, locale: string) => joinUnit(formatCount(item.value, item.value, locale), item.unit)

/**
 * Up to four numbers that prove something. Variants (feather.page/1): counter (the default, as /0: counted in with
 * tabular figures, the final value always in the DOM), plain (the numbers set still, for a quiet page) and lead (the
 * first number as the block's display figure, the rest beside it).
 */
export function NumbersBlock({ block }: BlockProps<"numbers">) {
  const { id, titleId, labelled } = useRegion(block, "In numbers")
  const knobs = useKnobs<NumbersVariant>("numbers", block, { space: "l" })
  const n = block.items.length
  const locale = useLocale()
  const value = (item: Item) => (knobs.variant === "plain" ? plain(item, locale) : <Counter value={item.value} {...(item.unit ? { unit: item.unit } : {})} />)
  if (!knobs.any) {
    return (
      <Section id={id} data-block="numbers" {...labelled} space="l">
        {block.title ? <BlockTitle id={titleId}>{block.title}</BlockTitle> : null}
        <Grid columns={n >= 4 ? 4 : n === 3 ? 3 : 2}>
          {block.items.map((item) => (
            <div key={item.label} data-slot="number" className="flex flex-col gap-2 border-t border-line-primary pt-4">
              <p data-slot="number-value" className="type-display-m numeric text-fg-primary" style={fitStyle(plain(item, locale))}>
                <Counter value={item.value} {...(item.unit ? { unit: item.unit } : {})} />
              </p>
              <p data-slot="number-label" className="type-body text-fg-secondary">
                {item.label}
              </p>
            </div>
          ))}
        </Grid>
      </Section>
    )
  }
  const title = block.title ? (
    <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
      {block.title}
    </KnobTitle>
  ) : null
  const centre = knobs.align === "center"
  if (knobs.variant === "lead") {
    const [first, ...rest] = block.items
    return (
      <Section id={id} data-block="numbers" {...labelled} {...knobs.section}>
        {title}
        <KnobBody knobs={knobs}>
          <div data-slot="numbers-lead" className="col-span-full grid grid-cols-1 items-end gap-12 lg:grid-cols-12">
            <div data-slot="number" data-variant="lead" className="flex flex-col gap-4 lg:col-span-7">
              <p data-slot="number-value" className="type-display-xl numeric text-fg-primary" style={fitStyle(plain(first, locale))}>
                <Counter value={first.value} {...(first.unit ? { unit: first.unit } : {})} />
              </p>
              <p data-slot="number-label" className="max-w-prose type-body-lg text-fg-secondary">
                {first.label}
              </p>
            </div>
            {rest.length > 0 ? (
              <div data-slot="numbers-rest" className="flex flex-col gap-6 lg:col-span-5">
                {rest.map((item) => (
                  <div key={item.label} data-slot="number" className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-line-primary pt-4">
                    <p data-slot="number-label" className="type-body text-fg-secondary">
                      {item.label}
                    </p>
                    <p data-slot="number-value" className="type-heading-1 numeric text-fg-primary" style={fitStyle(plain(item, locale))}>
                      <Counter value={item.value} {...(item.unit ? { unit: item.unit } : {})} />
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </KnobBody>
      </Section>
    )
  }
  return (
    <Section id={id} data-block="numbers" {...labelled} {...knobs.section}>
      {title}
      <KnobBody knobs={knobs}>
        <Grid columns={knobs.align === "split" ? 2 : n >= 4 ? 4 : n === 3 ? 3 : 2}>
          {block.items.map((item) => (
            <div key={item.label} data-slot="number" data-variant={knobs.variant} className={join("flex flex-col gap-2 border-t border-line-primary pt-4", centre && "items-center text-center")}>
              <p data-slot="number-value" className="type-display-m numeric text-fg-primary" style={fitStyle(plain(item, locale))}>
                {value(item)}
              </p>
              <p data-slot="number-label" className="type-body text-fg-secondary">
                {item.label}
              </p>
            </div>
          ))}
        </Grid>
      </KnobBody>
    </Section>
  )
}
