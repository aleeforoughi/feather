// The feather.page/0 document, as TypeScript. Mirrors spec.ts by hand (the validator is the authority).

export type Media = string | { src: string; alt?: string; poster?: string; sources?: { src: string; type: string }[]; decorative?: boolean }

export interface WorkItem {
  id: string
  title: string
  summary?: string
  media?: Media
  href?: string
  year?: string
  role?: string
}

/** The knobs (feather.page/1, wave 2). spec.ts says what each means and which blocks take which values. */
export type Loudness = 0 | 1 | 2 | 3
export type BlockTone = "base" | "subtle" | "raised" | "inverse" | "block-1" | "block-2" | "block-3" | "block-4"
export type BlockSpace = "s" | "m" | "l" | "xl"
export type BlockAlign = "start" | "center" | "offset" | "split"
export type BlockScale = "s" | "m" | "l" | "xl"
export type BlockCrop = "none" | "edge" | "bleed"
export type MotionEnter = "none" | "fade" | "rise" | "mask" | "skew" | "oval" | "blink" | "scramble"
export type ScrollPattern = "reveal" | "parallax" | "stack" | "horizontal" | "scale" | "pin"
export interface BlockMotion {
  enter?: MotionEnter
  /** 0 to 1: scales the travel of the reveal, never its duration. */
  intensity?: number
  direction?: "up" | "down" | "left" | "right"
  stagger?: "none" | "tight" | "default" | "loose"
}
export interface BlockScroll {
  pattern?: ScrollPattern
  /** Pin length in viewport heights, 1 to 4 (pinned patterns). */
  length?: number
  /** Settle on a pin's steps. */
  snap?: boolean
}
export interface Knobs {
  loudness?: Loudness
  tone?: BlockTone
  space?: BlockSpace
  align?: BlockAlign
  scale?: BlockScale
  crop?: BlockCrop
  motion?: BlockMotion
  scroll?: BlockScroll
}

/** A 3D or WebGL scene (feather.page/1, wave 4) on a hero (interactive), case or signature. spec.ts says what each
 * kind and preset is. The scene is decoration over the block's poster; the meaning stays in the DOM. */
export type SceneKind = "shader" | "particles" | "depth" | "model" | "rail"
export type ShaderScenePreset = "gradient-noise" | "aurora" | "grain-field" | "flow"
export type ParticleScenePreset = "dust" | "field" | "morph"
export type SceneQuality = "auto" | "high" | "medium" | "low" | "poster"
export interface SceneHotspot {
  id: string
  /** In the model's own coordinates. */
  position: [number, number, number]
  /** The button's name and text. */
  label: string
}
export interface SceneVariant {
  id: string
  label: string
  /** Material name in the GLB → a colour: a theme variable (`--accent`) or a CSS colour. */
  colors: Record<string, string>
}
export interface BlockScene {
  kind: SceneKind
  preset?: ShaderScenePreset | ParticleScenePreset
  quality?: SceneQuality
  /** The GLB (model). */
  model?: Media
  /** The depth map of the block's media (depth): white near. */
  depth?: Media
  hotspots?: SceneHotspot[]
  variants?: SceneVariant[]
}

interface Base extends Knobs {
  id?: string
  title?: string
}
export type HeroVariant = "stacked" | "giant-type" | "split" | "film" | "product" | "index" | "interactive"
export type StatementVariant = "plain" | "centred" | "offset" | "marquee" | "fill" | "swap"
export type WorkVariant = "grid" | "hover-list" | "stack" | "rail"
export type CaseVariant = "editorial" | "scale"
export type NumbersVariant = "counter" | "plain" | "lead"
export type TimelineVariant = "list" | "horizontal"
export type ProcessVariant = "list" | "pinned" | "rows"
export type LogosVariant = "grid" | "marquee"
export type QuoteVariant = "large" | "rail" | "pull"
export type OfferVariant = "cards" | "table"
export interface QuoteItem {
  text: string
  by: string
  role?: string
}
export type PageBlock =
  | (Base & { block: "hero"; variant?: HeroVariant; title: string; eyebrow?: string; lede?: string; media?: Media; starters?: string[]; facts?: { label: string; value: string }[]; actions?: PageLink[]; scene?: BlockScene })
  | (Base & { block: "statement"; variant?: StatementVariant; title: string; body?: string; words?: string[] })
  | (Base & { block: "work"; variant?: WorkVariant; items: Array<string | WorkItem>; views?: ViewMode })
  | (Base & { block: "case"; variant?: CaseVariant; title: string; body?: string; media?: Media; facts?: { label: string; value: string }[]; scene?: BlockScene })
  | (Base & { block: "numbers"; variant?: NumbersVariant; items: { value: number; unit?: string; label: string }[] })
  | (Base & { block: "timeline"; variant?: TimelineVariant; items: { when: string; what: string }[] })
  | (Base & { block: "process"; variant?: ProcessVariant; steps: { title: string; body?: string }[] })
  | (Base & { block: "logos"; variant?: LogosVariant; items: { name: string; src?: Media }[] })
  | (Base & { block: "quote"; variant?: QuoteVariant; text: string; by: string; role?: string; items?: QuoteItem[] })
  | (Base & { block: "offer"; variant?: OfferVariant; items: { name: string; price?: string; body?: string; href?: string }[] })
  | (Base & { block: "faq"; variant?: "list"; items: { q: string; a: string }[] })
  | (Base & { block: "contact"; variant?: "plain"; body?: string; actions?: { label: string; href: string }[] })
  | (Base & { block: "signature"; body?: string; media?: Media; variant?: string; scene?: BlockScene })
  // Product flows (feather.page/1, wave 5).
  | FlowBlock

export type BlockName = PageBlock["block"]

// ---- Product flows (feather.page/1, wave 5; the flows section of spec.ts says what each field means) ------------------------------
export type ViewMode = "grid" | "list" | "index"
export interface QuizOptionSpec {
  id: string
  label: string
  result?: string
  score?: number
}
export interface QuizQuestionSpec {
  id: string
  q: string
  help?: string
  options: QuizOptionSpec[]
}
export interface QuizResultSpec {
  id: string
  title: string
  body?: string
  href?: string
  label?: string
  min?: number
  max?: number
  match?: Record<string, string>
}
export interface BookingService {
  id: string
  name: string
  duration?: string
  price?: string
  body?: string
}
export interface BookingDay {
  /** YYYY-MM-DD. */
  date: string
  /** The day in words (default "Monday 1 December", in English). */
  label?: string
  /** Times of day, HH:MM. */
  slots: string[]
}
export interface CalculatorInputSpec {
  id: string
  label: string
  kind: "range" | "number" | "radio" | "toggle"
  min?: number
  max?: number
  step?: number
  value?: number
  unit?: string
  help?: string
  options?: { label: string; value: number }[]
}
export interface PlaceItem {
  name: string
  address: string
  directions?: string
  href?: string
  phone?: string
  hours?: string
  note?: string
}
export interface PodcastEpisode {
  id: string
  title: string
  audio: Media
  duration?: string
  date?: string
  summary?: string
  chapters?: { at: number; title: string }[]
  transcript: { at?: number; by?: string; text: string }[]
}
export type ChartVariant = "bar" | "line" | "area"
export type FlowBlock =
  | (Base & { block: "quiz"; variant?: "steps"; title: string; body?: string; scoring?: "tally" | "score"; questions: QuizQuestionSpec[]; results: QuizResultSpec[] })
  | (Base & { block: "booking"; variant?: "steps"; title: string; body?: string; services: BookingService[]; days: BookingDay[]; zone?: string; ask?: { phone?: boolean; note?: boolean }; action?: string; mailto?: string; link?: string; confirm?: string })
  | (Base & { block: "calculator"; variant?: "split" | "stacked"; title: string; body?: string; inputs: CalculatorInputSpec[]; lines?: { id?: string; label: string; formula: string }[]; formula: string; total?: string; prefix?: string; suffix?: string; decimals?: number; note?: string })
  | (Base & { block: "chart"; variant?: ChartVariant; title: string; summary: string; series: { label: string }[]; rows: { label: string; values: number[] }[]; axis?: string; unit?: string; prefix?: string; decimals?: number; source?: string })
  | (Base & { block: "places"; variant?: "list" | "map"; title: string; body?: string; media?: Media; items: PlaceItem[] })
  | (Base & { block: "podcast"; variant?: "list"; title: string; body?: string; episodes: PodcastEpisode[] })
/** The page's colour scheme toggle: the brand's other colour set, and where the toggle sits. */
export interface PageScheme {
  toggle?: "nav" | "footer"
  colors: { background: string; surface: string; text: string; primary: string; primaryText?: string; accent?: string; accentText?: string; destructive?: string }
}

export interface Scene {
  /** The starter label, in the visitor's words. */
  ask: string
  /** The spoken line, in the speaker's voice. */
  line: string
  blocks: PageBlock[]
  asks?: string[]
}

export interface PageLink {
  label: string
  href: string
}

/** The page edges (feather.page/1). */
export interface NavEdge {
  /** The wordmark in the bar (default the page title). */
  brand?: string
  /** The landmark's name (default "Site"). */
  label?: string
  items: PageLink[]
}
export interface FooterEdge {
  variant?: "plain" | "wordmark" | "reveal"
  wordmark?: string
  body?: string
  links?: PageLink[]
  note?: string
}
export interface NotFoundEdge {
  variant?: "type" | "minimal"
  title?: string
  body?: string
  /** At most one link; default the site root. */
  home?: PageLink[]
}
export interface LoaderEdge {
  variant?: "counter" | "dock"
  label?: string
  sound?: boolean
}
export type RouteVariant = "none" | "fade" | "view" | "push" | "slide" | "sheets" | "circle" | "columns"

export interface PageDocument {
  schema: "feather.page/0" | "feather.page/1"
  /** A path to the brand's feather-tokens file, or the tokens inline. */
  brand: string | Record<string, unknown>
  title?: string
  description?: string
  lang?: string
  speaker?: { kind: "person" | "company" | "product"; name: string; voice?: string }
  library?: { work?: Record<string, Omit<WorkItem, "id">> }
  sections: PageBlock[]
  scenes?: Record<string, Scene>
  living?: { anchor?: "reader" | "end"; fold?: boolean; prepared?: string[]; disclosure?: string }
  nav?: NavEdge
  footer?: FooterEdge
  notFound?: NotFoundEdge
  loader?: LoaderEdge
  /** How a route arrives (default "fade"). */
  transition?: RouteVariant
  /** The pointer follower (wave 3): off ("native") by default. */
  cursor?: "native" | "follower"
  sound?: { bed: Media }
  /** The page's loudness (feather.page/1): a ceiling every block inherits unless it sets its own. */
  loudness?: Loudness
  /** Defaults a block takes when it sets none (an align or crop a block does not take is ignored for it). */
  defaults?: PageDefaults
  /** The colour scheme toggle (wave 5): light, dark and system. */
  scheme?: PageScheme
}

export interface PageDefaults {
  space?: BlockSpace
  align?: BlockAlign
  scale?: BlockScale
  crop?: BlockCrop
}

export interface PageIssue {
  /** A JSON pointer into the document. */
  path: string
  code: "wrong-schema" | "needs-schema-1" | "unknown-variant" | "out-of-range" | "unsupported" | "contradiction" | "not-object" | "missing" | "type" | "too-long" | "unknown-block" | "unknown-field" | "too-few" | "too-many" | "bad-href" | "bad-media" | "unknown-ref" | "unknown-scene" | "duplicate-id" | "no-speaker" | "bad-formula"
  message: string
}

export type PageResult = { ok: true; page: PageDocument } | { ok: false; issues: PageIssue[] }
