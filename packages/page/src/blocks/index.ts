import type * as React from "react"
import type { BlockName } from "../core/types"
import type { BlockProps } from "./shared"
import { coreBlocks } from "./core"
import { mediaBlocks } from "./media-family"
import { flowBlocks } from "./flow-family"

export type { BlockProps, BlockOf } from "./shared"
export { mediaProps, mediaSrc, type FrameMedia } from "./media"
export { HeroBlock } from "./hero"
export { StatementBlock } from "./statement"
export { WorkBlock } from "./work"
export { CaseBlock } from "./case"
export { NumbersBlock } from "./numbers"
export { TimelineBlock } from "./timeline"
export { ProcessBlock } from "./process"
export { LogosBlock } from "./logos"
export { QuoteBlock } from "./quote"
export { OfferBlock } from "./offer"
export { FaqBlock } from "./faq"
export { ContactBlock } from "./contact"
export { SignatureBlock } from "./signature"
// Wave 5 part A: the page blocks (media and new blocks).
export { GalleryBlock } from "./gallery"
export { ComparisonBlock } from "./comparison"
export { StoryBlock } from "./story"
export { TestimonialsBlock } from "./testimonials"
export { JournalBlock } from "./journal"
export { FormBlock, fieldProblem } from "./form"
export { ShowreelBlock } from "./showreel"
export { journalDate } from "./journal"
// Product flows (wave 5 part B): page blocks too.
export { QuizBlock } from "./quiz"
export { BookingBlock } from "./booking"
export { CalculatorBlock } from "./calculator"
export { ChartBlock } from "./chart"
export { PlacesBlock } from "./places"
export { PodcastBlock } from "./podcast"
export { coreBlocks, mediaBlocks, flowBlocks }

/** The default block library: one component per kind of block (the /0 library, then the /1 page blocks: the media
 * family and the product flows). A brand may replace any of them. */
export const defaultBlocks: { [K in BlockName]: React.ComponentType<BlockProps<K>> } = { ...coreBlocks, ...mediaBlocks, ...flowBlocks }
