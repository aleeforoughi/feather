// The feather-react parts a page loads only when a visitor needs them, as one lazy chunk (feather-page-parts.js in the
// release): the gallery's Lightbox, on the first open. Keeping it off the page's first load keeps Base UI's dialog
// and feather-react out of the runtime.
export { Lightbox } from "@aleeforoughi/feather-react"
