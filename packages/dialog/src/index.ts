// @aleeforoughi/feather-dialog: turn-based interaction over a layout plan, for the bodies that talk (text, voice).
// Pure and deterministic: no DOM, no I/O, no clock. The words every non-visual body says live here too.
export { createDialog, type Choice, type Dialog, type DialogOptions, type Outcome, type Part, type Turn } from "./dialog.ts"
export { normalize, fold, type Normalized } from "./normalize.ts"
export { consequenceSentences, confidenceText, OTHER_OPTIONS_LABEL, sentences, show, type SentenceContext } from "./words.ts"
export { directionOf, formatDate, formatMoney, formatRange, percent, periodText, plainProblem, safeUrl, upperFirst } from "./format.ts"
export { childrenOf, experienceCurrency, experienceOf, irNodes, nodeIndex, planNodes } from "./plan-utils.ts"
