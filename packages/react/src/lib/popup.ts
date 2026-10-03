// Entry and exit of floating surfaces (docs/visual-system.md section 10), for Tailwind class strings.
//
// A popover, menu or select enters with opacity plus a small move away from its anchor (8px) and a scale of 0.99, over the
// `popover` role. A tooltip moves 4px over the `tooltip` role. Base UI marks the first frame `data-starting-style` and the
// last `data-ending-style`, and the side it opens on `data-side`. The motion role carries the duration and the one curve.

/** Menus, popovers and selects: the `popover` role, 8px and scale 0.99 to 1. */
export const popoverMotion =
  "motion-popover origin-(--transform-origin) data-starting-style:scale-99 data-starting-style:opacity-0 data-ending-style:scale-99 data-ending-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-2 data-[side=bottom]:data-ending-style:-translate-y-2 data-[side=top]:data-starting-style:translate-y-2 data-[side=top]:data-ending-style:translate-y-2 data-[side=left]:data-starting-style:translate-x-2 data-[side=left]:data-ending-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2 data-[side=right]:data-ending-style:-translate-x-2 data-[side=inline-start]:data-starting-style:translate-x-2 data-[side=inline-start]:data-ending-style:translate-x-2 data-[side=inline-end]:data-starting-style:-translate-x-2 data-[side=inline-end]:data-ending-style:-translate-x-2"

/** Tooltips: the `tooltip` role and 4px. */
export const tooltipMotion =
  "motion-tooltip origin-(--transform-origin) data-starting-style:opacity-0 data-ending-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=bottom]:data-ending-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1 data-[side=top]:data-ending-style:translate-y-1 data-[side=left]:data-starting-style:translate-x-1 data-[side=left]:data-ending-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1 data-[side=right]:data-ending-style:-translate-x-1 data-[side=inline-start]:data-starting-style:translate-x-1 data-[side=inline-start]:data-ending-style:translate-x-1 data-[side=inline-end]:data-starting-style:-translate-x-1 data-[side=inline-end]:data-ending-style:-translate-x-1"
