# Handoff prompt

Paste this as the first message of a new Claude Code session in a fresh clone of `aleeforoughi/feather`.

```text
You are continuing Feather, the first liquid design system (semantics in, the right experience out), in
aleeforoughi/feather. CLAUDE.md loads on its own; read it, then docs/PLAN.md section 0 (where things stand and what
is open), section 3 (principles) and section 11 (the team: you are the Opus session; Sonnet subagents build
organisms, bodies, playground and tests; Haiku subagents do stories, fixtures and hygiene runs; the builder never
reviews its own work; every delegated task names its files and its exit test). Then read the top of CHANGELOG.md
(1.15.1 to 1.18.0) for what changed most recently.

State: milestones L0–L7 and V1 are built. 1.15.1, 1.15.2, 1.16.0 (L5) and 1.17.0 (L6) are released on main. 1.18.0
(L7: the IR frozen as feather.ir/1, @aleeforoughi/feather-client, the docs site in apps/docs) is on branch
claude/l7-ready-for-callers and is not released yet.

First:
1. Set up: `pnpm install --frozen-lockfile && pnpm build`. Python work needs 3.11+.
2. Check 1.18.0's CI: `gh run list --repo aleeforoughi/feather --branch claude/l7-ready-for-callers --workflow
   ci.yml --limit 3`. If the latest run on the branch head is green, release it by fast-forwarding main to that
   head (`git push origin <sha>:main`) and confirm Publish attached the wheel to the v1.18.0 release. If it failed,
   find out why, fix it on the branch, and run the checks before pushing:
   `pnpm lint && pnpm build && pnpm typecheck && pnpm test && pnpm hygiene` (plus `pnpm test:docs`,
   `pnpm test:a11y`, `pnpm test:playground` and `pnpm test:embed` when relevant).
3. Then tell me where things stand, and ask which open item in docs/PLAN.md section 0 to take next. Do not start
   Godpip work, publish the docs site, or change the frozen IR (docs/ir/FREEZE.md) without asking.

Rules that bit before (also in CLAUDE.md): never record visual baselines locally (push
apps/storybook/visual/RECORD, or dispatch visual-baselines.yml by hand on a new branch); its commit does not start
CI, so dispatch ci.yml by hand; a new push cancels the running CI; bump every package.json and
packages/python/feather_sdk/_version.py together, then `pnpm manifest`, then CHANGELOG.md.
```
