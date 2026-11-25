// The Living Page's library as components: the blocks every page may hold, and the only ones the release runtime
// carries in itself. The page blocks are families of their own (media-family.ts, flow-family.ts), which the runtime
// loads only for a page that uses one (families.ts).
import type * as React from "react"
import type { BlockProps } from "./shared"
import { CaseBlock } from "./case"
import { ContactBlock } from "./contact"
import { FaqBlock } from "./faq"
import { HeroBlock } from "./hero"
import { LogosBlock } from "./logos"
import { NumbersBlock } from "./numbers"
import { OfferBlock } from "./offer"
import { ProcessBlock } from "./process"
import { QuoteBlock } from "./quote"
import { SignatureBlock } from "./signature"
import { StatementBlock } from "./statement"
import { TimelineBlock } from "./timeline"
import { WorkBlock } from "./work"

export type CoreKind = "hero" | "statement" | "work" | "case" | "numbers" | "timeline" | "process" | "logos" | "quote" | "offer" | "faq" | "contact" | "signature"

export const coreBlocks: { [K in CoreKind]: React.ComponentType<BlockProps<K>> } = {
  hero: HeroBlock,
  statement: StatementBlock,
  work: WorkBlock,
  case: CaseBlock,
  numbers: NumbersBlock,
  timeline: TimelineBlock,
  process: ProcessBlock,
  logos: LogosBlock,
  quote: QuoteBlock,
  offer: OfferBlock,
  faq: FaqBlock,
  contact: ContactBlock,
  signature: SignatureBlock,
}
