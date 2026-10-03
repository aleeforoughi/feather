import * as React from "react"
import { motion } from "motion/react"
import { ImagesIcon } from "lucide-react"
import { cn } from "../../lib/cn"

import { useThemeMotion } from "../../lib/motion"
import { Icon } from "./icon"
import { Lightbox, lightboxChecker, type LightboxImage } from "./lightbox"

export type MediaGallerySection = { key: string; title: string; items: LightboxImage[] }

/** One thumbnail: the image on a checkerboard (transparency shows), its label below. */
function MediaTile({ image, onOpen, className, ...props }: { image: LightboxImage; onOpen?: () => void } & Omit<React.ComponentProps<"button">, "onClick">) {
  return (
    <button
      type="button"
      data-slot="media-tile"
      onClick={onOpen}
      className={cn("group/media-tile motion-hover block w-full overflow-hidden rounded-card border border-line-secondary text-left hover:border-line-primary", className)}
      {...props}
    >
      <span data-slot="media-tile-stage" className={cn("flex h-32 items-center justify-center p-2", lightboxChecker)}>
        <img data-slot="media-tile-image" src={image.src} alt={image.alt} loading="lazy" className="max-h-full max-w-full object-contain" />
      </span>
      <span data-slot="media-tile-label" className="block truncate px-3 py-2 type-caption text-fg-secondary">
        {image.caption ?? image.alt}
      </span>
    </button>
  )
}

/**
 * Images organized into titled sections (e.g. Brand, Design pages, Built screens), tiles fading in, any one
 * opening large in a Lightbox that steps through all of them.
 */
function MediaGallery({ sections, empty = "No images yet.", className }: { sections: MediaGallerySection[]; empty?: React.ReactNode; className?: string }) {
  const all = sections.flatMap((s) => s.items)
  const [open, setOpen] = React.useState<number | null>(null)
  // Tiles enter like a toast: medium, 8px.
  const motionTheme = useThemeMotion("toast")
  if (all.length === 0) {
    return (
      <div data-slot="media-gallery" className={cn("flex flex-col items-center justify-center gap-element px-8 py-20 text-center type-body text-fg-secondary", className)}>
        <Icon icon={ImagesIcon} size={32} />
        <p>{empty}</p>
      </div>
    )
  }
  let n = 0
  return (
    <div data-slot="media-gallery" className={cn("space-y-8", className)}>
      {sections.map((section) => (
        <section key={section.key} data-slot="media-gallery-section" aria-labelledby={`media-${section.key}`}>
          <h2 data-slot="media-gallery-title" id={`media-${section.key}`} className="mb-3 flex items-baseline gap-2 type-title text-fg-primary">
            {section.title}
            <span data-slot="media-gallery-count" className="type-body-sm text-fg-secondary">{section.items.length}</span>
          </h2>
          <ul data-slot="media-gallery-list" className="grid grid-cols-2 gap-element sm:grid-cols-3 lg:grid-cols-4">
            {section.items.map((image, i) => {
              const at = n++
              return (
                <motion.li key={`${image.src}-${at}`} data-slot="media-gallery-item" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionTheme.duration, ease: motionTheme.ease, delay: motionTheme.reduced ? 0 : Math.min(i, 12) * 0.03 }}>
                  <MediaTile image={image} onOpen={() => setOpen(at)} />
                </motion.li>
              )
            })}
          </ul>
        </section>
      ))}
      <Lightbox images={all} index={open} onIndexChange={setOpen} />
    </div>
  )
}

export { MediaGallery, MediaTile }
