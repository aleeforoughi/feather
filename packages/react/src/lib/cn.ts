// Class merging that knows Feather's visual system (docs/visual-system.md). The stock merger only knows Tailwind's own
// utilities, so `cn("type-body", "type-label")` kept both roles and an override such as `cn("h-control", "h-auto")`
// lost to CSS order. Each system utility is placed in the group it competes with, so the last one wins, as it does
// for any Tailwind utility.
import type { CnFunction } from "cn"
import { createCn } from "cn/config"

const ROLES = ["display", "heading-1", "heading-2", "heading-3", "title", "body-lg", "body", "body-sm", "label", "caption", "caps"]
const MOTION = ["press", "focus", "hover", "state", "switch", "tooltip", "popover", "panel", "dialog", "toast", "page", "loading", "ping", "wiggle"]

export const cn: CnFunction = createCn({
  extend: {
    classGroups: {
      "type-role": [{ type: ROLES }],
      "motion-role": [{ motion: MOTION }],
      h: [{ h: ["control", "indicator"] }],
      w: [{ w: ["indicator"] }],
      "min-h": [{ "min-h": ["control"] }],
      size: [{ size: ["control", "icon-slot"] }],
      "region-inset": [{ inset: ["content", "header", "action", "utility", "display"] }],
      px: [{ px: ["control", "container"] }],
      py: [{ py: ["control", "container"] }],
      gap: [{ gap: ["element", "group", "action", "label", "field"] }],
      rounded: [{ rounded: ["xs", "control", "card", "dialog"] }],
      shadow: [{ shadow: ["1", "2", "3"] }],
      opacity: [{ opacity: ["disabled"] }],
    },
    conflictingClassGroups: {
      // A type role sets size, line height, weight and tracking; a later one of those overrides that part.
      "type-role": ["font-size", "leading", "font-weight", "tracking"],
      // A motion role sets the transitioned properties, duration and curve.
      "motion-role": ["transition", "duration", "ease"],
      // A region inset sets all four paddings, so a later one replaces any earlier padding utility.
      "region-inset": ["p", "px", "py", "pt", "pr", "pb", "pl", "ps", "pe"],
    },
  },
})
