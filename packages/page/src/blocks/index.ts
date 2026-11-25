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
// Product flows (wave 5).
import { BookingBlock } from "./booking"
import { CalculatorBlock } from "./calculator"
import { ChartBlock } from "./chart"
import { PlacesBlock } from "./places"
import { PodcastBlock } from "./podcast"
import { QuizBlock } from "./quiz"

export type { BlockProps, BlockOf } from "./shared"
export { mediaProps, mediaSrc, type FrameMedia } from "./media"
export { HeroBlock, StatementBlock, WorkBlock, CaseBlock, NumbersBlock, TimelineBlock, ProcessBlock, LogosBlock, QuoteBlock, OfferBlock, FaqBlock, ContactBlock, SignatureBlock }
export { QuizBlock, BookingBlock, CalculatorBlock, ChartBlock, PlacesBlock, PodcastBlock }

/** The default block library: one component per kind of `feather.page/0` block. A brand may replace any of them. */
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
  // Product flows (wave 5).
  quiz: QuizBlock,
  booking: BookingBlock,
  calculator: CalculatorBlock,
  chart: ChartBlock,
  places: PlacesBlock,
  podcast: PodcastBlock,
}
