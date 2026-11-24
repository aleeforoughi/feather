import { Marquee, Section } from "@aleeforoughi/feather-expression"
import type { LogosVariant } from "../core/types"
import { KnobTitle, useKnobs } from "./knobs"
import { mediaSrc } from "./media"
import { BlockTitle, join, useRegion, type BlockProps } from "./shared"

type Logo = BlockProps<"logos">["block"]["items"][number]

/** Names are always text. A mark is optional and decorative (empty alt), so nothing depends on an image loading. */
function Name({ item, as: Tag }: { item: Logo; as: "li" | "span" }) {
  return (
    <Tag data-slot="logos-item" className="inline-flex shrink-0 items-center gap-3">
      {item.src ? <img data-slot="logos-mark" src={mediaSrc(item.src)} alt="" loading="lazy" decoding="async" className="h-6 w-auto" /> : null}
      <span data-slot="logos-name" className="type-title text-fg-secondary">
        {item.name}
      </span>
    </Tag>
  )
}

/**
 * Who it was for. Without a variant (as /0): up to 8 names sit in a row, more loop in a Marquee. Variants
 * (feather.page/1): grid (every name in a ruled grid, whatever the count) and marquee (always the loop, which can
 * always be paused; motion.direction left or right).
 */
export function LogosBlock({ block }: BlockProps<"logos">) {
  const { id, titleId, labelled } = useRegion(block, "Who it was for")
  const knobs = useKnobs<LogosVariant>("logos", block, { space: "m" })
  const many = block.items.length > 8
  if (!knobs.any) {
    return (
      <Section id={id} data-block="logos" {...labelled} space="m">
        {block.title ? <BlockTitle id={titleId}>{block.title}</BlockTitle> : null}
        <div data-slot="logos" data-variant={many ? "marquee" : "row"} className="col-span-full">
          {many ? (
            <Marquee>
              {block.items.map((item) => (
                <Name key={item.name} item={item} as="span" />
              ))}
            </Marquee>
          ) : (
            <ul data-slot="logos-list" role="list" className="flex flex-wrap gap-x-12 gap-y-6">
              {block.items.map((item) => (
                <Name key={item.name} item={item} as="li" />
              ))}
            </ul>
          )}
        </div>
      </Section>
    )
  }
  const marquee = knobs.named ? knobs.variant === "marquee" : many
  const centre = knobs.align === "center"
  return (
    <Section id={id} data-block="logos" {...labelled} {...knobs.section}>
      {block.title ? (
        <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
          {block.title}
        </KnobTitle>
      ) : null}
      <div data-slot="logos" data-variant={marquee ? "marquee" : knobs.named ? "grid" : "row"} className="col-span-full">
        {marquee ? (
          <Marquee direction={block.motion?.direction === "right" ? "right" : "left"}>
            {block.items.map((item) => (
              <Name key={item.name} item={item} as="span" />
            ))}
          </Marquee>
        ) : knobs.named ? (
          <ul data-slot="logos-list" role="list" className="grid grid-cols-2 border-l border-t border-line-primary sm:grid-cols-4">
            {block.items.map((item) => (
              <li key={item.name} data-slot="logos-cell" className={join("flex min-h-24 items-center border-b border-r border-line-primary p-6", centre && "justify-center")}>
                <Name item={item} as="span" />
              </li>
            ))}
          </ul>
        ) : (
          <ul data-slot="logos-list" role="list" className={join("flex flex-wrap gap-x-12 gap-y-6", centre && "justify-center")}>
            {block.items.map((item) => (
              <Name key={item.name} item={item} as="li" />
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}
