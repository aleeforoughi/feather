// The adversarial check for an armed act: nothing but the keyword commits it. Kept apart from the test so that
// harness.test.ts can prove the check catches a body that commits on the wrong word.
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import type { Talker } from "./drivers/talk.ts"

export interface Armed {
  talker: Talker
  /** Replies emitted by arming itself. */
  replies: ReplyEvent[]
  /** The words the act was picked by. */
  label: string
  keyword: string
}

/** Near misses of a keyword: a letter missing, an extra letter, two letters swapped, extra words. */
export const typo = (keyword: string) => [keyword.slice(0, -1), `${keyword}s`, `${keyword[1]}${keyword[0]}${keyword.slice(2)}`, `${keyword} please`]

/** Every way a body wrongly committed (or lost the armed state); empty when it held. `arm` starts afresh each call. */
export function attack(arm: () => Armed, expected: ReplyEvent, voice: boolean): string[] {
  const problems: string[] = []
  const first = arm()
  if (first.replies.length > 0) problems.push(`arming emitted ${JSON.stringify(first.replies)}`)
  if (first.talker.turn.state !== "confirm") problems.push(`arming did not lead to a confirm turn (it led to "${first.talker.turn.state}")`)
  const keyword = first.keyword.toLowerCase()
  const attempts = ["1", "2", "yes", "y", "Yes", "yes please", "ok", "go ahead", "confirm it", first.label, ...typo(first.keyword)].filter((x) => x.trim().toLowerCase() !== keyword)
  for (const attempt of attempts) {
    const fresh = arm()
    const replies = fresh.talker.say(attempt)
    if (replies.length > 0) problems.push(`${JSON.stringify(attempt)} committed ${JSON.stringify(replies)}`)
    if (fresh.talker.turn.state !== "confirm") problems.push(`${JSON.stringify(attempt)} left the confirm turn (now "${fresh.talker.turn.state}")`)
    // Nothing was lost: still armed, and the keyword still commits, once.
    const done = fresh.talker.say(fresh.keyword)
    if (JSON.stringify(done) !== JSON.stringify([expected])) problems.push(`after ${JSON.stringify(attempt)}, the keyword emitted ${JSON.stringify(done)} instead of exactly the reply`)
  }
  if (voice) {
    // The engine's alternatives: none of them is the keyword, so none commits, whichever comes first.
    const fresh = arm()
    const replies = fresh.talker.sayAlternatives?.(["yes", "1", "option one", first.label, ...typo(first.keyword)]) ?? []
    if (replies.length > 0) problems.push(`alternatives without the keyword committed ${JSON.stringify(replies)}`)
    const done = fresh.talker.say(fresh.keyword)
    if (JSON.stringify(done) !== JSON.stringify([expected])) problems.push(`after the alternatives, the keyword emitted ${JSON.stringify(done)} instead of exactly the reply`)
  }
  return problems
}
