// The page-block families a document uses, and loading them, for the release runtime (a library user's FeatherPage
// imports every block statically and never comes here). The runtime reads which families the document uses, loads them
// (feather-page-media.js, feather-page-flows.js), validates the page with every rule then known (the flows' rules come
// with the flows family), and only then renders or hydrates, so the server's markup is matched by the same components:
// no flash, no mismatch.
import type { BlockName } from "../core/types"
import type { PageResult } from "../core/types"
import { validateWith, type FlowRules } from "../core/validate-core"
import type { BlockLibrary } from "../render-core"
import type { PageParts } from "./parts"

export type Family = "media" | "flows"

const MEDIA: readonly string[] = ["gallery", "comparison", "story", "testimonials", "journal", "form", "showreel"]
const FLOWS: readonly string[] = ["quiz", "booking", "calculator", "chart", "places", "podcast"]

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v)

/** The family a block kind belongs to (none for the living library, which the runtime carries). */
export function familyOf(kind: unknown): Family | null {
  return typeof kind !== "string" ? null : MEDIA.includes(kind) ? "media" : FLOWS.includes(kind) ? "flows" : null
}

/** The families a document uses, in a fixed order: by its sections' blocks, and the flows also for a page with a
 * scheme toggle or a work with views (their parts come with the flows). Read before validation, so it takes any
 * value. Prepared scenes hold only the living library. */
export function familiesOf(doc: unknown): Family[] {
  if (!isObject(doc)) return []
  const sections = Array.isArray(doc.sections) ? doc.sections.filter(isObject) : []
  const used = new Set(sections.map((b) => familyOf(b.block)).filter((f): f is Family => f !== null))
  if (doc.scheme !== undefined || sections.some((b) => b.block === "work" && b.views !== undefined)) used.add("flows")
  return (["media", "flows"] as const).filter((f) => used.has(f))
}

export interface PageFamilies {
  blocks: Partial<BlockLibrary>
  parts: PageParts
}

/** The flows' rules, once their family has loaded. */
let loadedFlowRules: FlowRules | null = null

const loadMedia = () => import("./media-family")
const loadFlows = () =>
  import("./flow-family").then((m) => {
    loadedFlowRules = m.flowRules
    return m
  })

/** The blocks and parts of every family a document uses, loaded. */
export async function loadPageBlocks(doc: unknown): Promise<PageFamilies> {
  const families = familiesOf(doc)
  const [media, flows] = await Promise.all([families.includes("media") ? loadMedia() : null, families.includes("flows") ? loadFlows() : null])
  const blocks: Partial<Record<BlockName, unknown>> = { ...media?.mediaBlocks, ...flows?.flowBlocks }
  return { blocks: blocks as Partial<BlockLibrary>, parts: flows?.flowParts ?? {} }
}

/** validatePage with every rule loaded so far: the core's always, the flows' once loadPageBlocks has brought them (as
 * it does for any document that uses a flow). */
export function validateLoaded(input: unknown): PageResult {
  return validateWith(input, loadedFlowRules)
}
