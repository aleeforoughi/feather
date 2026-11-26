import { MediaFrame, Section, type MediaTreatment } from "@aleeforoughi/feather-expression"
import type { JournalEntry, JournalVariant } from "../core/types"
import { KnobBody, KnobTitle, useKnobs } from "./knobs"
import { mediaProps } from "./media"
import { sizesOf } from "./sizes"
import { join, useCursorLabel, useRegion, type BlockProps } from "./shared"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/** A YYYY-MM-DD date as words ("24 November 2026"): the same on the server and in every browser. */
export function journalDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return MONTHS[m - 1] ? `${d} ${MONTHS[m - 1]} ${y}` : iso
}

function Entry({ entry, lead, treatment }: { entry: JournalEntry; lead: boolean; treatment: MediaTreatment }) {
  const cursor = useCursorLabel("link")
  return (
    <article data-slot="journal-entry" data-variant={lead ? "lead" : "row"} className={join("grid grid-cols-1 gap-6 border-t border-line-primary py-8", lead ? "lg:grid-cols-2 lg:items-end lg:gap-12" : "md:grid-cols-12 md:items-baseline")}>
      {lead && entry.media ? (
        <div data-slot="journal-media">
          <MediaFrame aspect="16/9" {...mediaProps(entry.media, undefined, sizesOf("journal.featured"))} decorative treatment={treatment} />
        </div>
      ) : null}
      <div data-slot="journal-words" className={lead ? "flex flex-col gap-3" : "contents"}>
        <time data-slot="journal-date" dateTime={entry.date} className={join("type-caps numeric text-fg-secondary", !lead && "md:col-span-3")}>
          {journalDate(entry.date)}
        </time>
        <div data-slot="journal-text" className={join("flex flex-col gap-3", !lead && "md:col-span-6")}>
          <h3 data-slot="journal-title" className={lead ? "type-display-s text-fg-primary" : "type-heading-2 text-fg-primary"}>
            <a href={entry.href} data-slot="journal-link" {...cursor} className="underline-offset-4 hover:underline focus-ring">
              {entry.title}
            </a>
          </h3>
          {entry.excerpt ? (
            <p data-slot="journal-excerpt" className="max-w-prose type-body text-prose text-fg-secondary">
              {entry.excerpt}
            </p>
          ) : null}
        </div>
      </div>
      {!lead && entry.media ? (
        <div data-slot="journal-thumb" className="hidden md:col-span-3 md:block">
          <MediaFrame aspect="4/3" radius="control" {...mediaProps(entry.media, undefined, sizesOf("journal.list.part"))} decorative treatment={treatment} />
        </div>
      ) : null}
    </article>
  )
}

/**
 * Writing, as an editorial list: each entry's date (a real time element), its title as the link, its excerpt and an
 * optional picture (decoration: the title says what it is). list (the default): even rows; featured: the first entry
 * leads with its picture large. `more` links to all of it.
 */
export function JournalBlock({ block }: BlockProps<"journal">) {
  const { id, titleId, labelled } = useRegion(block, "Journal")
  const knobs = useKnobs<JournalVariant>("journal", block, { space: "l" })
  const more = block.more?.[0]
  return (
    <Section id={id} data-block="journal" {...labelled} {...knobs.section}>
      {block.title ? (
        <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
          {block.title}
        </KnobTitle>
      ) : null}
      <KnobBody knobs={knobs}>
        <ol data-slot="journal" role="list" className="col-span-full flex flex-col border-b border-line-primary">
          {block.items.map((entry, i) => (
            <li key={entry.href + entry.title} data-slot="journal-item">
              <Entry entry={entry} lead={knobs.variant === "featured" && i === 0} treatment={knobs.treatment} />
            </li>
          ))}
        </ol>
        {more ? (
          <p data-slot="journal-more" className="col-span-full mt-8">
            <a href={more.href} data-slot="journal-more-link" className="inline-flex min-h-12 items-center type-label text-fg-primary underline underline-offset-4 focus-ring">
              {more.label}
            </a>
          </p>
        ) : null}
      </KnobBody>
    </Section>
  )
}
