import * as React from "react"
import { DEFAULT_LOCALE } from "../core/counter"

/**
 * The locale numbers are written in. A server render and the browser's hydration must write the same digits, so it
 * is never the environment's default (a Persian or Arabic browser writes other digits than the server): a page sets
 * it from its own language, and without a provider it is DEFAULT_LOCALE.
 */
const LocaleContext = React.createContext<string>(DEFAULT_LOCALE)

export function LocaleProvider({ locale, children }: { locale: string | undefined; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale || DEFAULT_LOCALE}>{children}</LocaleContext.Provider>
}

/** The locale numbers are written in: the nearest LocaleProvider's, or DEFAULT_LOCALE. */
export function useLocale(): string {
  return React.useContext(LocaleContext)
}
