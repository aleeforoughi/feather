# What belongs in Feather

Feather is QOOE's master design system: every product is cut from it (a branch) and themed by its brand's
tokens. Bootstrap owns it. Every upgrade must leave Feather clean, mapped, versioned, themeable, standard and
ready to use. A component earns its place only when all of this holds:

1. **Reusable.** Another product would use it as it is: it solves a pattern, not one screen. A product's own
   compositions (its pages, its data wiring, its domain words) stay in the product.
2. **Not a duplicate.** Nothing in Feather already does it; if something nearly does, extend that component (a
   variant, a prop) instead of adding a sibling. The hygiene gate refuses duplicate exports, shared slot names
   and near-identical names.
3. **Not crowding.** Fewer, stronger components beat many narrow ones. Helpers belong in the component that
   needs them (exported beside it), not as separate entries.
4. **Themeable.** Semantic tokens only, never raw colors; every visible part has a `data-slot`, and every
   variant or state is a `data-variant`, so brand tokens (`"slot"` or `"slot.variant"`) can restyle it without
   touching code. Motion comes from the theme (`useThemeMotion`) and honours reduced motion.
5. **Standard.** Accessible (roles, labels, keyboard), documented in Storybook with real examples, compiling
   in both reference themes, and listed in `foundation.json` (`level: atom | molecule`).
6. **Versioned.** A minor version per addition, a CHANGELOG entry saying where it came from and why, and the
   hygiene gate (`npm run hygiene`) green before release.

## Molecules

Compositions of atoms that any product reuses (`"level": "molecule"` in `foundation.json`): `lightbox`,
`media-gallery`, `activity-feed`, `attention-card`, `step-list`, `budget-bar` (budgets, quotas, storage) and
`role-avatar` (RoleAvatar, RoleChip, RoleCard, RoleAvatarGroup: people and agent roles).
