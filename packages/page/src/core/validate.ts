// validatePage: a feather.page/0 or /1 document in, the page or every issue out, with every rule: the core's
// (validate-core.ts) and the product flows' (validate-flows.ts).
import type { PageResult } from "./types"
import { checkFlowBlock, checkScheme, checkViews } from "./validate-flows"
import { validateWith, type FlowRules } from "./validate-core"

export { isSafeHref, isSafeMedia, resolveRefs, validateWith, SRCSET_MAX, SRCSET_MAX_WIDTH, type FlowRules } from "./validate-core"

/** Every product-flow rule, as validateWith takes them. */
export const FLOW_RULES: FlowRules = { checkFlowBlock, checkScheme, checkViews }

export function validatePage(input: unknown): PageResult {
  return validateWith(input, FLOW_RULES)
}
