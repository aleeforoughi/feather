import type * as React from "react"
import type { MediaFrameProps } from "@aleeforoughi/feather-expression"
import type { Media, MediaSrcset } from "../core/types"

export type FrameMedia = Pick<MediaFrameProps, "src" | "sources" | "alt" | "decorative" | "video" | "srcSet" | "sizes">

const VIDEO = /\.(?:mp4|webm|mov|m4v)(?:[?#]|$)/i

/** The source of a `Media` value (a mark image, say), whatever shape it was written in. */
export function mediaSrc(media: Media): string {
  return typeof media === "string" ? media : media.src
}

/** A srcset as the attribute writes it: "a-800.jpg 800w, a-1600.jpg 1600w". */
export function srcsetOf(srcset: MediaSrcset): string {
  return typeof srcset === "string" ? srcset.trim() : srcset.map((c) => `${c.src} ${c.w}w`).join(", ")
}

/**
 * A `Media` value as `MediaFrame` props. A bare string is an image. A source of video type (or a video file
 * extension) is a muted, looping, inline video with its poster; MediaFrame gives a long loop its pause button and
 * stops autoplay under reduced motion. Without `alt` the image is decorative, unless the caller offers `fallbackAlt`.
 * An image with a `srcset` takes `sizes`: how wide the block draws it (MEDIA_SIZES, sizes.ts), never the caller's;
 * without a srcset neither is written, so the markup is as it was.
 */
export function mediaProps(media: Media, fallbackAlt?: string, sizes?: string): FrameMedia {
  const m = typeof media === "string" ? { src: media } : media
  const alt = m.alt ?? fallbackAlt
  const decorative = m.decorative === true || !alt
  const sources = m.sources?.map((s) => ({ src: s.src, type: s.type, ...(s.srcset ? { srcSet: srcsetOf(s.srcset) } : {}) }))
  const widths = m.srcset ? srcsetOf(m.srcset) : undefined
  const anyWidths = !!widths || !!sources?.some((s) => s.srcSet)
  const base: FrameMedia = { src: m.src, decorative, ...(alt ? { alt } : {}), ...(sources ? { sources } : {}), ...(widths ? { srcSet: widths } : {}), ...(anyWidths && sizes ? { sizes } : {}) }
  const video = !!m.sources?.some((s) => s.type.startsWith("video/")) || VIDEO.test(m.src)
  if (!video) return base
  const { srcSet: _w, sizes: _s, ...still } = base
  void _w
  void _s
  return { ...still, video: { autoPlay: true, muted: true, loop: true, playsInline: true, ...(m.poster ? { poster: m.poster } : {}) } }
}

/** The ink that reads on the media scrim, as the text roles of the copy over it (text-fg-primary and -secondary inside
 * read as text-ink-on-media). */
export const ON_MEDIA = {
  "--text-primary": "var(--ink-on-media)",
  "--text-secondary": "var(--ink-on-media)",
  "--ring": "var(--ink-on-media)",
  // The primary act is filled with the ink (its label in the inverse surface, the colour opposite the page's ground);
  // a quiet act sits on the scrim itself, ruled in the ink.
  "--primary": "var(--ink-on-media)",
  "--primary-foreground": "var(--surface-inverse)",
  "--surface-base": "var(--media-scrim)",
  "--surface-hover": "color-mix(in oklab, var(--ink-on-media) 12%, var(--media-scrim))",
  "--border-primary": "var(--ink-on-media)",
} as React.CSSProperties
