import * as React from "react"

const subscribe = () => () => {}

/**
 * Whether the page is running its script: false on the server and while the server's markup hydrates (so hydration
 * matches), true from then on, and true at once for a page rendered on the client. A block draws its no-script form
 * until then, so what a visitor without script gets is exactly what the server wrote.
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
