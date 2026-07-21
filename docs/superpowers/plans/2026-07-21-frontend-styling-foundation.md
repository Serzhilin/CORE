# CORE Frontend Styling Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove CORE's dead Tailwind setup, refresh its stale `@ecommons/ui` install, add two genuinely-missing reusable primitives to the shared `ecommons-ui` package, and swap CORE's 3 raw HTML heading tags to the design system's `Heading`/`SectionLabel` components.

**Architecture:** Two repositories are touched: `~/Projects/ecommons-ui` (the shared design-system package, consumed by CORE/ALVer/WVTTK/w3ds_casco) and `~/Projects/CORE` (this app). `ecommons-ui` changes must be committed and pushed to `origin main` before CORE can reinstall and see them — CORE consumes it as a `git+ssh://...#main` dependency, resolved to a pinned commit SHA in `package-lock.json`, not a live symlink.

**Tech Stack:** React 19, Vite, TypeScript (ecommons-ui only, built via `tsup`), plain CSS with custom properties (no CSS-in-JS, no CSS modules, no Tailwind after this plan).

## Global Constraints

- Neither `ecommons-ui` nor CORE's `app/` has any test framework installed (no jest/vitest in either `package.json`). Verification in this plan is `npm run build` success plus `grep`/`cat` checks of the built `dist/` output — do not add a test framework as part of this work, that's out of scope.
- `ecommons-ui` design language ("neubrutalist" per `COMPONENTS.md`): `border-radius: 0`, 2px solid `var(--color-charcoal)` borders, hard non-blurred `--block-shadow`/`--block-shadow-sm` shadows — never soft blurred `box-shadow: 0 Npx Mpx rgba(...)`. New CSS added in this plan must not introduce shadows/borders (it doesn't — see Task 1).
- The `style` prop on every `ecommons-ui` component is the **sanctioned** per-instance override mechanism (per `MIGRATION.md`), not an anti-pattern to eliminate. Nothing in this plan should attempt to remove legitimate one-off inline `style` usage — only the specific items named in each task.
- **Never `git push` without asking first** (existing project convention). Task 4 ends with a hard checkpoint: stop and ask the user to confirm pushing `ecommons-ui`'s `main` branch before Task 5 begins — Task 5 cannot succeed without those commits being live on `origin`, but pushing is not this plan's call to make silently.
- CORE's repo (`~/Projects/CORE`) has pre-existing, unrelated uncommitted changes already in the working tree (established in prior work on this repo). Do not `git add -A` or stage anything beyond the exact files each task names — stage by explicit path only.

---

## Task 1: Add `.row` / `.stack` layout utilities to ecommons-ui

**Files:**
- Modify: `~/Projects/ecommons-ui/src/styles/layout.css`
- Modify: `~/Projects/ecommons-ui/COMPONENTS.md`

**Interfaces:**
- Produces: two CSS classes, `.row` and `.stack`, globally available to any app importing `@ecommons/ui/dist/index.css` (already bundled automatically — `layout.css` is imported as a side effect in `src/index.ts:3`, no new import needed). Gap is controlled per-instance via the CSS custom property `--gap` (e.g. `style={{ '--gap': 'var(--space-16)' }}`), defaulting to `var(--space-8)` if unset.

- [ ] **Step 1: Add the two utility classes**

Append to `~/Projects/ecommons-ui/src/styles/layout.css` (end of file, after the existing `.topbar-slot-row` block):

```css

/* ── Generic row/stack layout ─────────────────────────────────────────────── */
.row {
  display: flex;
  align-items: center;
  gap: var(--gap, var(--space-8));
}

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--gap, var(--space-8));
}
```

- [ ] **Step 2: Document the layout utilities in COMPONENTS.md**

Append to the end of `~/Projects/ecommons-ui/COMPONENTS.md` (after the existing `## Panel` section):

```markdown

## Layout utilities (`src/styles/layout.css`)

Plain CSS classes, not components — apply directly via `className`.

- **`.row`** — `display: flex; align-items: center; gap: var(--gap, var(--space-8))`. For horizontal groups of controls/text that don't need their own component.
- **`.stack`** — `display: flex; flex-direction: column; gap: var(--gap, var(--space-8))`. Vertical equivalent of `.row`.
- Override the gap per instance with the `--gap` CSS custom property, e.g. `<div className="row" style={{ '--gap': 'var(--space-16)' }}>`. Do not add gap-size modifier classes (`.row-lg` etc) — the custom property already covers this without growing the class surface.
- **`.topbar-slot-row`** — TopBar's absolute-positioned title/filter slot (existing, previously undocumented here). Not intended for reuse outside `TopBar`.
```

- [ ] **Step 3: Build and verify**

```bash
cd ~/Projects/ecommons-ui
npm run build
grep -c "\.row" dist/index.css
grep -c "\.stack" dist/index.css
```
Expected: `npm run build` exits 0 with no errors; both `grep -c` calls print `1` or higher (confirms the rules made it into the bundled CSS).

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/ecommons-ui
git add src/styles/layout.css COMPONENTS.md
git commit -m "feat: add .row/.stack layout utility classes"
```

---

## Task 2: Add `Muted` component to ecommons-ui

**Files:**
- Create: `~/Projects/ecommons-ui/src/components/Muted.tsx`
- Modify: `~/Projects/ecommons-ui/src/components/index.ts`
- Modify: `~/Projects/ecommons-ui/COMPONENTS.md`

**Interfaces:**
- Produces: `Muted` component and `MutedProps` interface, exported from `@ecommons/ui`. Signature:
  ```ts
  interface MutedProps {
    as?: 'span' | 'p' | 'div';   // default 'span'
    size?: 'sm' | 'xs';          // default 'sm' — 'sm' = 0.875rem, 'xs' = 0.75rem
    style?: CSSProperties;
    children: ReactNode;
  }
  ```
  Matches the existing `ErrorText`/`SectionLabel` pattern: no separate `.css` file, inline `style` object merged with a caller-supplied `style` override last.

- [ ] **Step 1: Create the component**

Create `~/Projects/ecommons-ui/src/components/Muted.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react';

export interface MutedProps {
  as?: 'span' | 'p' | 'div';
  size?: 'sm' | 'xs';
  style?: CSSProperties;
  children: ReactNode;
}

const SIZE_MAP: Record<NonNullable<MutedProps['size']>, string> = {
  sm: '0.875rem',
  xs: '0.75rem',
};

export function Muted({ as: Tag = 'span', size = 'sm', style, children }: MutedProps) {
  return (
    <Tag style={{ fontSize: SIZE_MAP[size], color: 'var(--color-charcoal-light)', ...style }}>
      {children}
    </Tag>
  );
}
```

- [ ] **Step 2: Export it**

In `~/Projects/ecommons-ui/src/components/index.ts`, add a new line after the existing `export * from './Panel';` (last line):

```ts
export * from './Muted';
```

- [ ] **Step 3: Document it in COMPONENTS.md**

Add a new section to `~/Projects/ecommons-ui/COMPONENTS.md` immediately after the existing `## Heading / SectionLabel / ErrorText — typography scale` section (after its closing paragraph, before `## Page`):

```markdown

## Muted

```ts
as?: 'span' | 'p' | 'div'   // default 'span'
size?: 'sm' | 'xs'          // default 'sm' — sm = 0.875rem, xs = 0.75rem
```
Small secondary text: always `color: var(--color-charcoal-light)`. Use for the "muted small text" pattern (timestamps, secondary metadata, helper captions) instead of a one-off `style={{ fontSize: '...', color: 'var(--color-charcoal-light)' }}`. Only two sizes are exposed deliberately — if a call site needs a size outside this set, that's a signal it's not actually this pattern.
```

- [ ] **Step 4: Build and verify**

```bash
cd ~/Projects/ecommons-ui
npm run build
grep -c "Muted" dist/index.js
grep -c "MutedProps" dist/index.d.ts
```
Expected: `npm run build` exits 0; both greps print `1` or higher.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/ecommons-ui
git add src/components/Muted.tsx src/components/index.ts COMPONENTS.md
git commit -m "feat: add Muted component for secondary/small text"
```

---

## Task 3: Widen `Heading`'s `as` prop to include `'h2'`

**Files:**
- Modify: `~/Projects/ecommons-ui/src/components/Heading.tsx`
- Modify: `~/Projects/ecommons-ui/COMPONENTS.md`

**Context:** `Heading` currently only accepts `as?: 'span' | 'h1'`. CORE's `PersonModal.jsx:44` has a raw `<h2>` that needs to become a `Heading` (Task 7) — `SectionLabel`'s `as` prop already covers `'h3' | 'h4' | 'div'`, so `'h2'` is the one gap between the two components. This is the minimal widening needed; do not add `'h3'`/`'h4'`/etc to `Heading` — those belong to `SectionLabel`.

**Interfaces:**
- Consumes: nothing new.
- Produces: `HeadingProps.as` now typed `'span' | 'h1' | 'h2'` (was `'span' | 'h1'`). No default changes (`as` still defaults to `'span'`).

- [ ] **Step 1: Widen the type**

In `~/Projects/ecommons-ui/src/components/Heading.tsx`, change:

```ts
export interface HeadingProps {
  as?: 'span' | 'h1';
```

to:

```ts
export interface HeadingProps {
  as?: 'span' | 'h1' | 'h2';
```

- [ ] **Step 2: Update COMPONENTS.md**

In `~/Projects/ecommons-ui/COMPONENTS.md`, change:

```
as?: 'span' | 'h1'          // default 'span'
```

to:

```
as?: 'span' | 'h1' | 'h2'   // default 'span'
```

(This line is inside the `## Heading / SectionLabel / ErrorText — typography scale` code block, the `// Heading — page/section titles` subsection.)

- [ ] **Step 3: Build and verify**

```bash
cd ~/Projects/ecommons-ui
npm run build
grep "as?:" dist/index.d.ts | grep "h2"
```
Expected: `npm run build` exits 0; the grep prints a line containing `Heading`'s `as` union with `h2` in it (confirms the widened type made it into the shipped declaration file).

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/ecommons-ui
git add src/components/Heading.tsx COMPONENTS.md
git commit -m "feat: widen Heading as prop to include h2"
```

---

## Task 4: ecommons-ui doc housekeeping — stale Codeberg URL, missing `ghost` variant doc

**Files:**
- Modify: `~/Projects/ecommons-ui/README.md`
- Modify: `~/Projects/ecommons-ui/COMPONENTS.md`

**Context:** `README.md` still documents the pre-migration `github:Serzhilin/ecommons-ui` install URL — the repo actually moved to Codeberg (`git@codeberg.org:eCommons/ecommons-ui.git`), confirmed by CORE's real root `package.json` dependency: `"@ecommons/ui": "git+ssh://git@codeberg.org/eCommons/ecommons-ui.git#main"`. Separately, `COMPONENTS.md`'s `## Button` section was never updated when the `ghost` variant was added upstream (commit `a093c32`, 2026-07-20) — it still lists only 4 variants.

- [ ] **Step 1: Fix the 6 stale GitHub references in README.md**

In `~/Projects/ecommons-ui/README.md`, make these exact replacements:

Replace (line ~20):
```
ecommons-ui is not published to npm. It's pushed to its own repo, **`github:Serzhilin/ecommons-ui`**, and consumed as a git dependency — this works from any build context (local disk, CI, Docker/Coolify), unlike a `file:` path which only resolves when both repos happen to be checked out as siblings on the same machine.
```
with:
```
ecommons-ui is not published to npm. It's pushed to its own repo on Codeberg, **`git+ssh://git@codeberg.org/eCommons/ecommons-ui.git`**, and consumed as a git dependency — this works from any build context (local disk, CI, Docker/Coolify), unlike a `file:` path which only resolves when both repos happen to be checked out as siblings on the same machine.
```

Replace (line ~26, inside the JSON example):
```
     "@ecommons/ui": "github:Serzhilin/ecommons-ui#main"
```
with:
```
     "@ecommons/ui": "git+ssh://git@codeberg.org/eCommons/ecommons-ui.git#main"
```

Replace (line ~46):
```
**Remember:** ecommons-ui changes never reach a consuming app until (a) they're pushed to `github:Serzhilin/ecommons-ui` and (b) the consuming app reinstalls (see "Publishing" below) — editing local `src/` files does nothing for a consumer on its own.
```
with:
```
**Remember:** ecommons-ui changes never reach a consuming app until (a) they're pushed to `git+ssh://git@codeberg.org/eCommons/ecommons-ui.git` and (b) the consuming app reinstalls (see "Publishing" below) — editing local `src/` files does nothing for a consumer on its own.
```

Replace (line ~54):
```
3. **Nothing downstream updates automatically.** A consuming app's `package-lock.json` pins the *exact commit SHA* it last resolved (e.g. `"resolved": "git+ssh://git@github.com/Serzhilin/ecommons-ui.git#<sha>"`) — pushing new commits to `main` does not change what an already-installed app is using. To pick up the latest `main` in a consuming app, force a re-resolve:
```
with:
```
3. **Nothing downstream updates automatically.** A consuming app's `package-lock.json` pins the *exact commit SHA* it last resolved (e.g. `"resolved": "git+ssh://git@codeberg.org/eCommons/ecommons-ui.git#<sha>"`) — pushing new commits to `main` does not change what an already-installed app is using. To pick up the latest `main` in a consuming app, force a re-resolve:
```

Replace (line ~57):
```
   npm install @ecommons/ui@github:Serzhilin/ecommons-ui#main
```
with:
```
   npm install @ecommons/ui@git+ssh://git@codeberg.org/eCommons/ecommons-ui.git#main
```

Replace (line ~64):
```
**Floating on `#main` is a deliberate tradeoff**, not an oversight: fast iteration across a small number of consumers, at the cost of no per-consumer rollback safety and no guarantee two apps are on the same version at any given time. If a specific app needs to freeze a known-good state (e.g. right before a release), point its dependency at a commit SHA instead of `#main` (`github:Serzhilin/ecommons-ui#<sha>`) rather than continuing to float.
```
with:
```
**Floating on `#main` is a deliberate tradeoff**, not an oversight: fast iteration across a small number of consumers, at the cost of no per-consumer rollback safety and no guarantee two apps are on the same version at any given time. If a specific app needs to freeze a known-good state (e.g. right before a release), point its dependency at a commit SHA instead of `#main` (`git+ssh://git@codeberg.org/eCommons/ecommons-ui.git#<sha>`) rather than continuing to float.
```

- [ ] **Step 2: Verify no stale references remain**

```bash
cd ~/Projects/ecommons-ui
grep -n "github:Serzhilin\|github.com/Serzhilin" README.md
```
Expected: no output (empty match — all 6 occurrences replaced).

- [ ] **Step 3: Document the `ghost` Button variant**

In `~/Projects/ecommons-ui/COMPONENTS.md`, change:

```
variant?: 'primary' | 'secondary' | 'danger' | 'green'  // default 'primary'
```

to:

```
variant?: 'primary' | 'secondary' | 'danger' | 'green' | 'ghost'  // default 'primary'
```

And in the same `## Button` section, after the existing `- \`green\`: green background, white text.` bullet, add:

```
- `ghost`: transparent background, `var(--color-charcoal-light)` text, `opacity: 0.6` at rest, no shadow/transform shift. Hover fills `var(--color-sand)` background and returns to full opacity. Intended for low-emphasis inline actions (e.g. icon-only buttons), not primary CTAs.
```

- [ ] **Step 4: Build and verify**

```bash
cd ~/Projects/ecommons-ui
npm run build
grep -c "btn-ghost" dist/index.css
```
Expected: `npm run build` exits 0; grep prints `1` or higher (the `ghost` variant CSS was already present from the earlier upstream commit — this step only confirms the doc now matches shipped reality, and that the build still succeeds).

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/ecommons-ui
git add README.md COMPONENTS.md
git commit -m "docs: fix stale Codeberg install URL, document ghost Button variant"
```

---

## ⚠️ CHECKPOINT — stop and ask before Task 5

Tasks 1–4 are committed locally on `ecommons-ui`'s `main` branch. **Do not push.** Stop here and ask the user to confirm pushing `~/Projects/ecommons-ui`'s `main` branch to `origin` (Codeberg) — Task 5 (CORE's reinstall) cannot pick up any of Tasks 1–4 until those commits exist on the remote, since CORE resolves `@ecommons/ui` via `git+ssh://...#main`, not a local path.

Once the user confirms, push with:
```bash
cd ~/Projects/ecommons-ui
git push origin main
```

Only proceed to Task 5 after this push has happened.

---

## Task 5: CORE — refresh `@ecommons/ui` install, fix EXTRACTION.md

**Files:**
- Modify: `~/Projects/CORE/package.json` (dependency version resolution only, via `npm install` — no manual edit)
- Modify: `~/Projects/CORE/package-lock.json` (regenerated by `npm install`)
- Modify: `~/Projects/CORE/EXTRACTION.md`

**Interfaces:**
- Consumes: Tasks 1–4's pushed commits on `ecommons-ui`'s `main` branch.
- Produces: CORE's installed `node_modules/@ecommons/ui` now includes `.row`/`.stack`, `Muted`, `Heading`'s widened `as` type, and the `ghost` Button variant — required by Task 7's heading swaps and by the (separately deferred) icon-button/row-stack migration plan.

- [ ] **Step 1: Force re-resolve to the latest `main`**

```bash
cd ~/Projects/CORE
npm install @ecommons/ui@git+ssh://git@codeberg.org/eCommons/ecommons-ui.git#main
```
Expected: exits 0. This updates `package-lock.json`'s pinned commit SHA for `@ecommons/ui` — confirm it changed:

```bash
git diff --stat package-lock.json
```
Expected: shows `package-lock.json` as modified (the pinned `resolved` SHA changed from `2fba4fad9f496b640b0939805e94279048c2da47` to a newer commit).

- [ ] **Step 2: Verify the new features are actually present**

```bash
cd ~/Projects/CORE
grep -c "Muted" node_modules/@ecommons/ui/dist/index.js
grep "as?:" node_modules/@ecommons/ui/dist/index.d.ts | grep "h2"
grep -c "btn-ghost" node_modules/@ecommons/ui/dist/index.css
grep -c "\.row" node_modules/@ecommons/ui/dist/index.css
```
Expected: all four commands print output confirming presence (non-zero counts / a matching line) — if any comes back empty, the push in the checkpoint above did not include that task's commit; stop and investigate before continuing.

- [ ] **Step 3: Fix EXTRACTION.md's stale dependency description**

In `~/Projects/CORE/EXTRACTION.md`, change:

```
Package lives at `../ecommons-ui` (sibling of CORE), consumed via `file:` dep,
built with tsup. CORE imports the **built** `dist/`, so every step here ends
with `npm run build` in `ecommons-ui` before switching back to CORE.
```

to:

```
Package lives at `~/Projects/ecommons-ui`, consumed via a `git+ssh` dependency
pinned to a commit on its `main` branch (see root `package.json`), built with
tsup. CORE imports the **built** `dist/`, so every step here ends with
`npm run build` in `ecommons-ui`, then `git push origin main`, then
`npm install @ecommons/ui@git+ssh://git@codeberg.org/eCommons/ecommons-ui.git#main`
in CORE to pick it up — a local build alone does not reach CORE.
```

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/CORE
git add package.json package-lock.json EXTRACTION.md
git commit -m "chore: refresh @ecommons/ui install, fix stale EXTRACTION.md dependency description"
```

---

## Task 6: CORE — remove dead Tailwind

**Files:**
- Delete: `~/Projects/CORE/app/tailwind.config.js`
- Delete: `~/Projects/CORE/app/postcss.config.js`
- Modify: `~/Projects/CORE/app/src/index.css`
- Modify: `~/Projects/CORE/app/package.json`
- Modify: `~/Projects/CORE/app/package-lock.json` (regenerated by `npm install`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks — this is a standalone removal.

- [ ] **Step 1: Confirm no real Tailwind utility usage survives**

```bash
cd ~/Projects/CORE/app
grep -rEo 'className="[^"]*"' src --include="*.jsx" | grep -E '\b(flex|grid-cols-[0-9]+|p-[0-9]+|px-[0-9]+|py-[0-9]+|m-[0-9]+|text-(xs|sm|lg|xl)|w-full|h-full|rounded|shadow-)\b' | head -20
```
Expected: no output (or only false-positive matches you manually inspect and confirm are not real Tailwind usage — e.g. a literal class name that happens to contain "flex" as a substring of something else). If real Tailwind utility classes are found, stop and report them before proceeding — this plan assumes near-zero usage based on an earlier audit, and removing Tailwind while classes are still in use would break those views.

- [ ] **Step 2: Delete the Tailwind config files**

```bash
cd ~/Projects/CORE/app
rm tailwind.config.js postcss.config.js
```

- [ ] **Step 3: Strip the `@tailwind` directives**

In `~/Projects/CORE/app/src/index.css`, change:

```css
@import '@ecommons/ui/dist/index.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

to:

```css
@import '@ecommons/ui/dist/index.css';
```

(Leave the rest of the file — the `label`, `.divider`, `.topbar-filter-break` rules and the `@media` block — untouched.)

- [ ] **Step 4: Remove the Tailwind devDependencies**

In `~/Projects/CORE/app/package.json`, change:

```json
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "vite": "^8.0.0"
  }
```

to:

```json
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.0",
    "vite": "^8.0.0"
  }
```

- [ ] **Step 5: Reinstall and build**

```bash
cd ~/Projects/CORE/app
npm install
npm run build
```
Expected: `npm install` exits 0 and removes the three packages from `node_modules`; `npm run build` exits 0 with no CSS/PostCSS errors.

- [ ] **Step 6: Manual visual check**

Start the dev server and check one screen for a regression:

```bash
cd ~/Projects/CORE/app
npm run dev
```
Open `http://localhost:5175` (per `vite.config.js`'s configured port) in a browser, log in, and visually confirm the login screen and at least one tab view render with no missing spacing/borders/colors compared to before this change. Stop the dev server afterward (Ctrl+C).

- [ ] **Step 7: Commit**

```bash
cd ~/Projects/CORE
git add app/src/index.css app/package.json app/package-lock.json
git add -u app/tailwind.config.js app/postcss.config.js
git commit -m "chore: remove dead Tailwind setup from app/"
```

(`git add -u` on the two deleted files stages their removal; `-u` only stages files already tracked by git, so this cannot accidentally pick up unrelated untracked files in `app/`.)

---

## Task 7: CORE — swap 3 raw headings to `Heading`/`SectionLabel`, note deferred backlog

**Files:**
- Modify: `~/Projects/CORE/app/src/components/PersonModal.jsx`
- Modify: `~/Projects/CORE/app/src/views/SuperadminPage.jsx`
- Modify: `~/Projects/CORE/app/src/views/admin/MembersTab.jsx`
- Modify: `~/Projects/CORE/docs/todo.md`

**Interfaces:**
- Consumes: `Heading`'s widened `as` prop (`'span' | 'h1' | 'h2'`) from Task 3, installed via Task 5.

- [ ] **Step 1: `PersonModal.jsx` — swap the raw `<h2>` to `Heading`**

In `~/Projects/CORE/app/src/components/PersonModal.jsx`, change the import (line 1) from:

```jsx
import { Card, Badge, Avatar, SectionLabel } from '@ecommons/ui'
```

to:

```jsx
import { Card, Badge, Avatar, SectionLabel, Heading } from '@ecommons/ui'
```

Then change (lines 44–46):

```jsx
              <h2 style={{ fontFamily: 'var(--font-title)', margin: '0 0 var(--space-4)' }}>
                {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'}
              </h2>
```

to:

```jsx
              <Heading as="h2" fontSize="1.3rem" style={{ margin: '0 0 var(--space-4)' }}>
                {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'}
              </Heading>
```

(`fontSize="1.3rem"` overrides `Heading`'s `2rem` default — the raw `<h2>` had no explicit `fontSize`, inheriting the browser's default `h2` size, which is visually smaller than `Heading`'s default; `1.3rem` keeps this modal's member-name heading from suddenly becoming oversized. `fontFamily: var(--font-title)` and `fontWeight: 700` are already `Heading`'s defaults, so they're dropped from the explicit style.)

- [ ] **Step 2: `SuperadminPage.jsx` — swap the raw `<h1>` to `Heading`**

In `~/Projects/CORE/app/src/views/SuperadminPage.jsx`, change the import (line 2) from:

```jsx
import { Card, Button, Input, Badge, Loading, SectionLabel, ErrorText } from '@ecommons/ui'
```

to:

```jsx
import { Card, Button, Input, Badge, Loading, SectionLabel, ErrorText, Heading } from '@ecommons/ui'
```

Then change (line 137):

```jsx
      <h1 style={{ fontFamily: 'var(--font-title)', margin: '0 0 var(--space-24)' }}>Superadmin — Communities</h1>
```

to:

```jsx
      <Heading as="h1" style={{ margin: '0 0 var(--space-24)' }}>Superadmin — Communities</Heading>
```

(No `fontSize` override needed — `Heading`'s default `2rem`/`700` matches what the raw `<h1>` was manually recreating.)

- [ ] **Step 3: `MembersTab.jsx` — swap the raw `<h4>` to `SectionLabel`**

In `~/Projects/CORE/app/src/views/admin/MembersTab.jsx`, change the import (line 2) from:

```jsx
import { Card, Button, Input, Select, Label, TrashIcon, Table, Thead, Th, Td, ErrorText, Page } from '@ecommons/ui'
```

to:

```jsx
import { Card, Button, Input, Select, Label, TrashIcon, Table, Thead, Th, Td, ErrorText, Page, SectionLabel } from '@ecommons/ui'
```

Then change (line 108):

```jsx
          <h4 style={{ margin: '0 0 var(--space-16)' }}>Add member</h4>
```

to:

```jsx
          <SectionLabel as="h4" style={{ margin: '0 0 var(--space-16)' }}>Add member</SectionLabel>
```

(Matches the existing convention already used elsewhere in this codebase, e.g. `PersonModal.jsx`'s `<SectionLabel as="h4" fontSize="0.85rem">Workgroups</SectionLabel>` — no `fontSize` override here since the raw `<h4>` had none, so `SectionLabel`'s `1rem` default applies.)

- [ ] **Step 4: Build and manual visual check**

```bash
cd ~/Projects/CORE/app
npm run build
npm run dev
```
Open `http://localhost:5175`, navigate to: a community's member list (click a member to open `PersonModal`), the Superadmin page, and the admin Members tab's "Add member" form. Confirm each of the 3 headings still reads at a comparable size/weight/position to before the swap (per Step 1's `fontSize="1.3rem"` choice for the modal name — adjust that value and re-check if it looks visually off, since the original raw `<h2>` had no explicit size and browser-default `h2` sizing varies). Stop the dev server afterward.

- [ ] **Step 5: Append the deferred-migration backlog note**

In `~/Projects/CORE/docs/todo.md`, after the existing "W3DS audit backlog (2026-07-21):" section (at the end of the file), append:

```

Frontend styling foundation (2026-07-21, see docs/superpowers/specs/2026-07-21-frontend-styling-foundation-design.md):
- Deferred: migrate 23 hand-rolled icon-button call sites to `Button variant="ghost"` (visual-fit
  verification needed per-site, not a pure mechanical swap)
- Deferred: migrate ~29 near-duplicate flex row/column inline-style blocks to the new `.row`/`.stack`
  utility classes
- Deferred: adopt the new `Muted` component at the 19 existing "muted small text" inline-style call
  sites
```

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/CORE
git add app/src/components/PersonModal.jsx app/src/views/SuperadminPage.jsx app/src/views/admin/MembersTab.jsx docs/todo.md
git commit -m "refactor: swap 3 raw heading tags for Heading/SectionLabel components"
```
