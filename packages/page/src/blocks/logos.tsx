import { Marquee, Section } from "@aleeforoughi/feather-expression"
import { mediaSrc } from "./media"
import { BlockTitle, useRegion, type BlockProps } from "./shared"

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

/** Who it was for. Up to 8 names sit in a row; more loop in a Marquee, which can always be paused. */
export function LogosBlock({ block }: BlockProps<"logos">) {
  const { id, titleId, labelled } = useRegion(block, "Who it was for")
  const many = block.items.length > 8
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
