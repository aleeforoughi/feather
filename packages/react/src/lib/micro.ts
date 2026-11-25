// Micro-motion (docs/visual-system.md section 10, "Micro-motion"), as Tailwind class strings every interactive atom shares.
//
// The press scales 0.985 (`press`) while held: in over the `micro` duration (`active:motion-press`), released over the
// control's own role, which must list `scale` (motion-hover, motion-switch or motion-toggle), so it reverses from where
// it is. A transform never moves another box, so hover and focus stay shift-free. Disabled and busy controls never press.

/** Press feedback for a control: Base UI marks disabled with data-disabled or aria-disabled, a native button with :disabled. */
export const pressMotion =
  "not-disabled:not-data-disabled:not-aria-disabled:not-aria-busy:active:press active:motion-press"

/** Error feedback: one 3px shake as aria-invalid arrives. The colour and the message carry it under reduced motion. */
export const errorMotion = "aria-invalid:motion-shake"
