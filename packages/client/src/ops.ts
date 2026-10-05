// Builders for the ops of an update (`feather.update/1`), for `update()`. They validate nothing; `applyUpdate()` does.
import type { Artifact, IRNode, Resolution, UpdateOp } from "@aleeforoughi/feather-intent"

/** Adds `node` after the node whose id is `after`, or at the end. Its id must be new. */
export const add = (node: IRNode, options: { after?: string } = {}): UpdateOp => (options.after === undefined ? { op: "add", node } : { op: "add", node, after: options.after })

/** Puts `node`, whole, in place of the node with its id. */
export const replace = (node: IRNode): UpdateOp => ({ op: "replace", node })

/** Changes fields of the node `id` in place; a field set to `null` is removed. Never `id` or `type`. */
export const patch = (id: string, set: Record<string, unknown>): UpdateOp => ({ op: "patch", id, set })

/** Removes the node `id`. */
export const remove = (id: string): UpdateOp => ({ op: "remove", id })

/**
 * Ends the experience: `outcome` is "done", "cancelled" or "failed"; `summary` says what happened in one line (at most
 * 120 characters) and is all that stays; `artifact` is what it leaves behind. Always the last op of an update.
 */
export const resolve = (outcome: Resolution["outcome"], summary: string, artifact?: Artifact): UpdateOp =>
  artifact === undefined ? { op: "resolve", outcome, summary } : { op: "resolve", outcome, summary, artifact }
