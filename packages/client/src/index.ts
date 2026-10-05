// @aleeforoughi/feather-client: call Feather from TypeScript and JavaScript. Build an experience, validate it, change it
// with updates, and receive the person's replies, already checked. Runs in Node and the browser; its only dependency
// is the IR package. It calls no model, stores no person, and logs nothing.
//
//   import { experience, nodes, validate } from "@aleeforoughi/feather-client"
//   const doc = experience("approve", [nodes.Recommendation({ id: "rec", intent: "decide", summary: "Ship it" })])
//   const result = validate(doc)
import * as nodes from "./nodes.ts"
import * as ops from "./ops.ts"

export { nodes, ops }
export { experience, update, type ExperienceOptions } from "./experience.ts"
export { add, replace, patch, remove, resolve } from "./ops.ts"
export { parseReply, createReplyHandler, type ReplyHandlerOptions, type ReplyHandler } from "./reply.ts"
export {
  validate,
  validateReply,
  applyUpdate,
  formatIssues,
  actsFor,
  IR_VERSION,
  IR_VERSIONS,
  UPDATE_VERSION,
  UPDATE_VERSIONS,
  type Issue,
  type IssueCode,
  type ValidationResult,
  type ReplyIssue,
  type ReplyResult,
  type UpdateIssue,
  type UpdateIssueCode,
  type UpdateResult,
  type Experience,
  type ExperienceUpdate,
  type UpdateOp,
  type Resolution,
  type Artifact,
  type ReplyEvent,
  type IRNode,
  type NodeType,
  type Importance,
} from "@aleeforoughi/feather-intent"
