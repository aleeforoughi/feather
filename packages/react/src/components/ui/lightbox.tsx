import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react"
import { cn } from "../../lib/cn"

import { Button } from "./button"
import { Icon } from "./icon"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog"

export type LightboxImage = { src: string; alt: string; caption?: string; downloadName?: string }

/**
 * A checkerboard backdrop from the theme's surface tokens (the `bg-checker` utility in foundation.css): transparent
 * images show their shape on any brand. Shared by Lightbox and MediaGallery.
 */
const checker = "bg-checker"

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
          <DialogBody data-slot="lightbox-body">
            <div data-slot="lightbox-stage" className={cn("flex max-h-[60vh] items-center justify-center overflow-hidden rounded-card", checker)}>
              <img data-slot="lightbox-image" src={image.src} alt={image.alt} className="max-h-[60vh] w-auto max-w-full object-contain" />
            </div>
          </DialogBody>
        )}
        <div data-slot="lightbox-nav" data-region="utility" className="flex items-center justify-between gap-action inset-utility">
          <div data-slot="lightbox-steps" className="flex gap-action">
            <Button variant="outline" disabled={!many} onClick={() => step(-1)}>
              <Icon icon={ChevronLeftIcon} /> Previous
            </Button>
            <Button variant="outline" disabled={!many} onClick={() => step(1)}>
              Next <Icon icon={ChevronRightIcon} />
            </Button>
          </div>
          {image && (
            <Button variant="outline" nativeButton={false} render={<a href={image.src} download={image.downloadName ?? ""} />}>
              <Icon icon={DownloadIcon} /> Download
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { Lightbox, checker as lightboxChecker }
