// The honesty floor (Qooler file 22 §2; EU AI Act Article 50, from 2 August 2026): the input says it is an agent
// speaking from the owner's own words before the first word is typed. Feather makes it impossible to render a
// Composer without it.

export type SpeakerKind = "person" | "company" | "product"

export interface Speaker {
  kind: SpeakerKind
  /** The person's, company's or product's name. */
  name: string
}

/** The default disclosure line for a speaker, short and plain. A brand may write its own; it must still say both
 * that it is an agent and whose words it speaks from. */
export function disclosureLine(s: Speaker): string {
  if (s.kind === "person") return `An AI agent answering in ${s.name}'s own words. ${s.name} reads every message.`
  if (s.kind === "company") return `An AI agent answering from ${s.name}'s own material. A person is one step away.`
  return `An AI agent answering from ${s.name}'s documentation. A person is one step away.`
}

/** Whether a custom disclosure line is a disclosure: it names an AI or an agent. */
export function isDisclosure(line: string): boolean {
  return /\b(AI|agent|automated|artificial intelligence)\b/i.test(line) && line.trim().length >= 12
}
