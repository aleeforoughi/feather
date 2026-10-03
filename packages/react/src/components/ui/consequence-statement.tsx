import { cn } from "../../lib/cn"

/** What an act does, as the IR states it (`feather.ir/0` consequence). Mirrored by convention, not imported. */
export type Consequence = {
  spend?: { amount: number; currency: string }
  publish?: { audience: string }
  send?: { to: string; channel?: string }
  consent?: { to: string; scope: string }
  delete?: { what: string }
  statement?: string
}

/** Money in the reader's locale; a code the runtime does not know falls back to "{amount} {code}". */
function formatMoney(amount: number, currency: string, locale: string): string {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: fractionDigits, maximumFractionDigits: 2 })
      .format(amount)
      .replaceAll("\u00a0", " ")
      .replaceAll("\u202f", " ")
  } catch {
    return `${currency} ${amount}`
  }
}

/**
 * Each entry of a consequence as one plain sentence, in a fixed order (spend, publish, send, consent, delete,
 * statement): "Spends AED 1,050", "Publishes to everyone", "Sends to Sam by email", "Gives Acme access to your
 * calendar", "Deletes the draft", or the statement as written.
 */
function consequenceSentences(consequence: Consequence, locale = "en"): string[] {
  const out: string[] = []
  if (consequence.spend) out.push(`Spends ${formatMoney(consequence.spend.amount, consequence.spend.currency, locale)}`)
  if (consequence.publish) out.push(`Publishes to ${consequence.publish.audience}`)
  if (consequence.send) out.push(`Sends to ${consequence.send.to}${consequence.send.channel ? ` by ${consequence.send.channel}` : ""}`)
  if (consequence.consent) out.push(`Gives ${consequence.consent.to} access to ${consequence.consent.scope}`)
  if (consequence.delete) out.push(`Deletes ${consequence.delete.what}`)
  if (consequence.statement) out.push(consequence.statement)
  return out
}

/**
 * The consequence of an act, verbatim, before the act. Plain selectable text. Give it an `id` and point the act's
 * `aria-describedby` at it, so the consequence is the act's accessible description.
 */
function ConsequenceStatement({ consequence, locale = "en", id, className }: { consequence: Consequence; locale?: string; id?: string; className?: string }) {
  const sentences = consequenceSentences(consequence, locale)
  if (sentences.length === 0) return null
  return (
    <div id={id} data-slot="consequence-statement" data-variant="consequence" className={cn("space-y-1 type-label text-fg-primary", className)}>
      {sentences.map((sentence, i) => (
        <p key={i} data-slot="consequence-statement-item" className="select-text">{sentence}</p>
      ))}
    </div>
  )
}

export { ConsequenceStatement, consequenceSentences }
