// @aleeforoughi/feather-page: feather.page/0, websites from a schema (docs/page.md).
export { BLOCKS, BLOCK_NAMES, EDGES, PAGE_SCHEMA, PAGE_SCHEMAS, ROUTE_VARIANTS, ANCHORS, SPEAKER_KINDS, type FieldSpec, type Fields } from "./core/spec"
export { validatePage, resolveRefs, isSafeHref, isSafeMedia } from "./core/validate"
export type { Media, PageBlock, BlockName, PageDocument, FooterEdge, PageIssue, PageLink, LoaderEdge, NavEdge, NotFoundEdge, PageResult, RouteVariant, Scene, WorkItem } from "./core/types"
export { FeatherPage, PageNotFound, PreparedPage, livingRegistry, pageScenes, type BlockLibrary, type FeatherPageProps, type PageNotFoundProps, type PreparedPageProps } from "./render"
export { Footer, NotFound, type FooterProps, type NotFoundProps } from "./blocks/edges"
export { defaultBlocks, type BlockProps } from "./blocks/index"
export { mountPage, type MountedPage } from "./mount"
