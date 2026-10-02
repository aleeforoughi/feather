# Branch tools (legacy)

Under QOOE, a product started as a copy of Feather (a *branch*) and these tools cut, checked and upgraded it.
Feather now ships as packages, so new products install `@aleeforoughi/feather-react` instead (see the root
README), and existing branches switch over the same way.

They are kept, unchanged from Feather 1.7.0 and not run by CI, until every QOOE branch has moved:

| File | What it did |
|---|---|
| `feather-branch.mjs` | Cut a branch (`design/feather.json`), write `feather.lock.json` and the themed sheet; `--upgrade-from` a newer Feather. |
| `check.mjs`, `check-brand.mjs` | QOOE's product checks for a branch (brand files, designs, branch integrity, raw colors). They belong in qooe-core. |
| `shot.mjs` | Screenshots of a branch's screens at 390 and 1280. |
| `foundation/` | The branch's themed sheet (`BranchSheet`, `sheet.html`), QOOE's `FoundationProviders` (React Query, tooltips, toasts, color mode), `runtime.ts` (`isPreview`, `appOrigin`) and the neutral `styles/brand*.css`. |

Their imports still point at the 1.7.0 layout (`scripts/apply-brand.mjs`, `@/components/ui`); run them from a
branch, not from this repository.
