// @aleeforoughi/feather-page: feather.page/0, websites from a schema (docs/page.md).
export { BLOCKS, BLOCK_NAMES, PAGE_SCHEMA, ANCHORS, SPEAKER_KINDS, type FieldSpec, type Fields } from "./core/spec"
export { validatePage, resolveRefs, isSafeHref, isSafeMedia } from "./core/validate"
export type { Media, PageBlock, BlockName, PageDocument, PageIssue, PageResult, Scene, WorkItem } from "./core/types"
export { FeatherPage, PreparedPage, livingRegistry, pageScenes, type BlockLibrary, type FeatherPageProps, type PreparedPageProps } from "./render"
export { defaultBlocks, type BlockProps } from "./blocks/index"
export { mountPage, type MountedPage } from "./mount"
