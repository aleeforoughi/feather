// The page's disclosure line (feather.page living): what the Living Page's composer says before the first word. A page
// may write its own (`living.disclosure`, which the validator holds to saying it is an AI agent). Without one, a /1
// page says the same plain line, which passes that same rule and claims nothing about who reads the messages; a /0
// page keeps the Living Page's own default line, byte for byte as before.
import type { PageDocument } from "./types"

/** The rule the validator holds a disclosure to: it names an AI, an agent or automation. */
export const DISCLOSURE_RULE = /\b(AI|agent|automated)\b/i

/** The default line for a speaker's page. */
export const defaultDisclosure = (name: string) => `An AI agent speaking for ${name}`

/** The line a living page shows: its own, else (on /1) the default for its speaker. Undefined for a page that is not
 * living, and for a /0 page without its own (the Living Page then writes its default). */
export function pageDisclosure(page: Pick<PageDocument, "living" | "speaker" | "schema">): string | undefined {
  if (!page.living || !page.speaker) return undefined
  if (page.living.disclosure !== undefined) return page.living.disclosure
  return page.schema === "feather.page/0" ? undefined : defaultDisclosure(page.speaker.name)
}
