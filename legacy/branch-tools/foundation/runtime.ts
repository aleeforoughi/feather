/**
 * Where the app is running. QOOE renders every screen from the built files (file://) for screenshots and
 * QA: there the page has no origin (window.location.origin is "null"), so clients that need a base URL
 * (Better Auth, openapi-fetch) must not be built from it. Use these instead of window.location directly.
 */
export const isPreview = typeof window !== "undefined" && window.location.protocol === "file:"

/** The API's origin: the page's own origin when served, a placeholder in the file:// preview. */
export const appOrigin = isPreview || typeof window === "undefined" ? "http://preview.invalid" : window.location.origin
