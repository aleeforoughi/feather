// @aleeforoughi/feather-page: feather.page/0, websites from a schema (docs/page.md).
export { BLOCKS, BLOCK_NAMES, EDGES, PAGE_SCHEMA, PAGE_SCHEMAS, ROUTE_VARIANTS, ANCHORS, SPEAKER_KINDS, type FieldSpec, type Fields } from "./core/spec"
export { BLOCK_RANGE, KNOB_FIELDS, PAGE_KNOBS, LOUDNESS, TONES, SPACES, SCALES, CROPS, ALIGNS, ENTERS, KINETIC_ENTERS, DIRECTIONS, STAGGERS, SCROLL_PATTERNS, PINNED_PATTERNS, SCENE_KINDS, SCENE_PRESETS, SCENE_QUALITIES, SCENE_BLOCKS, THREE_SCENES, blockFields, type BlockRange } from "./core/spec"
export { validatePage, resolveRefs, isSafeHref, isSafeMedia } from "./core/validate"
export type { Knobs, Loudness, BlockTone, BlockSpace, BlockAlign, BlockScale, BlockCrop, BlockMotion, BlockScroll, MotionEnter, ScrollPattern, PageDefaults, HeroVariant, StatementVariant, WorkVariant, CaseVariant, NumbersVariant, TimelineVariant, ProcessVariant, LogosVariant, QuoteVariant, OfferVariant, QuoteItem, BlockScene, SceneKind, SceneQuality, SceneHotspot, SceneVariant, ShaderScenePreset, ParticleScenePreset } from "./core/types"
export type { Media, PageBlock, BlockName, PageDocument, FooterEdge, PageIssue, PageLink, LoaderEdge, NavEdge, NotFoundEdge, PageResult, RouteVariant, Scene, WorkItem } from "./core/types"
export { FeatherPage, PageNotFound, PreparedPage, livingRegistry, pageScenes, type BlockLibrary, type FeatherPageProps, type PageNotFoundProps, type PreparedPageProps } from "./render"
export { Footer, NotFound, type FooterProps, type NotFoundProps } from "./blocks/edges"
export { defaultBlocks, type BlockProps } from "./blocks/index"
export { mountPage, type MountedPage } from "./mount"
export { SceneLayer, type SceneLayerProps } from "./blocks/scene"
// Wave 5 part A: media and the page blocks (feather.page/1 only).
export { PAGE_BLOCKS, PAGE_BLOCK_NAMES, TREATMENTS, MOVING_TREATMENTS, FORM_FIELD_TYPES } from "./core/spec"
export type { MediaTreatmentKnob, GalleryVariant, GalleryItem, StoryVariant, StoryStep, TestimonialsVariant, JournalVariant, JournalEntry, FormVariant, FormField, FormFieldType, PageOnlyBlock } from "./core/types"
export { GalleryBlock, ComparisonBlock, StoryBlock, TestimonialsBlock, JournalBlock, FormBlock, ShowreelBlock, fieldProblem, journalDate } from "./blocks/index"
// Image widths: the sizes Feather derives for a media srcset, by where the image sits.
export { MEDIA_SIZES, contentSizes, sizesOf, type MediaPlace, type Share } from "./blocks/sizes"
export { srcsetOf } from "./blocks/media"
export type { MediaSrcset } from "./core/types"
