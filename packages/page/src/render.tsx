// FeatherPage: a validated feather.page document, rendered as a complete website in the brand's tokens, with the
// Living Page layered on when the document has one (render-core.tsx). This is the library's FeatherPage: every block,
// the page blocks included, is imported statically. The release runtime renders FeatherPageCore instead, and loads the
// page-block families a page uses before it hydrates (blocks/families.ts).
import * as React from "react"
import { flowBlocks, flowParts } from "./blocks/flow-family"
import { mediaBlocks } from "./blocks/media-family"
import { FeatherPageCore, PageNotFoundCore, type BlockLibrary, type FeatherPageProps, type PageNotFoundProps } from "./render-core"

export { FeatherPageCore, PageNotFoundCore, PreparedPage, livingRegistry, pageScenes, fontFaces, checkLayout, type BlockLibrary, type FeatherPageProps, type PageNotFoundProps, type PreparedPageProps } from "./render-core"

const PAGE_BLOCKS: Partial<BlockLibrary> = { ...mediaBlocks, ...flowBlocks } as Partial<BlockLibrary>

export function FeatherPage({ blocks, parts, ...props }: FeatherPageProps) {
  const library = React.useMemo(() => ({ ...PAGE_BLOCKS, ...blocks }), [blocks])
  return <FeatherPageCore {...props} blocks={library} parts={parts ?? flowParts} />
}

/** The page's 404 route: its nav, the notFound scene and its footer, in the brand. */
export function PageNotFound({ parts, ...props }: PageNotFoundProps) {
  return <PageNotFoundCore {...props} parts={parts ?? flowParts} />
}
