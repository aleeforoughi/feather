import { Grid, Section } from "@aleeforoughi/feather-expression"
import type { OfferVariant } from "../core/types"
import { KnobBody, KnobTitle, useKnobs } from "./knobs"
import { BlockTitle, CardBody, useRegion, type BlockProps } from "./shared"

/**
 * What can be bought or booked, and for how much. Variants (feather.page/1): cards (the default, as /0: up to four;
 * an item with an `href` is one link), table (a real table to compare them: what, how long or how much, and the
 * link to book) and toggle (the cards with a radio group over them that switches every price between two `periods`,
 * monthly and yearly or two plans, each item giving its two `prices`; plain CSS, so it works with no script, and the
 * prices are a live region).
 */
export function OfferBlock({ block }: BlockProps<"offer">) {
  const { id, titleId, labelled } = useRegion(block, "Ways to work together")
  const knobs = useKnobs<OfferVariant>("offer", block, { space: "l" })
  const n = block.items.length
  const title = !knobs.any ? (block.title ? <BlockTitle id={titleId}>{block.title}</BlockTitle> : null) : block.title ? (
    <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
      {block.title}
    </KnobTitle>
  ) : null
  const toggle = knobs.variant === "toggle" && block.periods ? block.periods : null
  const group = `${id ?? titleId.replace(/-title$/, "")}-period`
  const cards = (
    <Grid columns={knobs.align === "split" ? 2 : n === 4 ? 4 : n === 3 ? 3 : 2}>
      {block.items.map((item) => (
        <article key={item.name} data-slot="offer-item" className="min-w-0">
          <CardBody {...(item.href ? { href: item.href } : {})}>
            <div data-slot="offer-card" className="flex h-full flex-col gap-3 rounded-card border border-line-primary bg-surface-raised p-6">
              <h3 data-slot="offer-name" className="type-title text-fg-primary">
                {item.name}
              </h3>
              {toggle && item.prices ? (
                // Both prices are in the document; the checked period shows its own (CSS, so it holds with no
                // script), and the change is announced.
                <p data-slot="offer-price" aria-live="polite" className="type-heading-2 numeric text-fg-primary">
                  <span data-slot="offer-price-first" className="group-has-[[data-period='1']:checked]/offer:hidden">
                    {item.prices[0]}
                  </span>
                  <span data-slot="offer-price-second" className="hidden group-has-[[data-period='1']:checked]/offer:inline">
                    {item.prices[1]}
                  </span>
                </p>
              ) : item.price ? (
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
  )
  if (!knobs.any) {
    return (
      <Section id={id} data-block="offer" {...labelled} space="l">
        {title}
        {cards}
      </Section>
    )
  }
  const anyLink = block.items.some((i) => i.href)
  return (
    <Section id={id} data-block="offer" {...labelled} {...knobs.section}>
      {title}
      <KnobBody knobs={knobs}>
        {toggle ? (
          <div data-slot="offer-toggle" className="group/offer col-span-full flex flex-col gap-8">
            <fieldset data-slot="offer-periods" className="flex flex-wrap gap-2">
              <legend data-slot="offer-periods-legend" className="sr-only">
                Prices for
              </legend>
              {toggle.map((period, i) => (
                <label
                  key={period}
                  data-slot="offer-period"
                  className="relative inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-control border border-line-primary bg-surface-base px-6 type-label text-fg-primary motion-state has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-solid"
                >
                  <input type="radio" data-slot="offer-period-input" data-period={i} name={group} value={period} defaultChecked={i === 0} className="sr-only" />
                  {period}
                </label>
              ))}
            </fieldset>
            {cards}
          </div>
        ) : knobs.variant === "table" ? (
          <div data-slot="offer-table-box" className="col-span-full overflow-x-auto">
            <table data-slot="offer-table" className="w-full border-collapse text-start">
              <caption className="sr-only" data-slot="offer-caption">
                {block.title ?? "Ways to work together"}
              </caption>
              <thead data-slot="offer-head">
                <tr data-slot="offer-head-row" className="border-b border-line-primary">
                  <th scope="col" data-slot="offer-th" className="py-3 pe-6 text-start type-caps text-fg-secondary">
                    What
                  </th>
                  <th scope="col" data-slot="offer-th" className="py-3 pe-6 text-start type-caps text-fg-secondary">
                    Price
                  </th>
                  <th scope="col" data-slot="offer-th" className="hidden py-3 pe-6 text-start type-caps text-fg-secondary md:table-cell">
                    Includes
                  </th>
                  {anyLink ? (
                    <th scope="col" data-slot="offer-th" className="py-3 text-end type-caps text-fg-secondary">
                      <span className="sr-only" data-slot="offer-th-label">
                        Book
                      </span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody data-slot="offer-body-rows">
                {block.items.map((item) => (
                  <tr key={item.name} data-slot="offer-row" className="border-b border-line-primary align-baseline">
                    <th scope="row" data-slot="offer-name" className="py-6 pe-6 text-start type-heading-2 text-fg-primary">
                      {item.name}
                    </th>
                    <td data-slot="offer-price" className="py-6 pe-6 type-title numeric text-fg-primary">
                      {item.price ?? "—"}
                    </td>
                    <td data-slot="offer-body" className="hidden py-6 pe-6 type-body text-prose text-fg-secondary md:table-cell">
                      {item.body}
                    </td>
                    {anyLink ? (
                      <td data-slot="offer-act" className="py-6 text-end">
                        {item.href ? (
                          <a href={item.href} data-slot="offer-link" className="inline-flex min-h-12 min-w-12 items-center justify-end type-label text-fg-primary underline underline-offset-4 focus-ring">
                            Book<span data-slot="offer-link-name" className="sr-only">{` ${item.name}`}</span>
                          </a>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          cards
        )}
      </KnobBody>
    </Section>
  )
}
