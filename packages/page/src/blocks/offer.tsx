import { Grid, Section } from "@aleeforoughi/feather-expression"
import { BlockTitle, CardBody, useRegion, type BlockProps } from "./shared"

/** What can be bought or booked, and for how much. Up to four; an item with an `href` is one link. */
export function OfferBlock({ block }: BlockProps<"offer">) {
  const { id, titleId, labelled } = useRegion(block, "Ways to work together")
  const n = block.items.length
  return (
    <Section id={id} data-block="offer" {...labelled} space="l">
      {block.title ? <BlockTitle id={titleId}>{block.title}</BlockTitle> : null}
      <Grid columns={n === 4 ? 4 : n === 3 ? 3 : 2}>
        {block.items.map((item) => (
          <article key={item.name} data-slot="offer-item" className="min-w-0">
            <CardBody {...(item.href ? { href: item.href } : {})}>
              <div data-slot="offer-card" className="flex h-full flex-col gap-3 rounded-card border border-line-primary bg-surface-raised p-6">
                <h3 data-slot="offer-name" className="type-title text-fg-primary">
                  {item.name}
                </h3>
                {item.price ? (
                  <p data-slot="offer-price" className="type-heading-2 numeric text-fg-primary">
                    {item.price}
                  </p>
                ) : null}
                {item.body ? (
                  <p data-slot="offer-body" className="type-body text-prose text-fg-secondary">
                    {item.body}
                  </p>
                ) : null}
              </div>
            </CardBody>
          </article>
        ))}
      </Grid>
    </Section>
  )
}
