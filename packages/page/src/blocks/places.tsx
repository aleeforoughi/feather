import { MediaFrame, Section } from "@aleeforoughi/feather-expression"
import type { PlaceItem } from "../core/types"
import { KnobBody, KnobTitle, useKnobs } from "./knobs"
import { mediaProps } from "./media"
import { BUTTON_QUIET, join, useRegion, type BlockProps } from "./shared"

/** Directions to a place: the page's own link, or a search for its address on OpenStreetMap (a link, never a tile). */
export const directionsHref = (p: PlaceItem) => p.directions ?? `https://www.openstreetmap.org/search?query=${encodeURIComponent(p.address)}`

/**
 * Places to find (feather.page/1, wave 5): always a list of names, addresses and links, which is the map navigation
 * a person can use with any device, any assistive tech and no script. Variants: list (the default) and map (the
 * page's own still map beside the list on wide screens, above it on a phone). No map SDK and no third-party tiles.
 */
export function PlacesBlock({ block }: BlockProps<"places">) {
  const { id, titleId, labelled } = useRegion(block, "Places")
  const knobs = useKnobs<"list" | "map">("places", block, { space: "l" })
  const map = knobs.variant === "map" && block.media
  const many = block.items.length > 2
  return (
    <Section id={id} data-block="places" {...labelled} {...knobs.section}>
      <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
        {block.title}
      </KnobTitle>
      <KnobBody knobs={knobs}>
        <div data-slot="places" className={join("col-span-full grid grid-cols-1 gap-8", map && knobs.align !== "split" && "lg:grid-cols-12 lg:items-start")}>
          {map ? (
            <div data-slot="places-map" className={join(knobs.align !== "split" && "lg:sticky lg:top-24 lg:col-span-6 lg:order-last")}>
              <MediaFrame aspect="4/3" {...mediaProps(block.media!, `A map of ${block.items.map((p) => p.name).join(", ")}`)} />
            </div>
          ) : null}
          <div data-slot="places-main" className={join("flex flex-col gap-6", map && knobs.align !== "split" && "lg:col-span-6")}>
            {block.body ? (
              <p data-slot="places-body" className="max-w-prose type-body-lg text-prose text-fg-secondary">
                {block.body}
              </p>
            ) : null}
            <ul data-slot="places-list" role="list" className={join("grid grid-cols-1 gap-x-8", !map && many && "md:grid-cols-2")}>
              {block.items.map((p) => (
                <li key={p.name} data-slot="places-item" className="flex flex-col gap-3 border-t border-line-primary py-6">
                  <h3 data-slot="places-name" className="type-title text-fg-primary">
                    {p.name}
                  </h3>
                  <address data-slot="places-address" className="whitespace-pre-line type-body not-italic text-fg-secondary">
                    {p.address}
                  </address>
                  {p.hours ? (
                    <p data-slot="places-hours" className="type-body-sm text-fg-secondary">
                      {p.hours}
                    </p>
                  ) : null}
                  {p.note ? (
                    <p data-slot="places-note" className="type-body-sm text-fg-secondary">
                      {p.note}
                    </p>
                  ) : null}
                  <div data-slot="places-links" className="flex flex-wrap gap-3">
                    <a href={directionsHref(p)} data-slot="places-directions" className={BUTTON_QUIET}>
                      Directions<span data-slot="places-link-name" className="sr-only">{` to ${p.name}`}</span>
                    </a>
                    {p.phone ? (
                      <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} data-slot="places-phone" className="inline-flex min-h-12 min-w-12 items-center type-label numeric text-fg-primary underline underline-offset-4 focus-ring">
                        {p.phone}
                      </a>
                    ) : null}
                    {p.href ? (
                      <a href={p.href} data-slot="places-site" className="inline-flex min-h-12 min-w-12 items-center type-label text-fg-primary underline underline-offset-4 focus-ring">
                        Website<span data-slot="places-link-name" className="sr-only">{` of ${p.name}`}</span>
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </KnobBody>
    </Section>
  )
}
