// @aleeforoughi/feather-page/runtime: what the release's browser runtime is built from. FeatherPageCore carries only
// the Living Page's library; loadPageBlocks brings the page-block families (media, flows) a document uses, as chunks of
// their own, so a plain page never downloads them; validateLoaded checks a page with every rule loaded so far (the
// flows' rules come with the flows family).
export { FeatherPageCore, PageNotFoundCore, PreparedPage, type BlockLibrary, type FeatherPageProps } from "./render-core"
export { validateLoaded } from "./blocks/families"
export { mountPage, type MountedPage } from "./mount"
export { familiesOf, familyOf, loadPageBlocks, type Family, type PageFamilies } from "./blocks/families"
export type { PageParts } from "./blocks/parts"
export type { PageDocument, PageResult } from "./core/types"
