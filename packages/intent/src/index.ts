// @aleeforoughi/feather-intent: the Experience IR (feather.ir/1), the one contract callers use to ask Feather for
// an interaction. No dependencies; runs in Node and the browser.
export * from "./types.ts"
export { validate, formatIssues, parseDate, MAX_ISSUES, SUMMARY_MAX, type Issue, type IssueCode, type ValidationResult } from "./validate.ts"
export { validateReply, actsFor, type ReplyIssue, type ReplyResult } from "./reply.ts"
export { NODES, NODE_SPECS, PRESENTATIONAL_FIELDS, DEFAULT_MAX_LENGTH, specFor, type NodeSpec, type Field } from "./spec.ts"
export { applyUpdate, type UpdateIssue, type UpdateIssueCode, type UpdateResult } from "./update.ts"
