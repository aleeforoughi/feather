// Words and numbers for the person: money, dates and URLs as the plan's locale writes them. Pure helpers.

/** Money in the reader's locale; a code the runtime does not know falls back to "{code} {amount}". */
export function formatMoney(amount: number, currency: string, locale: string): string {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: fractionDigits, maximumFractionDigits: 2 })
      .format(amount)
      .replaceAll(" ", " ")
      .replaceAll(" ", " ")
  } catch {
    return `${currency} ${amount}`
  }
}

const PERIOD: Record<string, string> = { hour: "per hour", day: "per day", week: "per week", month: "per month", year: "per year" }

/** "per month" for a recurring price, nothing for a one-off. */
export function periodText(period: string | undefined): string {
  return period ? (PERIOD[period] ?? "") : ""
}

const OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i
const HAS_TIME = /T\d{2}/

/**
 * An ISO 8601 date or date-time, written for the locale. A value with no offset names a wall-clock time, so it is
 * shown as written (never shifted to the viewer's zone); one with an offset names an instant, shown in the viewer's
 * zone with the zone's name so it is never ambiguous.
 */
export function formatDate(value: string, locale: string): string {
  const time = HAS_TIME.test(value)
  const instant = time && OFFSET.test(value)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const options: Intl.DateTimeFormatOptions = time
    ? { dateStyle: "medium", timeStyle: "short", ...(instant ? { timeZoneName: "short" as const } : { timeZone: "UTC" }) }
    : { dateStyle: "medium", timeZone: "UTC" }
  try {
    return new Intl.DateTimeFormat(locale, options).format(date)
  } catch {
    return value
  }
}

/** A range: "{from} to {until}". */
export function formatRange(value: string, until: string | undefined, locale: string): string {
  return until ? `${formatDate(value, locale)} to ${formatDate(until, locale)}` : formatDate(value, locale)
}

/** A confidence or share as a percentage: 0.784 is "78%". */
export function percent(value: number): string {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`
}

/**
 * The URL when it is safe to put in a link or a media element: http(s), a relative path, or nothing. A caller's
 * `javascript:` or `data:` URL is never rendered.
 */
export function safeUrl(url: string): string | undefined {
  const trimmed = url.trim()
  if (trimmed === "") return undefined
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)?.[1]?.toLowerCase()
  if (scheme === undefined) return trimmed
  return scheme === "http" || scheme === "https" ? trimmed : undefined
}

const RTL = new Set(["ar", "he", "fa", "ur", "ps", "sd", "ug", "yi", "dv", "ckb"])

/** The writing direction of a BCP 47 locale. */
export function directionOf(locale: string): "ltr" | "rtl" {
  try {
    const info = (new Intl.Locale(locale) as Intl.Locale & { getTextInfo?: () => { direction?: string }; textInfo?: { direction?: string } })
    const direction = info.getTextInfo?.().direction ?? info.textInfo?.direction
    if (direction === "rtl" || direction === "ltr") return direction
    return RTL.has(info.language) ? "rtl" : "ltr"
  } catch {
    return RTL.has(locale.split("-")[0]!.toLowerCase()) ? "rtl" : "ltr"
  }
}

/** The first letter upper-cased. */
export function upperFirst(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s
}

/** A reply problem as a person should read it: the part after "act on Node "id": ". */
export function plainProblem(message: string): string {
  return message.replace(/^[^:]*:\s*/, "")
}
