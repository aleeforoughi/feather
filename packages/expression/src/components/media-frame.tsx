import * as React from "react"
import { mediaScale, prefersReducedMotion } from "../core/motion"
import { useMergedRef, useReducedMotion } from "../hooks"
import { cn } from "../cn"

export type MediaAspect = "16/9" | "4/3" | "1/1" | "3/4" | "4/5" | "21/9"
export type MediaRadius = "card" | "dialog" | "control" | "none"

const RADIUS: Record<MediaRadius, string> = { card: "rounded-card", dialog: "rounded-dialog", control: "rounded-control", none: "" }

export interface MediaSource {
  src: string
  /** The MIME type: image/avif, image/webp, video/mp4; codecs="hvc1", video/webm; codecs="vp9"... */
  type: string
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
}

const PAUSE_AFTER = 5

function Glyph({ playing }: { playing: boolean }) {
  return (
    <svg data-slot="media-frame-glyph" aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="currentColor">
      {playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M5 3l8 5-8 5z" />}
    </svg>
  )
}

/**
 * MediaFrame: one framing rule for images and video. A fixed aspect, a 1px edge, an overflow clip and a hover scale
 * (from 1, never from 0). The LCP image is `priority`; the rest load lazily. A video that loops longer than 5s has a
 * real pause button. Under reduced motion there is no hover scale and a video does not autoplay (poster and a play button).
 */
export const MediaFrame = React.forwardRef<HTMLDivElement, MediaFrameProps>(function MediaFrame(
  { aspect = "16/9", radius = "card", priority = false, src, sources, alt, decorative = false, video, width, height, className, style, ...props },
  forwarded
) {
  const root = React.useRef<HTMLDivElement>(null)
  const ref = useMergedRef(forwarded, root)
  const player = React.useRef<HTMLVideoElement>(null)
  const reduced = useReducedMotion(root)
  // The hover scale, measured when the pointer enters (never read from a ref during render). 0 means "not hovered".
  const [hoverScale, setHoverScale] = React.useState(0)
  const hovered = hoverScale > 0
  // Playing follows the element's own play/pause events, so it is never set from an effect.
  const [playing, setPlaying] = React.useState(false)

  // A video autoplays only when motion is allowed and it was asked to.
  const wantsPlay = !!video?.autoPlay && !reduced
  React.useEffect(() => {
    const v = player.current
    if (!v) return
    if (wantsPlay) void v.play?.()?.catch?.(() => {})
    else v.pause?.()
  }, [wantsPlay])

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

  const scale = hovered && !reduced ? hoverScale : 1
  const mediaClass = cn("block size-full object-cover", hovered ? "motion-media" : "motion-hover-out")
  const mediaStyle: React.CSSProperties = { scale }
  const loading = priority ? "eager" : "lazy"
  const frameClass = cn("relative w-full overflow-hidden media-edge bg-surface-subtle", RADIUS[radius], className)
  const longLoop = !!video?.loop && (video.duration === undefined || video.duration > PAUSE_AFTER)
  const showControl = !!video && (reduced || !video.autoPlay || longLoop)

  return (
    <div
      ref={ref}
      data-slot="media-frame"
      data-variant={video ? "video" : "image"}
      data-aspect={aspect}
      data-priority={priority ? "true" : undefined}
      className={frameClass}
      style={{ aspectRatio: aspect, ...style }}
      onPointerEnter={enter}
      onPointerLeave={leave}
      {...props}
    >
      {video ? (
        <video
          ref={player}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
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
            <source key={s.src + s.type} data-slot="media-frame-source" srcSet={s.src} type={s.type} />
          ))}
          <img
            data-slot="media-frame-media"
            className={mediaClass}
            style={mediaStyle}
            src={src}
            alt={decorative ? "" : (alt ?? "")}
            width={width}
            height={height}
            loading={loading}
            decoding="async"
            {...(priority ? { fetchPriority: "high" as const } : {})}
          />
        </picture>
      )}
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
