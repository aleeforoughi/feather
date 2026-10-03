// The composer's rules, by name: docs/PLAN.md section 7, plus the structural rules the composer needs. Every trace
// entry names one of these; test/rules.test.ts proves each one.
import type { RuleId } from "./plan.ts"

export interface RuleInfo {
  id: RuleId
  /** Where the rule comes from. */
  source: string
  summary: string
}

export const RULES: RuleInfo[] = [
  { id: "one-primary", source: "section 7, rule 1", summary: "One primary act per experience: the one the caller marks, or else the act that most needs the person (IrreversibleAction, Approval, Recommendation, Choice, Input, Action)." },
  { id: "irreversible-explicit", source: "section 7, rule 2; principle 6", summary: "An irreversible act shows its consequence verbatim, needs a deliberate act (arm and confirm, a spoken or a typed keyword), and never takes the default focus. An irreversible choice is never preselected." },
  { id: "recommendation-first", source: "section 7, rule 3", summary: "The recommendation comes first, then the alternatives, as one list. The predicted or selected option is preselected unless the act is irreversible; focus starts on the primary act." },
  { id: "critical-never-hidden", source: "section 7, rule 4", summary: "A critical node is emphasized, and its expandable detail shows open." },
  { id: "density-and-targets", source: "section 7, rule 5", summary: "Density follows the person within the brand's axis; low precision means targets of 44 px and spacious density; touch surfaces mean 44 px targets." },
  { id: "output-routing", source: "section 7, rule 6", summary: "No visual output routes to voice (or to text when there is no audio either); switch access routes to switch; no audio output makes every cue text." },
  { id: "explanation-depth", source: "section 7, rule 7", summary: "A brief persona collapses expandable detail; a detailed one opens it." },
  { id: "reduced-motion", source: "section 7, rule 8", summary: "Reduced motion asked for by the OS or the person always wins over brand motion, and over a request for full motion." },
  { id: "text-without-decision", source: "section 7, rule 9", summary: "Text that fits in one line, with no decision, renders as text, with no card." },
  { id: "contrast", source: "section 7, rule 10", summary: "WCAG 2.2 AA in every theme; AAA where vision is low." },
  { id: "structure", source: "composer", summary: "A PredictedChoice merges into its Choice; a Tradeoff attaches to the option it describes; an Approval's requester attaches to it; alternatives group into one list." },
  { id: "defaults", source: "composer", summary: "What the composer assumes when no rule applies, said out loud in the trace." },
]
