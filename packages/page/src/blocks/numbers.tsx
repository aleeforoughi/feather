import { Counter, Grid, Section } from "@aleeforoughi/feather-expression"
import { BlockTitle, useRegion, type BlockProps } from "./shared"

/** Up to four numbers that prove something. Counted in with tabular figures; the final value is always in the DOM. */
export function NumbersBlock({ block }: BlockProps<"numbers">) {
  const { id, titleId, labelled } = useRegion(block, "In numbers")
  const n = block.items.length
  return (
    <Section id={id} data-block="numbers" {...labelled} space="l">
      {block.title ? <BlockTitle id={titleId}>{block.title}</BlockTitle> : null}
      <Grid columns={n >= 4 ? 4 : n === 3 ? 3 : 2}>
        {block.items.map((item) => (
          <div key={item.label} data-slot="number" className="flex flex-col gap-2 border-t border-line-primary pt-4">
            <p data-slot="number-value" className="type-display-m numeric text-fg-primary">
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
