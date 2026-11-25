// The media family (wave 5 part A): the page blocks the release runtime loads as feather-page-media.js, only for a page
// whose document holds one of them.
import type * as React from "react"
import type { BlockProps } from "./shared"
import { ComparisonBlock } from "./comparison"
import { FormBlock } from "./form"
import { GalleryBlock } from "./gallery"
import { JournalBlock } from "./journal"
import { ShowreelBlock } from "./showreel"
import { StoryBlock } from "./story"
import { TestimonialsBlock } from "./testimonials"

export type MediaKind = "gallery" | "comparison" | "story" | "testimonials" | "journal" | "form" | "showreel"

export const mediaBlocks: { [K in MediaKind]: React.ComponentType<BlockProps<K>> } = {
  gallery: GalleryBlock,
  comparison: ComparisonBlock,
  story: StoryBlock,
  testimonials: TestimonialsBlock,
  journal: JournalBlock,
  form: FormBlock,
  showreel: ShowreelBlock,
}
