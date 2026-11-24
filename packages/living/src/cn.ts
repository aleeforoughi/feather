/** Joins class names, dropping empty ones. The expression layer has no Tailwind merge: its classes never conflict. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}
