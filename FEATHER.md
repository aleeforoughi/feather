# What belongs in Feather

Feather is a design system that products install as packages and reshape with their brand's tokens, never by
editing its components. Feather owns its releases; callers such as QOOE ask for
upgrades as issues (a gap, the proposal, the owner's go-ahead). Every upgrade must leave Feather clean, mapped,
versioned, themeable, standard and ready to use. A component earns its place only when all of this holds:

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
   in both reference themes, and listed in `foundation.json` (`level: atom | molecule | organism`).
6. **Clean-room.** Feather learns techniques and values from other work (the award catalog in Qooler's file 27,
   their shipped code read as reference) and writes its own code. No site's or component's code is copied or
   ported. Before Feather depends on a library (a GSAP plugin, Lenis, Three.js, a WebCodecs helper), its current
   licence is checked and recorded in the CHANGELOG entry that adds it; a licence that forbids redistributing it as
   a component (Commons Clause and the like) rules it out.
7. **Versioned.** A minor version per addition, a CHANGELOG entry saying where it came from and why, and the
   hygiene gate (`pnpm hygiene`) green before release.

## How a missing block gets in

Qooler (or any caller) asks for a missing block or variant with a `pattern-request` issue: the catalog id, a draft
spec, the brand that needs it, and the evidence. It becomes a variant or a knob of something that exists when it
can (rule 2); a new block is the last resort. Requests are the only way new blocks enter: the library grows from
need, not from the catalog's length.

## Molecules

Compositions of atoms that any product reuses (`"level": "molecule"` in `foundation.json`): `lightbox`,
`media-gallery`, `activity-feed`, `attention-card`, `step-list`, `budget-bar` (budgets, quotas, storage) and
`role-avatar` (RoleAvatar, RoleChip, RoleCard, RoleAvatarGroup: people and agent roles).

## Organisms

An organism renders one Experience IR node as a whole interaction, built from atoms and molecules
(`"level": "organism"` in `foundation.json`, stories under `Organisms/`). Its props mirror the node's fields
(`docs/ir/nodes.md`), and it reports what the person did through `onAct(act, value?)` using exactly the node's
reply acts, so the composer can wire it to reply events without translation. `@aleeforoughi/feather-react` never
imports the IR package; the mirroring is a convention, checked by review and stories. The contract every organism
follows is in `docs/organisms.md`.

