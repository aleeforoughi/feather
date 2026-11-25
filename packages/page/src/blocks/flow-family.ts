// The product flows (wave 5 part B): the page blocks the release runtime loads as feather-page-flows.js, only for a page
// whose document holds one of them.
import type * as React from "react"
import type { BlockProps } from "./shared"
import { BookingBlock } from "./booking"
import { CalculatorBlock } from "./calculator"
import { ChartBlock } from "./chart"
import { PlacesBlock } from "./places"
import { PodcastBlock } from "./podcast"
import { QuizBlock } from "./quiz"
import type { PageParts } from "./parts"
import { FLOW_RULES } from "../core/validate"
import { SchemeToggle } from "./scheme"
import { WorkViews } from "./views"

export type FlowKind = "quiz" | "booking" | "calculator" | "chart" | "places" | "podcast"

export const flowBlocks: { [K in FlowKind]: React.ComponentType<BlockProps<K>> } = {
  quiz: QuizBlock,
  booking: BookingBlock,
  calculator: CalculatorBlock,
  chart: ChartBlock,
  places: PlacesBlock,
  podcast: PodcastBlock,
}

/** The flows' page-level parts: the scheme toggle and the work's view switch. */
export const flowParts: Required<PageParts> = { SchemeToggle, WorkViews }

/** The flows' validation rules (validate-flows.ts), which the release runtime's validator takes once this has loaded. */
export const flowRules = FLOW_RULES
