// Updates (milestone L6): an open experience changes in place, op by op, and ends with a resolution:
// open → update → resolve → collapse. applyUpdate() is pure: it never changes the experience it is given, it lands
// every op or none, and the experience it returns is valid feather.ir/1, or it reports why not. It never throws.
import { UPDATE_VERSION, UPDATE_VERSIONS, type Experience, type IRNode } from "./types.ts"
import { MAX_ISSUES, checkResolution, describe, isObject, quote, seg, unknownField, validate, type Add, type IssueCode } from "./validate.ts"

export type UpdateIssueCode =
  | IssueCode
  | "invalid-experience"
  | "wrong-experience"
  | "stale-revision"
  | "empty-update"
  | "unknown-op"
  | "unknown-node"
  | "already-resolved"
  | "after-resolve"

export interface UpdateIssue {
  code: UpdateIssueCode
  /** JSON Pointer into the update; under "/result", into the experience the update would make. */
  path: string
  message: string
}

export type UpdateResult = { ok: true; experience: Experience } | { ok: false; issues: UpdateIssue[] }

const UPDATE_FIELDS = ["update", "experience", "revision", "ops"]
const OP_FIELDS: Record<string, string[]> = {
  add: ["op", "node", "after"],
  replace: ["op", "node"],
  patch: ["op", "id", "set"],
  remove: ["op", "id"],
  resolve: ["op", "outcome", "summary", "artifact"],
}

class Overflow extends Error {}

/** Applies a feather.update/1 (or /0) to an experience. Returns the new experience, or every reason it cannot. */
export function applyUpdate(experience: Experience, update: unknown): UpdateResult {
  const issues: UpdateIssue[] = []
  const add = (code: UpdateIssueCode, path: string, message: string) => {
    if (issues.length === MAX_ISSUES) {
      issues.push({ code: "too-many-issues", path: "", message: `More than ${MAX_ISSUES} problems; fix these first, then send the update again.` })
      throw new Overflow()
    }
    issues.push({ code, path, message })
  }
  try {
    const result = run(experience, update, add, issues)
    if (issues.length === 0 && result) return { ok: true, experience: result }
  } catch (err) {
    if (!(err instanceof Overflow)) issues.push({ code: "unreadable", path: "", message: `The update could not be read as JSON data (${err instanceof Error ? err.message : String(err)}); send plain JSON.` })
  }
  return { ok: false, issues }
}

function run(experience: Experience, update: unknown, add: (code: UpdateIssueCode, path: string, message: string) => void, issues: readonly UpdateIssue[]): Experience | undefined {
  const checked = validate(experience)
  if (!checked.ok) {
    add("invalid-experience", "", `The experience is not valid feather.ir/1 (first: ${checked.issues[0].message}); an update applies to a valid experience.`)
    return
  }
  if (!isObject(update)) {
    add("not-an-object", "", `An update is a JSON object with "update", "experience", "revision" and "ops"; got ${describe(update)}.`)
    return
  }
  for (const key of Object.keys(update)) if (!UPDATE_FIELDS.includes(key)) unknownField(add as Add, seg(key), key, "the update", UPDATE_FIELDS)
  if (update.update === undefined) add("missing-field", "/update", `Say which format this is: "update": "${UPDATE_VERSION}".`)
  else if (!(UPDATE_VERSIONS as readonly unknown[]).includes(update.update)) {
    add("unsupported-version", "/update", `This Feather reads ${UPDATE_VERSION} (and ${UPDATE_VERSIONS.slice(1).join(", ")}, its name before the freeze); the update is ${quote(update.update)}.`)
    return
  }
  if (update.experience !== experience.experience) add("wrong-experience", "/experience", `The update is for ${quote(update.experience)}, not "${experience.experience}".`)
  const next = (experience.revision ?? 0) + 1
  if (update.revision === undefined) add("missing-field", "/revision", `Give the revision this update makes: ${next}.`)
  else if (typeof update.revision !== "number" || !Number.isInteger(update.revision)) add("wrong-type", "/revision", `revision is a whole number; got ${quote(update.revision)}.`)
  else if (update.revision !== next) {
    add("stale-revision", "/revision", `The experience is at revision ${next - 1}, so this update must be revision ${next}; got ${update.revision}. Send the whole experience again if the two have drifted apart.`)
  }
  if (experience.resolved) {
    add("already-resolved", "", `"${experience.experience}" is resolved (${experience.resolved.outcome}); it takes no more updates.`)
    return
  }
  if (update.ops === undefined) {
    add("missing-field", "/ops", "An update needs its ops: add, replace, patch, remove or resolve.")
    return
  }
  if (!Array.isArray(update.ops)) {
    add("wrong-type", "/ops", `ops must be an array; got ${describe(update.ops)}.`)
    return
  }
  if (update.ops.length === 0) add("empty-update", "/ops", "An update with no ops changes nothing; send at least one, or no update.")

  // Each op applies to the nodes as the ops before it left them.
  const nodes: IRNode[] = structuredClone(experience.nodes)
  const indexOf = (id: unknown) => (typeof id === "string" ? nodes.findIndex((n) => n.id === id) : -1)
  let resolved: Experience["resolved"]
  let resolvedAt = -1
  ;(update.ops as unknown[]).forEach((op, i) => {
    const at = `/ops/${i}`
    if (!isObject(op)) {
      add("not-an-object", at, `Each op is a JSON object with an "op"; got ${describe(op)}.`)
      return
    }
    const kind = typeof op.op === "string" && Object.hasOwn(OP_FIELDS, op.op) ? op.op : undefined
    if (!kind) {
      add(op.op === undefined ? "missing-field" : "unknown-op", `${at}/op`, `op is one of ${Object.keys(OP_FIELDS).join(", ")}; got ${quote(op.op)}.`)
      return
    }
    if (resolvedAt >= 0) {
      add("after-resolve", at, `Op ${i} comes after the resolve at op ${resolvedAt}; resolve is always the last op.`)
      return
    }
    if (kind !== "resolve") for (const key of Object.keys(op)) if (!OP_FIELDS[kind].includes(key)) unknownField(add as Add, `${at}${seg(key)}`, key, `a ${kind} op`, OP_FIELDS[kind])
    const nodeOf = (): IRNode | undefined => {
      if (op.node === undefined) add("missing-field", `${at}/node`, `A ${kind} op carries the node, whole.`)
      else if (!isObject(op.node)) add("wrong-type", `${at}/node`, `node must be an object; got ${describe(op.node)}.`)
      else if (typeof op.node.id !== "string") add("missing-field", `${at}/node/id`, `The node of a ${kind} op needs its id.`)
      else return op.node as unknown as IRNode
      return undefined
    }
    const existing = (key: "id") => {
      if (op[key] === undefined) add("missing-field", `${at}/${key}`, `A ${kind} op names the node it changes by its id.`)
      else if (indexOf(op[key]) < 0) add("unknown-node", `${at}/${key}`, `There is no node ${quote(op[key])} to ${kind}.`)
      else return indexOf(op[key])
      return -1
    }
    switch (kind) {
      case "add": {
        const node = nodeOf()
        if (!node) return
        if (indexOf(node.id) >= 0) {
          add("duplicate-id", `${at}/node/id`, `There is already a node "${node.id}"; replace it, or give the new node another id.`)
          return
        }
        if (op.after === undefined) nodes.push(structuredClone(node))
        else if (indexOf(op.after) < 0) add("unknown-node", `${at}/after`, `There is no node ${quote(op.after)} to add after.`)
        else nodes.splice(indexOf(op.after) + 1, 0, structuredClone(node))
        return
      }
      case "replace": {
        const node = nodeOf()
        if (!node) return
        if (indexOf(node.id) < 0) add("unknown-node", `${at}/node/id`, `There is no node "${node.id}" to replace; add it instead.`)
        else nodes[indexOf(node.id)] = structuredClone(node)
        return
      }
      case "patch": {
        const index = existing("id")
        if (op.set === undefined) add("missing-field", `${at}/set`, "A patch op carries set: the fields that change.")
        else if (!isObject(op.set)) add("wrong-type", `${at}/set`, `set must be an object; got ${describe(op.set)}.`)
        else if (Object.keys(op.set).length === 0) add("empty-update", `${at}/set`, "set is empty, so the patch changes nothing.")
        else {
          for (const key of ["id", "type"]) if (Object.hasOwn(op.set, key)) add("invalid-value", `${at}/set${seg(key)}`, `A patch never changes a node's ${key}; replace the node, or remove it and add another.`)
          if (index < 0) return
          const node = nodes[index] as unknown as Record<string, unknown>
          for (const [key, value] of Object.entries(op.set)) {
            if (key === "id" || key === "type") continue
            if (value === null) delete node[key]
            else node[key] = structuredClone(value)
          }
        }
        return
      }
      case "remove": {
        const index = existing("id")
        if (index >= 0) nodes.splice(index, 1)
        return
      }
      case "resolve": {
        const before = issues.length
        checkResolution(add as Add, op, at, "The resolve op", ["op"])
        resolvedAt = i
        if (issues.length === before) resolved = { outcome: op.outcome, summary: op.summary, ...(op.artifact !== undefined ? { artifact: structuredClone(op.artifact) } : {}) } as Experience["resolved"]
        return
      }
    }
  })

  // An update already refused is not also judged by what it would have made.
  if (issues.length > 0) return
  const result: Experience = { ...structuredClone(experience), revision: update.revision as number, nodes, ...(resolved ? { resolved } : {}) }
  const valid = validate(result)
  if (!valid.ok) {
    for (const issue of valid.issues) add(issue.code, `/result${issue.path}`, `After the update, ${issue.message.charAt(0).toLowerCase()}${issue.message.slice(1)}`)
    return
  }
  return result
}
