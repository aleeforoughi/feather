// Whether the page can be seen. Everything that runs on its own (a render loop, a quality test, a sound bed, a
// loader's clock) stops while the tab is hidden and resumes when it returns.

/** True while the document is hidden (always false outside a browser). */
export function isHidden(): boolean {
  return typeof document !== "undefined" && document.hidden === true
}

/** Calls back with `hidden` whenever the page is hidden or shown; returns the unsubscribe. */
export function onVisibilityChange(callback: (hidden: boolean) => void): () => void {
  if (typeof document === "undefined") return () => {}
  const listener = () => callback(document.hidden)
  document.addEventListener("visibilitychange", listener)
  return () => document.removeEventListener("visibilitychange", listener)
}
