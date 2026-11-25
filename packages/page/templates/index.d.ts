// The page templates (templates/index.js): six whole feather.page/1 documents, each with a one-line description.
export type TemplateName = "launch" | "studio" | "editorial" | "service" | "product" | "creator"
export interface PageTemplate {
  description: string
  /** The page document, as `feather-page init` writes it: `brand` is a path to fill in. */
  page: { schema: "feather.page/1"; brand: string; layout: string; sections: unknown[]; scheme?: { toggle?: "nav" | "footer"; colors: Record<string, string> } } & Record<string, unknown>
}
export const TEMPLATES: Record<TemplateName, PageTemplate>
export const TEMPLATE_NAMES: TemplateName[]
/** A starting other set for a page's colour scheme toggle, from a brand's own colours: ground and ink swapped. */
export function otherSet(colors: { background: string; surface: string; text: string; primary: string }): { background: string; surface: string; text: string; primary: string; primaryText: string }
