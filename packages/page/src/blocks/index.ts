import type * as React from "react"
import type { BlockName } from "../core/types"
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
// Wave 5 part A: the page blocks (media and new blocks).
import { ComparisonBlock } from "./comparison"
import { FormBlock } from "./form"
import { GalleryBlock } from "./gallery"
import { JournalBlock } from "./journal"
import { ShowreelBlock } from "./showreel"
import { StoryBlock } from "./story"
import { TestimonialsBlock } from "./testimonials"

export type { BlockProps, BlockOf } from "./shared"
export { mediaProps, mediaSrc, type FrameMedia } from "./media"
export { HeroBlock, StatementBlock, WorkBlock, CaseBlock, NumbersBlock, TimelineBlock, ProcessBlock, LogosBlock, QuoteBlock, OfferBlock, FaqBlock, ContactBlock, SignatureBlock }
export { GalleryBlock, ComparisonBlock, StoryBlock, TestimonialsBlock, JournalBlock, FormBlock, ShowreelBlock }
export { fieldProblem } from "./form"
export { journalDate } from "./journal"

/** The default block library: one component per kind of block (the /0 library, then the /1 page blocks). A brand may
 * replace any of them. */
export const defaultBlocks: { [K in BlockName]: React.ComponentType<BlockProps<K>> } = {
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
  // Wave 5 part A: the page blocks (feather.page/1 only).
  gallery: GalleryBlock,
  comparison: ComparisonBlock,
  story: StoryBlock,
  testimonials: TestimonialsBlock,
  journal: JournalBlock,
  form: FormBlock,
  showreel: ShowreelBlock,
}
