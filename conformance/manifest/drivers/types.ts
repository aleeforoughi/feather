import type { ReplyEvent } from "@aleeforoughi/feather-intent"

/** What a body emitted for a scenario. */
export interface Result {
  /** Every reply after the single act: one click, one switch selection, one typed choice, one spoken choice. */
  before: ReplyEvent[]
  /** Every reply after the deliberate step; null when the plan's node needs none. */
  after: ReplyEvent[] | null
}
