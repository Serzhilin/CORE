# CORE Frontend Styling Foundation — Design

## Problem

CORE's frontend (`app/`) has Tailwind installed (`tailwind.config.js`, `postcss.config.js`, `@tailwind` directives) but real Tailwind utility-class usage is effectively zero — it's dead weight. Meanwhile CORE already has a real design system, `@ecommons/ui`, adopted in 20 of 28 `.jsx` files (Card, SectionLabel, Input, Button, Select, Page, Label, Heading, ErrorText, Badge, TrashIcon, Loading, Avatar, Textarea, Tabs, Panel, and table/menu components). The gap isn't non-adoption — it's 433 `style={{...}}` inline blocks left over across those same 28 files, including 3 raw `<h1>/<h2>/<h4>` tags that duplicate what `<Heading>`/`<SectionLabel>` already do.

Frequency analysis of the inline styles breaks them into buckets:
- 3 raw heading tags — direct component swap, no gap.
- 23 hand-rolled icon-buttons (`background:'none', border:'none', cursor:'pointer'`) — duplicate of a `ghost` Button variant added upstream to `@ecommons/ui` on 2026-07-20, not yet pulled into CORE's stale install.
- ~29 near-identical `display:'flex', alignItems:'center', gap:var(--space-N)` (row) and column equivalents — the single most repeated shape codebase-wide, varying only by which space token.
- 19 near-identical "muted small text" blocks (`fontSize`, `color: var(--color-charcoal-light)`).
- Everything else (single-property spacing/fontSize one-offs) — legitimate per-instance divergence, not debt, per `ecommons-ui/MIGRATION.md`'s own documented convention that `style` is the sanctioned override mechanism.

Two secondary issues surfaced during investigation, unrelated to styling debt but worth fixing alongside it since they touch the same dependency:
- CORE's installed `@ecommons/ui` copy is stale (missing `ghost`).
- `ecommons-ui/README.md` still documents the pre-Codeberg-migration `github:` install URL; `CORE/EXTRACTION.md` still describes a superseded `file:` dependency method.

(Not a bug, verified and ruled out: `app/package.json` not declaring `@ecommons/ui` directly. CORE's `Dockerfile` already installs root `package*.json` before `app/`'s, which is the exact safe build order `ecommons-ui/README.md` documents as the correct consuming pattern — no fix needed.)

## Scope

**In scope (this spec):** dependency/install hygiene, dead Tailwind removal, two new reusable primitives added to `@ecommons/ui` (benefiting ALVer/WVTTK/w3ds_casco too), and the 3 trivial heading swaps.

**Explicitly deferred to a separate future plan:** migrating the 23 icon-button call sites to `Button variant="ghost"` and the ~29 row/stack call sites to the new layout utilities. Both are mechanical, per-file, independent — a good fit for `subagent-driven-development` once this foundation lands.

## Changes

### 1. Dependency/install fixes
- CORE root: reinstall `@ecommons/ui` from `git+ssh://git@codeberg.org/eCommons/ecommons-ui.git#main` to pick up `ghost` and anything else merged since the last install.
- `ecommons-ui/README.md`: fix "Install into a consuming app" section's install URL from the stale `github:Serzhilin/ecommons-ui#main` to the real `git+ssh://git@codeberg.org/eCommons/ecommons-ui.git#main`. Separate commit, in the `ecommons-ui` repo.
- `CORE/EXTRACTION.md`: correct the now-superseded `file:` dependency description to reflect the actual `git+ssh` dependency. Doc-only, no behavior change.

### 2. Remove dead Tailwind (`CORE/app/`)
- Before deleting anything: grep `app/src` for `className="..."` values that look like real Tailwind utility tokens (`flex`, `grid-cols-`, `p-`, `text-`, etc. in Tailwind's specific shorthand form) to confirm the earlier near-zero count still holds.
- Delete `tailwind.config.js`, `postcss.config.js`.
- In `src/index.css`: remove `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`. Keep `@import '@ecommons/ui/dist/index.css';` and the existing hand-written `label`, `.divider`, `.topbar-filter-break` selectors.
- Remove `tailwindcss`, `autoprefixer`, `postcss` from `app/package.json` devDependencies.
- Verify `npm run build` in `app/` still succeeds after removal.

### 3. New `@ecommons/ui` primitives

**`.row` / `.stack` utility classes**, added to `ecommons-ui/src/styles/layout.css` alongside the existing `.topbar-slot-row`:
- `.row`: `display: flex; align-items: center; gap: var(--gap, var(--space-8));`
- `.stack`: `display: flex; flex-direction: column; gap: var(--gap, var(--space-8));`
- Per-instance spacing override via inline `style={{ '--gap': 'var(--space-16)' }}` rather than a fixed value — matches what the ~29 call sites actually need (same shape, varying space token), without over-constraining to one spacing choice.
- Documented in `COMPONENTS.md` next to the other layout utility.

**`Muted` component**, added to `ecommons-ui/src/components/` (`Muted.tsx` + `Muted.css`, exported from `components/index.ts`, matching the existing per-component file pattern):
- Renders a `<span>` (or `as` prop for `<p>`/`<div>` when block-level is needed) in `color: var(--color-charcoal-light)`.
- `size` prop: `'sm' | 'xs'`, mapping to the two dominant fontSize values found in the 19 existing call sites (`0.875rem` / `0.75rem`) — a closed set, not a free-form fontSize prop, so it actually consolidates rather than just relocating the same freedom.
- Documented in `COMPONENTS.md` with prop table, matching `Label`/`ErrorText`'s existing documentation style.

### 4. Swap 3 raw headings
- `PersonModal.jsx:44`, `SuperadminPage.jsx:137`, `MembersTab.jsx:108`: replace raw `<h1>/<h2>/<h4>` + inline `fontFamily: var(--font-title)` styling with `<Heading>` or `<SectionLabel>`, matching whichever the surrounding 20-file convention already uses for equivalent visual weight at each call site.

### 5. Backlog note
Append one line to `CORE/docs/todo.md`'s existing "W3DS audit backlog" section (or a new small section) pointing at this spec and naming the deferred work: icon-button → `ghost` migration (23 sites), row/stack → utility-class migration (~29 sites).

## Testing / Verification

No automated test coverage exists for CSS/JSX styling in this codebase, and none is proposed — this is presentational, not behavioral, code. Verification is:
1. `npm run build` succeeds in `ecommons-ui` after adding `Muted` + `.row`/`.stack`.
2. `npm run build` succeeds in `CORE/app` after the Tailwind removal and dependency refresh.
3. Manual browser check (dev server) of the 3 screens touched by the heading swap (`PersonModal`, `SuperadminPage`, `MembersTab`) to confirm visual parity with the previous raw-heading rendering.
4. Manual browser check of one or two representative CORE screens (e.g. `LoginScreen`, one Tab view) to confirm no regression from stripping the `@tailwind` directives — expected to be a no-op given near-zero prior utility-class usage, confirmed rather than assumed.

## Out of scope
- The 23 icon-button and ~29 row/stack call-site migrations themselves (separate future plan).
- Any change to the "muted small text" call sites' actual usage — `Muted` ships as a primitive; adopting it at the 19 existing sites is part of the same deferred migration plan, not this spec.
