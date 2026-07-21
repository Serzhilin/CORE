# CORE — Full ecommons-ui Inline-Style Migration Design

**Status:** Approved by user, pending implementation plan.

## Context

CORE's previous "frontend styling foundation" plan (`2026-07-21-frontend-styling-foundation-design.md`) deliberately deferred the bulk of CORE's inline-style cleanup, scoping itself to: dead Tailwind removal, `@ecommons/ui` dependency hygiene, 3 new shared primitives in ecommons-ui (`.row`/`.stack` utilities, `Muted` component, widened `Heading.as`), and 3 raw-heading swaps. The deferred backlog was recorded in `docs/todo.md`:

- Migrate 23 hand-rolled icon-button call sites to `Button variant="ghost"`
- Migrate ~29 near-duplicate flex row/column inline-style blocks to `.row`/`.stack`
- Adopt `Muted` at 19 existing "muted small text" inline-style call sites

Beyond that backlog, CORE still has **~433 `style={{}}` blocks across 28 files** — the bulk of the app's presentational code is still hand-rolled inline styles rather than ecommons-ui components or semantic CSS. The sibling app ALVer already completed an equivalent full migration (`docs/superpowers/plans/2026-07-20-ecommons-ui-migration.md`, 9 SDD tasks, all reviewed clean) and is the proof this approach works at this scale.

**Goal:** eliminate CORE's inline-style debt so the app relies on ecommons-ui components and design tokens as its primary styling mechanism, folding in the 3 already-deferred backlog items along the way (touching each file once, not twice).

Worst-offender files (block count): WorkgroupsTab.jsx (52), InfoPanel.jsx (50), CommunityTab.jsx (49), LoginScreen.jsx (37), AvailabilityTab.jsx (36), MembersTab.jsx (31), MyProfile.jsx (23), SuperadminPage.jsx (20), MyWorkgroups.jsx (20), TopBar.jsx (20), PersonModal.jsx (19), CardGrid.jsx (17), W3dsLinkCard.jsx (13), MyAvailability.jsx (11), OrganogramView.jsx (10), OnboardingScreen.jsx (7), DeeplinkLogin.jsx (4), App.jsx (4), GraphView.jsx (3), WorkgroupNode.jsx (2), PersonNode.jsx (2), AdminPanel.jsx (2), ForceGraph.jsx (1).

## Architecture

**Per-block classification, checked in this order:**

1. **Does ecommons-ui already ship a component that does this?** (`Card`, `Panel`, `Button`, `Badge`, `Input`, `Select`, `Modal`, `Table`/`Thead`/`Th`/`Td`, `Tabs`, `Loading`, `Heading`, `SectionLabel`, `Muted`, `Avatar`, `Label`, `Icon`/`TrashIcon`, `MenuItem`, `ProgressBar`, `CollapsiblePanel`, `Page`, `EmojiBadge`/`EmojiPicker`.) If yes — swap the hand-rolled `<div style={{...}}>` for the real component. This is the primary path, not a fallback.
2. **If no component fits, but the block is genuinely bespoke layout** unique to this view (a one-off grid/flex wrapper) — it becomes a class in a co-located CSS Module (`ComponentName.module.css`, imported as `styles` and applied via `className`). Every value in that class must reference an ecommons-ui design token (`var(--space-*)`, `var(--color-*)`, `var(--font-*)`) wherever a token covers the value — never a raw literal duplicating a token.
3. **Only genuinely runtime-computed values** (a color picked from a data array, a percentage, a computed pixel size, a boolean-driven theme swap) stay inline via `style={{}}` — and only the dynamic properties themselves, with every static property in the same object moved to the class.

**CSS Modules, not global `index.css`.** CORE has no CSS Modules yet (everything lives in one 61-line global `index.css`) — but converting 433 blocks into one global namespace risks classname collisions across 28 files. CSS Modules are scoped per-file automatically and match ALVer's already-proven convention.

**Fold in the 3 deferred backlog items** during the same pass over the same files (icon-button → `Button variant="ghost"`, flex row/col wrappers → `.row`/`.stack`, muted small text → `Muted`) rather than re-touching each file in a later plan.

**No visual-behavior changes intended.** This is a like-for-like style-authoring migration. Any spot where the existing behavior looks like an unintentional inconsistency worth fixing — not just relocating — gets flagged to the user, per the existing hard constraint on this design system ("stop and ask before making any decision that changes visible behavior, not just code location").

## Task Clustering (for the implementation plan)

Ordered smallest-blast-radius-first, biggest/riskiest clusters last, mirroring ALVer's proven task ordering:

- **Cluster A — shared components:** `TopBar.jsx`, `InfoPanel.jsx`, `PersonModal.jsx`, `W3dsLinkCard.jsx`, `CardGrid.jsx`
- **Cluster B — admin tab views (biggest):** `WorkgroupsTab.jsx`, `CommunityTab.jsx`, `AvailabilityTab.jsx`, `MembersTab.jsx`
- **Cluster C — profile/workgroup views:** `MyProfile.jsx`, `MyWorkgroups.jsx`, `MyAvailability.jsx`, `OnboardingScreen.jsx`, `DeeplinkLogin.jsx`
- **Cluster D — top-level/admin views:** `SuperadminPage.jsx`, `AdminPanel.jsx`, `App.jsx`
- **Cluster E — login:** `LoginScreen.jsx` (extends the 4 classes already ported from the Tailwind-removal work to its remaining inline blocks)
- **Cluster F — graph views:** `OrganogramView.jsx`, `GraphView.jsx`, `WorkgroupNode.jsx`, `PersonNode.jsx`, `ForceGraph.jsx`
- **Final task:** whole-app grep audit (no stray `style={{` blocks except an allow-listed dynamic set, no raw Tailwind-era literals duplicating tokens) + build/smoke check

The implementation plan (written next, via `writing-plans`) will split these clusters into concrete bite-sized tasks — likely one task per file for anything ≥30 blocks, clustered tasks for the smaller files.

## Testing / Verification

No browser automation tool is available in this environment (same disclosed limitation as the prior CORE plan). Each task's verification step is a smoke check only: `npm run build` exits clean, dev server boots and returns HTTP 200 on the affected route, grep confirms no stray `style={{` blocks beyond the allow-listed dynamic set for that file. This is explicitly **not** a real visual/rendering confirmation — genuine browser-based verification of each converted view remains owed to the user directly, flagged per-task rather than claimed as done.

## Out of Scope

- Any of the "Gaps" items already listed in `docs/todo.md` (Icon system, Dropdown/Menu, Checkbox/Radio/Switch, Toast/alert/banner, etc.) — those are separate future extractions, not part of this migration.
- Any new ecommons-ui component beyond what already exists (`Button variant="ghost"`, `.row`/`.stack`, `Muted`) — if a file's audit reveals a genuine new extraction candidate (duplicated ≥2 real sites), that's escalated to the user as a scope question, not built ad hoc mid-task.
