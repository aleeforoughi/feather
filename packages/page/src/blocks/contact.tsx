import { DisplayTitle, Magnetic, Section } from "@aleeforoughi/feather-expression"
import { BUTTON_PRIMARY, BUTTON_QUIET, useRegion, type BlockProps } from "./shared"

/** The one next act. Actions are real links styled as buttons; the first leans toward the pointer (the page's one other Magnetic control). */
export function ContactBlock({ block }: BlockProps<"contact">) {
  const { id, titleId, labelled } = useRegion(block, "Contact")
  const actions = block.actions ?? []
  return (
    <Section id={id} data-block="contact" {...labelled} space="xl" tone="subtle">
      <div data-slot="contact" className="col-span-full flex flex-col gap-8 md:col-span-10">
        {block.title ? (
          <DisplayTitle as="h2" size="m" id={titleId}>
            {block.title}
          </DisplayTitle>
        ) : null}
        {block.body ? (
          <p data-slot="contact-body" className="max-w-prose type-body-lg text-prose text-fg-secondary">
            {block.body}
          </p>
        ) : null}
        {actions.length > 0 ? (
          <ul data-slot="contact-actions" role="list" className="flex flex-wrap gap-3">
            {actions.map((action, i) => {
              const link = (
                <a href={action.href} data-slot="contact-action" data-variant={i === 0 ? "primary" : "quiet"} className={i === 0 ? BUTTON_PRIMARY : BUTTON_QUIET}>
                  {action.label}
                </a>
              )
              return (
                <li key={action.href} data-slot="contact-action-item">
                  {i === 0 ? <Magnetic>{link}</Magnetic> : link}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </Section>
  )
}
