// The page-level parts of the product flows that are not blocks: the scheme toggle (in the nav or the footer) and the
// work's view switch. The library's FeatherPage provides them; the release runtime provides them once the flows family
// has loaded, which it does for any page with a scheme or a work with views (blocks/families.ts).
import * as React from "react"
import type { WorkItem } from "../core/types"
import type { BlockOf } from "./shared"

export interface PageParts {
  SchemeToggle?: React.ComponentType<{ place: "nav" | "footer" }>
  WorkViews?: React.ComponentType<{ block: BlockOf<"work">; items: WorkItem[] }>
}
export const PagePartsContext = React.createContext<PageParts>({})
