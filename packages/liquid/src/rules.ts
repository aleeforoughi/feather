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
  { id: "one-primary", source: "section 7, rule 1", summary: "One primary act per experience: the one the caller marks, or else the act that most needs the person (IrreversibleAction, Approval, Recommendation, Choice, Form, Input, Action)." },
  { id: "irreversible-explicit", source: "section 7, rule 2; principle 6", summary: "An irreversible act (an IrreversibleAction, an act marked reversible: false, or an act stating a consequence) never takes the default focus. Whatever commits it needs a deliberate act, once: arm and confirm, or a spoken or typed keyword in the plan's locale. An irreversible choice is never preselected; its prediction shows as a note." },
  { id: "recommendation-first", source: "section 7, rule 3", summary: "The recommendation comes first, then its alternatives, as one list. The predicted or selected option is preselected unless the act is irreversible; focus starts on the primary act." },
  { id: "critical-never-hidden", source: "section 7, rule 4", summary: "A critical node is emphasized, and its expandable detail shows open." },
  { id: "density-and-targets", source: "section 7, rule 5", summary: "Density follows the person, then the brand, then comfortable; low precision means targets of 44 px and spacious density; touch surfaces mean 44 px targets." },
  { id: "output-routing", source: "section 7, rule 6", summary: "Output decides the body: no visual output or a speaker routes to voice (to text when there is no audio either), a terminal to text; switch access routes to switch only where there is a screen. Input preferences never remove a screen. No audio output makes every cue text, and audio or video renders its text equivalent." },
  { id: "explanation-depth", source: "section 7, rule 7", summary: "A brief persona collapses expandable detail; a detailed one opens it." },
  { id: "reduced-motion", source: "section 7, rule 8", summary: "Reduced motion asked for by the OS or the person always wins over brand motion, and over a request for full motion." },
  { id: "text-without-decision", source: "section 7, rule 9", summary: "A single Text, Confirmation or Status that fits on one line (120 code points), with no detail, renders as text, with no card." },
  { id: "contrast", source: "section 7, rule 10", summary: "WCAG 2.2 AA in every theme; AAA where vision is low." },
  { id: "importance", source: "composer; principle 5", summary: "Importance, with the IR's defaults, sets emphasis: high stands out, low is quiet. A group of alternatives stands out as much as its strongest member." },
  { id: "structure", source: "composer", summary: "A PredictedChoice merges into its reversible Choice; a Tradeoff attaches to the option it describes; the requester attaches to every Approval it asks for; alternatives group into one list per node they are alternatives to." },
  { id: "defaults", source: "composer", summary: "What the composer assumes when no rule applies, said out loud in the trace." },
]
