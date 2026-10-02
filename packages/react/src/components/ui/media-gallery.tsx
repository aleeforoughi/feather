import * as React from "react"
import { motion } from "motion/react"
import { ImagesIcon } from "lucide-react"
import { cn } from "cn"

import { useThemeMotion } from "../../lib/motion"
import { Lightbox, lightboxChecker, type LightboxImage } from "./lightbox"

export type MediaGallerySection = { key: string; title: string; items: LightboxImage[] }

/** One thumbnail: the image on a checkerboard (transparency shows), its label below. */
function MediaTile({ image, onOpen, className, ...props }: { image: LightboxImage; onOpen?: () => void } & Omit<React.ComponentProps<"button">, "onClick">) {
  return (
    <button
      type="button"
      data-slot="media-tile"
      onClick={onOpen}
      className={cn("group/media-tile block w-full overflow-hidden rounded-lg border border-border text-left focus-visible:outline-2 focus-visible:outline-ring", className)}
      {...props}
    >
      <span className={cn("flex aspect-square items-center justify-center p-2", lightboxChecker)}>
        <img src={image.src} alt={image.alt} loading="lazy" className="max-h-full max-w-full object-contain transition-transform group-hover/media-tile:scale-105" />
      </span>
      <span data-slot="media-tile-label" className="block truncate px-2 py-1.5 text-xs text-muted-foreground">
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
  const motionTheme = useThemeMotion()
  if (all.length === 0) {
    return (
      <div data-slot="media-gallery" className={cn("flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground", className)}>
        <ImagesIcon className="size-10" />
        <p>{empty}</p>
      </div>
    )
  }
  let n = 0
  return (
    <div data-slot="media-gallery" className={cn("space-y-8", className)}>
      {sections.map((section) => (
        <section key={section.key} data-slot="media-gallery-section" aria-labelledby={`media-${section.key}`}>
          <h2 id={`media-${section.key}`} className="mb-3 flex items-baseline gap-2 font-heading text-lg font-semibold">
            {section.title}
            <span className="text-sm font-normal text-muted-foreground">{section.items.length}</span>
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {section.items.map((image, i) => {
              const at = n++
              return (
                <motion.li key={`${image.src}-${at}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionTheme.duration * 2, ease: motionTheme.ease, delay: motionTheme.reduced ? 0 : Math.min(i, 12) * 0.03 }}>
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
