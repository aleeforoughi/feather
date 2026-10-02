import type { LightboxImage } from "../components/ui/lightbox"

/** Sample artwork (inline SVG, no network): a transparent mark and an opaque sheet. */
const svg = (body: string, w = 400, h = 400) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`
export const SAMPLE_IMAGES: LightboxImage[] = [
  { src: svg('<circle cx="200" cy="200" r="120" fill="none" stroke="black" stroke-width="40"/><rect x="250" y="70" width="40" height="70" fill="orchid"/>'), alt: "logo-mark.png", caption: "brand/logo-mark.png" },
  { src: svg('<rect width="640" height="400" fill="whitesmoke"/><text x="40" y="120" font-size="72" font-family="serif">Brand</text><rect x="40" y="200" width="120" height="120" fill="orchid"/><rect x="180" y="200" width="120" height="120" fill="black"/>', 640, 400), alt: "guideline-sheet.png", caption: "brand/guideline-sheet.png" },
]

