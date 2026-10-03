import * as React from "react"

const PortalContainerContext = React.createContext<HTMLElement | null | undefined>(undefined)

/**
 * Where Feather's popups (select, menus, popover, tooltip, dialog, sheet, navigation menu) portal to. Without a provider
 * it is `undefined`, which keeps Base UI's default (document.body). A host that renders Feather inside a page it does
 * not own passes its own element, so the popups stay inside the styles it scoped.
 */
function FeatherPortalProvider({ container, children }: { container: HTMLElement | null | undefined; children: React.ReactNode }) {
  return <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>
}

/** The portal container to pass as `container` to a Base UI Portal. `undefined` means the default. */
function usePortalContainer(): HTMLElement | null | undefined {
  return React.useContext(PortalContainerContext)
}

export { FeatherPortalProvider, usePortalContainer }
