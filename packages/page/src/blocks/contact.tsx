import { DisplayTitle, Magnetic, Section } from "@aleeforoughi/feather-expression"
import { alignClass, sizeOf, useKnobs } from "./knobs"
import { BUTTON_PRIMARY, BUTTON_QUIET, filledAction, join, useRegion, type BlockProps } from "./shared"

/** The one next act. Actions are real links styled as buttons: one filled (the first, or the one marked primary), and it leans toward the pointer (the page's one other Magnetic control); the rest are quiet. */
export function ContactBlock({ block }: BlockProps<"contact">) {
  const { id, titleId, labelled } = useRegion(block, "Contact")
  const actions = block.actions ?? []
  const filled = filledAction(actions)
  const knobs = useKnobs<"plain">("contact", block, { space: "xl", tone: "subtle" })
  const centre = knobs.align === "center"
  return (
    <Section id={id} data-block="contact" {...labelled} {...knobs.section}>
      <div data-slot="contact" className={join(alignClass(knobs.align, "col-span-full flex flex-col gap-8 md:col-span-10"), knobs.align !== "start" && "flex flex-col gap-8")}>
        {block.title ? (
          <DisplayTitle as="h2" size={sizeOf(knobs.scale, "m")} id={titleId} {...knobs.title}>
            {block.title}
          </DisplayTitle>
        ) : null}
        {block.body ? (
          <p data-slot="contact-body" className={join("max-w-prose type-body-lg text-prose text-fg-secondary", centre && "mx-auto")}>
            {block.body}
          </p>
        ) : null}
        {actions.length > 0 ? (
          <ul data-slot="contact-actions" role="list" className={join("flex flex-wrap gap-3", centre && "justify-center")}>
            {actions.map((action, i) => {
              const link = (
                <a href={action.href} data-slot="contact-action" data-variant={i === filled ? "primary" : "quiet"} className={i === filled ? BUTTON_PRIMARY : BUTTON_QUIET}>
                  {action.label}
                </a>
              )
              return (
                <li key={action.href} data-slot="contact-action-item">
                  {i === filled ? <Magnetic>{link}</Magnetic> : link}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </Section>
  )
}
