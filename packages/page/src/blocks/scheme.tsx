// The scheme toggle (feather.page/1 `scheme`): the segmented control in the nav or the footer. The CSS side, which
// every page's head needs, is scheme-css.ts; the release runtime loads this with the flows family.
import * as React from "react"
import { Segmented, useStored, type SegmentOption } from "./controls"
import { SCHEME_KEY, type SchemeChoice } from "./scheme-css"

export { SCHEME_KEY, schemeScript, isDarkTheme, schemeCss, type SchemeChoice } from "./scheme-css"

const ICONS: Record<SchemeChoice, React.ReactNode> = {
  light: (
    <svg data-slot="scheme-icon-svg" viewBox="0 0 16 16" className="size-4 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" />
    </svg>
  ),
  dark: (
    <svg data-slot="scheme-icon-svg" viewBox="0 0 16 16" className="size-4 fill-none stroke-current" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z" />
    </svg>
  ),
  system: (
    <svg data-slot="scheme-icon-svg" viewBox="0 0 16 16" className="size-4 stroke-current" strokeWidth="1.5">
      <circle data-slot="scheme-icon-ring" cx="8" cy="8" r="6" className="fill-none" />
      <path data-slot="scheme-icon-half" d="M8 2a6 6 0 0 1 0 12z" className="fill-current" />
    </svg>
  ),
}

const OPTIONS: readonly SegmentOption<SchemeChoice>[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

const parseChoice = (saved: string | null): SchemeChoice => (saved === "light" || saved === "dark" ? saved : "system")

/** The person's choice, read before paint (so the toggle and the page agree from the first frame) and applied. */
function useScheme(): [SchemeChoice, (c: SchemeChoice) => void] {
  const [choice, write] = useStored(SCHEME_KEY, "system", parseChoice)
  // The page follows the choice: <html data-scheme> (the inline script has usually set it already).
  React.useLayoutEffect(() => {
    const html = document.documentElement
    if (choice === "system") html.removeAttribute("data-scheme")
    else html.setAttribute("data-scheme", choice)
  }, [choice])
  const choose = (c: SchemeChoice) => {
    const html = document.documentElement
    // Switch with transitions held, then flush the styles before letting them go: the new colours are simply there.
    html.setAttribute("data-scheme-switching", "")
    if (c === "system") html.removeAttribute("data-scheme")
    else html.setAttribute("data-scheme", c)
    void document.body.offsetHeight
    html.removeAttribute("data-scheme-switching")
    write(c === "system" ? null : c)
  }
  return [choice, choose]
}

/** The colour scheme toggle: a radio group of light, dark and system. In the nav's bar it is three icons (their names
 * are the radios' labels); in the footer it is words. It needs script to apply a choice, so without one it is not
 * shown and the system's preference holds. */
export function SchemeToggle({ place }: { place: "nav" | "footer" }) {
  const [choice, choose] = useScheme()
  const name = `feather-scheme-${React.useId().replace(/:/g, "")}`
  const options = place === "nav" ? OPTIONS.map((o) => ({ ...o, icon: ICONS[o.value] })) : OPTIONS
  return <Segmented slot="scheme-toggle" legend="Colour scheme" hideLegend={place === "nav"} name={name} options={options} value={choice} onChange={choose} className="noscript:hidden" />
}
