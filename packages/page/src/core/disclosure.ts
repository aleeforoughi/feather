// The page's disclosure line (feather.page living): what the Living Page's composer says before the first word. A page
// may write its own (`living.disclosure`, which the validator holds to saying it is an AI agent); without one, every
// living page says the same plain line, which passes that same rule.
import type { PageDocument } from "./types"

/** The rule the validator holds a disclosure to: it names an AI, an agent or automation. */
export const DISCLOSURE_RULE = /\b(AI|agent|automated)\b/i

/** The default line for a speaker's page. */
export const defaultDisclosure = (name: string) => `An AI agent speaking for ${name}`

/** The line a living page shows: its own, else the default for its speaker. Undefined for a page that is not living. */
export function pageDisclosure(page: Pick<PageDocument, "living" | "speaker">): string | undefined {
  if (!page.living || !page.speaker) return undefined
  return page.living.disclosure ?? defaultDisclosure(page.speaker.name)
}
