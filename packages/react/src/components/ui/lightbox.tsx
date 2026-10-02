import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "./button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog"

export type LightboxImage = { src: string; alt: string; caption?: string; downloadName?: string }

/**
 * A checkerboard backdrop from the theme's muted and background tokens: transparent images show their
 * shape on any brand. Shared by Lightbox and MediaGallery.
 */
const checker =
  "bg-[conic-gradient(var(--muted)_25%,var(--background)_0_50%,var(--muted)_0_75%,var(--background)_0)] bg-size-[20px_20px]"

/** One image of a set, large, with previous / next (buttons and arrow keys) and download. */
function Lightbox({
  images,
  index,
  onIndexChange,
  className,
}: {
  images: LightboxImage[]
  /** The open image, or null when closed. */
  index: number | null
  onIndexChange: (index: number | null) => void
  className?: string
}) {
  const image = index !== null ? images[index] : undefined
  const many = images.length > 1
  const step = React.useCallback(
    (by: number) => {
      if (index !== null && images.length > 0) onIndexChange((index + by + images.length) % images.length)
    },
    [index, images.length, onIndexChange]
  )
  React.useEffect(() => {
    if (index === null || !many) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1)
      if (e.key === "ArrowLeft") step(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [index, many, step])
  return (
    <Dialog open={image !== undefined} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent data-slot="lightbox" className={cn("max-h-[92vh] sm:max-w-4xl", className)}>
        <DialogHeader>
          <DialogTitle className="break-all">{image?.alt}</DialogTitle>
          <DialogDescription data-slot="lightbox-caption" className="break-all">
            {image?.caption}
            {many && index !== null ? `${image?.caption ? " · " : ""}${index + 1} of ${images.length}` : ""}
          </DialogDescription>
        </DialogHeader>
        {image && (
          <div data-slot="lightbox-stage" className={cn("flex max-h-[70vh] items-center justify-center overflow-hidden rounded-lg", checker)}>
            <img src={image.src} alt={image.alt} className="max-h-[70vh] w-auto max-w-full object-contain" />
          </div>
        )}
        <div data-slot="lightbox-nav" className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!many} onClick={() => step(-1)}>
              <ChevronLeftIcon /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!many} onClick={() => step(1)}>
              Next <ChevronRightIcon />
            </Button>
          </div>
          {image && (
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={image.src} download={image.downloadName ?? ""} />}>
              <DownloadIcon /> Download
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { Lightbox, checker as lightboxChecker }
