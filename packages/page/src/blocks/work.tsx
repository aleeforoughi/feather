import { Grid, MediaFrame, Section } from "@aleeforoughi/feather-expression"
import type { WorkItem } from "../core/types"
import { mediaProps } from "./media"
import { BlockTitle, CardBody, useRegion, type BlockProps } from "./shared"

const toItem = (item: string | WorkItem): WorkItem => (typeof item === "string" ? { id: item, title: item } : item)

function WorkCard({ item }: { item: WorkItem }) {
  const meta = [item.role, item.year].filter(Boolean).join(" · ")
  return (
    <article data-slot="work-item" className="min-w-0">
      <CardBody {...(item.href ? { href: item.href } : {})}>
        {item.media ? <MediaFrame aspect="4/3" {...mediaProps(item.media)} /> : null}
        <div data-slot="work-meta" className="mt-4 flex flex-col gap-2">
          <h3 data-slot="work-title" className="type-title text-fg-primary">
            {item.title}
          </h3>
          {item.summary ? (
            <p data-slot="work-summary" className="max-w-prose type-body-sm text-prose text-fg-secondary">
              {item.summary}
            </p>
          ) : null}
          {meta ? (
            <p data-slot="work-caption" className="type-caption text-fg-secondary">
              {meta}
            </p>
          ) : null}
        </div>
      </CardBody>
    </article>
  )
}

/** Selected work: a grid of cards, each one a link when it has an `href`. */
export function WorkBlock({ block }: BlockProps<"work">) {
  const { id, titleId, labelled } = useRegion(block, "Selected work")
  const items = block.items.map(toItem)
  return (
    <Section id={id} data-block="work" {...labelled} space="l">
      {block.title ? <BlockTitle id={titleId}>{block.title}</BlockTitle> : null}
      <Grid columns={items.length === 1 || items.length === 2 || items.length === 4 ? 2 : 3}>
        {items.map((item) => (
          <WorkCard key={item.id} item={item} />
        ))}
      </Grid>
    </Section>
  )
}
