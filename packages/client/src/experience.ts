import { IR_VERSION, UPDATE_VERSION, type Experience, type ExperienceUpdate, type IRNode, type Resolution, type UpdateOp } from "@aleeforoughi/feather-intent"

export interface ExperienceOptions {
  /** BCP 47 language of the words in it ("en", "ar-AE"). */
  locale?: string
  /** The caller's version of it: 0, or leave it out, when opened; one more with each update. */
  revision?: number
  /** For an experience that is already over; its nodes may then be empty. */
  resolved?: Resolution
}

/**
 * An Experience IR document: the next necessary interaction, as meaning. `nodes` are what the builders in `nodes`
 * return, in the order that is the meaning. Nothing is validated here; `validate()` does that.
 */
export function experience(name: string, nodes: readonly IRNode[], options: ExperienceOptions = {}): Experience {
  const doc: Experience = { ir: IR_VERSION, experience: name, nodes: [...nodes] }
  if (options.locale !== undefined) doc.locale = options.locale
  if (options.revision !== undefined) doc.revision = options.revision
  if (options.resolved !== undefined) doc.resolved = options.resolved
  return doc
}

/**
 * A `feather.update/1`: one change to an open experience, for `applyUpdate()`. `revision` is the revision the
 * experience has once the update is applied (exactly one more than before); `ops` are what `add`, `replace`, `patch`,
 * `remove` and `resolve` return (`resolve` always last). Every op lands, or none does. Nothing is validated here.
 */
export function update(experienceName: string, revision: number, ops: readonly UpdateOp[]): ExperienceUpdate {
  return { update: UPDATE_VERSION, experience: experienceName, revision, ops: [...ops] }
}
