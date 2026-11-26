import * as React from "react"
import { mediaScale, prefersReducedMotion } from "../core/motion"
import { reveal } from "../core/reveal"
import { scrub, supportsScrollTimeline } from "../core/scroll"
import { useMergedRef, useReducedMotion } from "../hooks"
import { loudnessAllows } from "./loudness"
import { cn } from "../cn"

export type MediaAspect = "16/9" | "4/3" | "1/1" | "3/4" | "4/5" | "21/9"
export type MediaRadius = "card" | "dialog" | "control" | "none"
/** How the frame is painted before its media has decoded: the theme's surface (default), or the media scrim (film,
 * where text sits on the frame and must read before the first frame arrives). */
export type MediaPlaceholder = "surface" | "scrim"
/**
 * An image treatment: decoration on the media, never a change to what it says (the alt text stays the content).
 * - clean: none (the default).
 * - clip-reveal: the image is uncovered top to bottom as it enters (needs loudness 1).
 * - inner-parallax: the image drifts inside its frame as the frame crosses the view (needs loudness 2).
 * - blur-to-sharp: the image arrives soft and sharpens once it has decoded (needs loudness 1).
 * - duotone: the image in the brand's two inks, the primary and the surface.
 * - grain: a still film grain over the image.
 * The moving ones rest in their end state under reduced motion, below their loudness, without script and on the
 * priority (LCP) image; duotone and grain are still, and hold everywhere.
 */
export type MediaTreatment = "clean" | "clip-reveal" | "inner-parallax" | "blur-to-sharp" | "duotone" | "grain"
export const MEDIA_TREATMENTS: readonly MediaTreatment[] = ["clean", "clip-reveal", "inner-parallax", "blur-to-sharp", "duotone", "grain"]
/** How far the inner parallax drifts either way (percent of the frame), and the scale that keeps the edges covered. */
export const INNER_PARALLAX = { travel: 6, scale: 1.14 } as const
/** The grain treatment's opacity floor: stronger than a film brand's page grain, so it reads on a photograph. */
export const MEDIA_GRAIN = 0.16

const RADIUS: Record<MediaRadius, string> = { card: "rounded-card", dialog: "rounded-dialog", control: "rounded-control", none: "" }
// The placeholder is the frame's own background; foundation.css drops it once the frame is ready (data-state).
const PLACEHOLDER: Record<MediaPlaceholder, string> = { surface: "bg-surface-subtle", scrim: "media-placeholder-scrim" }

export interface MediaSource {
  src: string
  /** The MIME type: image/avif, image/webp, video/mp4; codecs="hvc1", video/webm; codecs="vp9"... */
  type: string
  /** An image source's widths ("a-800.avif 800w, a-1600.avif 1600w"), chosen with the frame's `sizes`. */
  srcSet?: string
}

export interface MediaVideo {
  autoPlay?: boolean
  muted?: boolean
  loop?: boolean
  playsInline?: boolean
  /** The still shown before it plays, and always under reduced motion. */
  poster?: string
  /** The clip's length in seconds. A loop of more than 5s (or of unknown length) gets a visible pause button. */
  duration?: number
}

export interface MediaFrameProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  aspect?: MediaAspect
  radius?: MediaRadius
  /** The LCP image: eager, high fetch priority, never lazy. Everything else is lazy. */
  priority?: boolean
  /** The image (its fallback `src`) or the video's first source. */
  src?: string
  /** `<picture>` sources for an image (AVIF, WebP), or `<video>` sources (HEVC, VP9, H.264). */
  sources?: MediaSource[]
  /** Required for an image unless `decorative`. */
  alt?: string
  /** An image that adds nothing for a reader: alt is empty. */
  decorative?: boolean
  /** Renders a video instead of an image. */
  video?: MediaVideo
  width?: number
  height?: number
  /** The theme colour the frame shows until its media decodes (a CSS background, so it holds with no script). */
  placeholder?: MediaPlaceholder
  /** An image treatment (images only: a video is always clean). */
  treatment?: MediaTreatment
  /** The image's widths ("a-800.jpg 800w, a-1600.jpg 1600w"): the browser picks the smallest that fills the frame. */
  srcSet?: string
  /** How wide the frame is drawn, for `srcSet` (its caller knows where the frame sits). Written only with a srcSet. */
  sizes?: string
}

const PAUSE_AFTER = 5

// The moving treatments on the browser's own scroll timeline where it has one (off the main thread): the image is
// uncovered as the frame enters, or drifts as it crosses. Only while the frame says so (data-treatment-state="css"),
// which it does only with motion allowed; without the timeline the reveal role and the one clock do the same. The
// blur is set only by script, once the frame knows its image has not decoded yet, so no script never blurs.
const TREATMENT_CSS = `@keyframes feather-media-clip {
  from { clip-path: inset(0 0 100% 0); }
  to { clip-path: inset(0 0 0 0); }
}
@keyframes feather-media-drift {
  from { transform: translate3d(0, -${INNER_PARALLAX.travel}%, 0) scale(${INNER_PARALLAX.scale}); }
  to { transform: translate3d(0, ${INNER_PARALLAX.travel}%, 0) scale(${INNER_PARALLAX.scale}); }
}
@media (prefers-reduced-motion: no-preference) {
  [data-slot="media-frame"][data-treatment="blur-to-sharp"] [data-slot="media-frame-media"] {
    transition-property: filter;
    transition-duration: var(--duration-media);
    transition-timing-function: var(--ease-signature);
  }
  [data-slot="media-frame"][data-treatment="blur-to-sharp"][data-state="loading"] [data-slot="media-frame-media"] {
    filter: blur(1.5rem);
  }
}
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    [data-slot="media-frame"][data-treatment-state="css"] { view-timeline-name: --feather-media; }
    [data-slot="media-frame"][data-treatment="clip-reveal"][data-treatment-state="css"] [data-slot="media-frame-media"] {
      animation: feather-media-clip linear both;
      animation-duration: auto;
      animation-timeline: --feather-media;
      animation-range: entry 0% cover 40%;
    }
    [data-slot="media-frame"][data-treatment="inner-parallax"][data-treatment-state="css"] [data-slot="media-frame-media"] {
      animation: feather-media-drift linear both;
      animation-duration: auto;
      animation-timeline: --feather-media;
      animation-range: cover 0% cover 100%;
    }
  }
}`

function Glyph({ playing }: { playing: boolean }) {
  return (
    <svg data-slot="media-frame-glyph" aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="currentColor">
      {playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M5 3l8 5-8 5z" />}
    </svg>
  )
}

/** Where a moving treatment runs: on the browser's scroll timeline ("css"), on the reveal role or the clock
 * ("script"), or not at all (null: it rests in its end state). */
type TreatmentState = "css" | "script" | null

/**
 * MediaFrame: one framing rule for images and video. A fixed aspect, a 1px edge, an overflow clip and a hover scale
 * (from 1, never from 0). The LCP image is `priority`; the rest load lazily. Until its media decodes the frame shows a
 * placeholder from the theme (`placeholder`: the surface, or the scrim for film), so it is never an empty box and
 * nothing shifts: a CSS background, removed once the media is ready, that holds with no script. A video that loops
 * longer than 5s has a real pause button. Under reduced motion there is no hover scale and a video does not autoplay
 * (poster and a play button). `treatment` adds an image treatment (MediaTreatment).
 */
export const MediaFrame = React.forwardRef<HTMLDivElement, MediaFrameProps>(function MediaFrame(
  { aspect = "16/9", radius = "card", priority = false, src, sources, alt, decorative = false, video, width, height, placeholder = "surface", treatment = "clean", srcSet, sizes, className, style, ...props },
  forwarded
) {
  const root = React.useRef<HTMLDivElement>(null)
  const ref = useMergedRef(forwarded, root)
  const player = React.useRef<HTMLVideoElement>(null)
  const image = React.useRef<HTMLImageElement>(null)
  const reduced = useReducedMotion(root)
  // The hover scale, measured when the pointer enters (never read from a ref during render). 0 means "not hovered".
  const [hoverScale, setHoverScale] = React.useState(0)
  const hovered = hoverScale > 0
  // Playing follows the element's own play/pause events, so it is never set from an effect.
  const [playing, setPlaying] = React.useState(false)
  // undefined on the server and before mount (the placeholder shows, nothing is blurred); "loading" once mounted with
  // the media not decoded yet; "ready" after.
  const [state, setState] = React.useState<"loading" | "ready" | undefined>(undefined)
  const [motionState, setMotionState] = React.useState<TreatmentState>(null)
  const kind: MediaTreatment = video ? "clean" : treatment

  // A video autoplays only when motion is allowed and it was asked to.
  const wantsPlay = !!video?.autoPlay && !reduced
  React.useEffect(() => {
    const v = player.current
    if (!v) return
    if (wantsPlay) void v.play?.()?.catch?.(() => {})
    else v.pause?.()
  }, [wantsPlay])

  // An image that decoded before the script ran fires no load event: read it once mounted.
  React.useEffect(() => {
    const img = image.current
    if (!img) return
    setState((s) => s ?? (img.complete && img.naturalWidth > 0 ? "ready" : "loading"))
  }, [src])

  // The moving treatments start only with motion allowed, at their loudness, and never on the LCP image.
  React.useEffect(() => {
    const frame = root.current
    const media = image.current
    const moving = kind === "clip-reveal" || kind === "inner-parallax"
    const allowed = !!frame && !!media && !reduced && !priority && moving && loudnessAllows(frame, kind === "inner-parallax" ? "scroll" : "reveal")
    const mode: TreatmentState = allowed ? (supportsScrollTimeline() ? "css" : "script") : null
    setMotionState(mode)
    if (mode !== "script" || !frame || !media) return
    if (kind === "clip-reveal") return reveal(media, { role: "media", from: "mask" })
    const stop = scrub(frame, (p) => {
      media.style.transform = `translate3d(0, ${(INNER_PARALLAX.travel * (2 * p - 1)).toFixed(3)}%, 0) scale(${INNER_PARALLAX.scale})`
    }, { scrub: 0.5 })
    return () => {
      stop()
      media.style.transform = ""
    }
  }, [kind, reduced, priority])

  const toggle = () => {
    const v = player.current
    if (!v) return
    if (v.paused ?? !playing) void v.play?.()?.catch?.(() => {})
    else v.pause?.()
  }
  const enter = () => {
    const el = root.current
    setHoverScale(el && !prefersReducedMotion(el) ? mediaScale(el) : 1)
  }
  const leave = () => setHoverScale(0)
  const ready = () => setState("ready")

  const scale = hovered && !reduced ? hoverScale : 1
  // Duotone: the image in greyscale, multiplied into the lighter ink (the frame's ground), then lightened by the
  // darker one (the overlay): its shadows take one ink and its highlights the other, in either scheme.
  const mediaClass = cn("block size-full object-cover", hovered ? "motion-media" : "motion-hover-out", kind === "duotone" && "grayscale contrast-125 mix-blend-multiply")
  const mediaStyle: React.CSSProperties = { scale }
  const loading = priority ? "eager" : "lazy"
  const frameClass = cn("relative w-full overflow-hidden media-edge", PLACEHOLDER[placeholder], kind === "duotone" && "isolate bg-surface-base dark:bg-primary", RADIUS[radius], className)
  const longLoop = !!video?.loop && (video.duration === undefined || video.duration > PAUSE_AFTER)
  const showControl = !!video && (reduced || !video.autoPlay || longLoop)
  const css = kind === "clip-reveal" || kind === "inner-parallax" || kind === "blur-to-sharp"

  return (
    <div
      ref={ref}
      data-slot="media-frame"
      data-variant={video ? "video" : "image"}
      data-aspect={aspect}
      data-priority={priority ? "true" : undefined}
      data-placeholder={placeholder === "surface" ? undefined : placeholder}
      data-state={state}
      data-treatment={kind === "clean" ? undefined : kind}
      data-treatment-state={motionState ?? undefined}
      className={frameClass}
      style={{ aspectRatio: aspect, ...style }}
      onPointerEnter={enter}
      onPointerLeave={leave}
      {...props}
    >
      {css ? (
        <style href="feather-media-treatments" precedence="feather">
          {TREATMENT_CSS}
        </style>
      ) : null}
      {video ? (
        <video
          ref={player}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedData={ready}
          data-slot="media-frame-media"
          className={mediaClass}
          style={mediaStyle}
          poster={video.poster}
          muted={video.muted ?? true}
          loop={video.loop}
          playsInline={video.playsInline ?? true}
          preload={priority ? "auto" : "metadata"}
          aria-label={alt || undefined}
          aria-hidden={decorative ? true : undefined}
          src={sources?.length ? undefined : src}
        >
          {sources?.map((s) => (
            <source key={s.src + s.type} data-slot="media-frame-source" src={s.src} type={s.type} />
          ))}
        </video>
      ) : (
        <picture data-slot="media-frame-picture">
          {sources?.map((s) => (
            <source key={s.src + s.type} data-slot="media-frame-source" srcSet={s.srcSet ?? s.src} {...(s.srcSet && sizes ? { sizes } : {})} type={s.type} />
          ))}
          <img
            ref={image}
            data-slot="media-frame-media"
            className={mediaClass}
            style={mediaStyle}
            src={src}
            {...(srcSet ? { srcSet, ...(sizes ? { sizes } : {}) } : {})}
            alt={decorative ? "" : (alt ?? "")}
            width={width}
            height={height}
            loading={loading}
            decoding="async"
            onLoad={ready}
            {...(priority ? { fetchPriority: "high" as const } : {})}
          />
        </picture>
      )}
      {kind === "duotone" ? <span data-slot="media-frame-duotone" aria-hidden="true" className="pointer-events-none absolute inset-0 bg-primary mix-blend-lighten dark:bg-surface-base" /> : null}
      {kind === "grain" ? <span data-slot="media-frame-grain" aria-hidden="true" className="pointer-events-none absolute inset-0 film-grain mix-blend-overlay" style={{ opacity: `max(var(--grain-opacity), ${MEDIA_GRAIN})` }} /> : null}
      {showControl && (
        <div data-slot="media-frame-control" className="absolute bottom-4 right-4">
          <button type="button" data-slot="media-frame-toggle" data-variant={playing ? "pause" : "play"} aria-label={playing ? "Pause video" : "Play video"} onClick={toggle} className="size-control hit-area focus-ring inline-flex items-center justify-center rounded-full bg-surface-inverse text-fg-inverse">
            <Glyph playing={playing} />
          </button>
        </div>
      )}
    </div>
  )
})
