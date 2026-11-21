// The block registry: maps block kinds, and IR nodes, to the brand's designed blocks, so an answer is always built
// from the page's own library. A kind the brand has not designed falls back to its Statement block, never to a
// one-off. Generic over the renderer, so the same rules hold for React and for a static build.
import type { IRNode, NodeType } from "@aleeforoughi/feather-intent"
import { BLOCK_KINDS, isBlockKind, type Block, type BlockKind } from "./blocks"
import { MAX_BLOCKS } from "./conversation"

export interface Registry<R> {
  /** The renderer of a block kind; the Statement renderer for a kind the brand has not designed. */
  renderer(kind: BlockKind): R
  /** The kinds the brand designed. */
  readonly kinds: BlockKind[]
  /** An IR node as a block of the library (or null when the brand maps nothing for its type). */
  fromNode(node: IRNode): Block | null
}

/** IR node types to the library block that shows them best, by default. A brand may override any. */
export const DEFAULT_IR_MAP: Partial<Record<NodeType, (node: IRNode) => Block>> = {
  Text: (n) => ({ block: "statement", id: n.id, title: textOf(n) }),
  Media: (n) => ({ block: "case", id: n.id, title: n.intent, media: (n as { src?: string }).src }),
  Comparison: (n) => ({ block: "numbers", id: n.id, title: n.intent }),
  Recommendation: (n) => ({ block: "work", id: n.id, title: n.intent }),
  Progress: (n) => ({ block: "process", id: n.id, title: n.intent }),
  Person: (n) => ({ block: "contact", id: n.id, title: n.intent }),
  Action: (n) => ({ block: "contact", id: n.id, title: n.intent }),
}

function textOf(n: IRNode): string {
  const v = (n as { text?: unknown; body?: unknown }).text ?? (n as { body?: unknown }).body
  return typeof v === "string" ? v : (n.intent ?? "")
}

export function createRegistry<R>(blocks: Partial<Record<BlockKind, R>> & { statement: R }, ir: Partial<Record<NodeType, (node: IRNode) => Block>> = DEFAULT_IR_MAP): Registry<R> {
  const kinds = BLOCK_KINDS.filter((k) => blocks[k] !== undefined)
  return {
    kinds,
    renderer: (kind) => blocks[kind] ?? blocks.statement,
    fromNode: (node) => ir[node.type]?.(node) ?? null,
  }
}

/** Problems with the blocks of one answer: one to three, each from the library. */
export function checkAnswerBlocks(blocks: unknown[]): string[] {
  const problems: string[] = []
  if (blocks.length > MAX_BLOCKS) problems.push(`an answer brings at most ${MAX_BLOCKS} blocks, got ${blocks.length}`)
  blocks.forEach((b, i) => {
    if (!b || typeof b !== "object" || !isBlockKind((b as Block).block)) problems.push(`blocks[${i}] is not a block of the library (${BLOCK_KINDS.join(", ")})`)
  })
  return problems
}
