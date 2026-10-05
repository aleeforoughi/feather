import { applyUpdate, type Experience, type UpdateIssue, type UpdateResult } from "@aleeforoughi/feather-intent"

/**
 * One step of the lifecycle (docs/lifecycle.md): applies `update` to the experience being shown. On success the new
 * experience is what is shown next; on refusal what is shown stays, and the issues go to `onIssues`.
 * An experience that is not valid `feather.ir/0` is refused by `applyUpdate` itself (`invalid-experience`).
 */
export function applyToCurrent(current: unknown, update: unknown, onIssues?: (issues: UpdateIssue[]) => void): { current: unknown; result: UpdateResult } {
  const result = applyUpdate(current as Experience, update)
  if (result.ok) return { current: result.experience, result }
  onIssues?.(result.issues)
  return { current, result }
}
