// @aleeforoughi/feather-liquid: the liquid composer. compose(experience, context) → LayoutPlan.
export { compose, type ComposeResult } from "./compose.ts"
export { REFERENCE_CAPABILITIES, REFERENCE_CONTEXTS, REFERENCE_PERSONAS, type ReferenceCapabilityName, type ReferenceContextName, type ReferencePersonaName } from "./context.ts"
export { PRIORITY, decide, type Candidate, type Level } from "./priority.ts"
export { RULES, type RuleInfo } from "./rules.ts"
export * from "./plan.ts"
