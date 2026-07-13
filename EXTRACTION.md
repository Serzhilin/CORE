# @ecommons/ui extraction — running checklist

Package lives at `../ecommons-ui` (sibling of CORE), consumed via `file:` dep,
built with tsup. CORE imports the **built** `dist/`, so every step here ends
with `npm run build` in `ecommons-ui` before switching back to CORE.

**Note (2026-07-13):** `ecommons-ui` had no git repo until now — its own repo
was only just initialized (`git init`, commit `a97199e`, covering tokens +
base styles). Earlier notes below citing a single CORE commit hash for both
sides were wrong: those commits only ever touched CORE's files (`index.css`,
`package.json`); the ecommons-ui-side content was uncommitted until this
fix. Going forward each batch gets one commit in `ecommons-ui`'s own repo
and one in CORE's, referenced separately.

Full CORE frontend codebase read (28 files: index.css, all components, all
views, all views/admin, all views/graph, all contexts, App.jsx, main.jsx)
before starting extraction, per instruction.

## Status: token + base-style batches done. Card, Button, Input, Badge, Modal, ProgressBar, EmojiBadge, EmojiPicker components done. Layout primitives next.

## Tokens (src/index.css → ecommons-ui/src/tokens/index.css)

- [x] Colors: `--color-cream`, `--color-cream-dark`, `--color-terracotta`, `--color-amber`, `--color-charcoal`, `--color-charcoal-light`, `--color-sand`, `--color-sand-dark`, `--color-green`, `--color-red`
- [x] Fonts: `--font-title` (Barlow Condensed), `--font-sans` (Instrument Sans) + the Google Fonts `@import`
- [x] Shadows: `--block-shadow-color`, `--block-shadow`, `--block-shadow-sm`, `--shadow-card`, `--shadow-card-hover`
  - **Note:** `--block-shadow-color` is mutated at runtime by `CommunityContext.jsx` (`document.documentElement.style.setProperty(...)`) to the community's brand color. This is CORE-specific *behavior*, stays in CORE — only the token *declaration/default* moved to ecommons-ui.
  - Moved to `ecommons-ui/src/tokens/index.css` (ecommons-ui commit `a97199e`), consumed in CORE via `@import '@ecommons/ui/dist/index.css'` in `app/src/index.css` (CORE commit `fcecd26`). Verified byte-identical values in CORE's built CSS.
- [x] Base element styles: `*` box-sizing, `body`, `#root`, `h1/h2/h3`
  - Moved to `ecommons-ui/src/tokens/index.css` (ecommons-ui commit `a97199e`), dropped from CORE's `app/src/index.css` (CORE commit `8e357a2`). Verified byte-identical (`#root{min-height:100vh}`, `h1{font-size:2.6rem}`) in CORE's built CSS.

## Dead-CSS audit (2026-07-13)

Before batch 2, grepped every CSS-class name in `index.css` against actual
`.jsx` usage (className strings and inline patterns). Result — **live** vs
**dead** (zero usages anywhere in CORE's frontend):

- **Live:** `.card`/`.card-warm` (16 files), `.btn-primary`/`.btn-secondary` (15 files), `.emoji-mono` (8 files), plus base body/h1-h3/box-sizing (implicit, always active).
- **Dead (0 matches):** `.input` (all call sites hand-roll their own inline `inputStyle` instead — already flagged above), `.badge`+variants, `.modal-overlay`/`.modal` (real modals like `PersonModal.jsx`/`InfoPanel.jsx` hand-roll their own inline overlay styles, with a slightly different opacity: `rgba(44,44,44,0.4)` vs the dead class's `0.45`), `.progress-bar`/`.progress-bar-fill` (no progress bar rendered anywhere), `.btn-danger`, `.btn-green`, `.divider`, `pulse-ring` keyframe, all `.animate-*`/`.greeting-flash`/`.reveal-result` classes, `.agenda-html`, `.tiptap`, `.ProseMirror`, `.upcoming-row-btn`. Likely leftover boilerplate copy-pasted from a sibling project (ALVer has real meeting-agenda/rich-text features).

**User decision 2026-07-13:** build `Input`/`Badge`/`Modal`/`ProgressBar` as
real components in `ecommons-ui` from this CSS anyway, even though nothing
in CORE currently uses the classes — no CORE call-site swap for these (there
is nothing to swap), they just live in the package for future use.

Animations, scrollbar styling, `.divider`, and the `.agenda-html`/`.tiptap`/
`.ProseMirror`/`.upcoming-row-btn` prose/meeting blocks are **not** part of
the named component list and were not covered by that decision — left as-is
in CORE for now, flagged here as dead-code cleanup candidates rather than
extracted.

- [ ] Animations: `pulse-ring`, `slideIn`, `fadeIn`, `scaleIn`, `pulse-soft`, `greetingFlash`, `revealResult` + their `.animate-*`/`.greeting-flash`/`.reveal-result` classes — **dead code, left in CORE, not extracted**
- [ ] Scrollbar styling (`::-webkit-scrollbar*`) — live (global, always active), candidate for a later base-style batch
- [ ] Rich text / prose styles: `.agenda-html`, `.tiptap`, `.ProseMirror`, `.upcoming-row-btn` — **dead code, left in CORE, not extracted**

## Presentational components → real React components in ecommons-ui

Per the instruction ("buttons, cards, inputs, modals, badges... rewritten as
pure props-in/render-out components"), these currently exist only as CSS
classes (`.card`, `.btn-primary`, `.input`, `.badge-*`) applied directly in
JSX — no dedicated component files. Extraction means creating the component,
not just moving CSS.

- [x] `Card` (from `.card` / `.card-warm`)
  - Created in `ecommons-ui/src/components/Card.tsx` + `Card.css` (ecommons-ui commit `883cfca`), `variant?: 'default' | 'warm'` prop maps to `.card`/`.card-warm`. Swapped all 22 usage sites across 13 CORE files (`AvailabilityTab.jsx`, `MyWorkgroups.jsx`, `MyProfile.jsx`, `PersonModal.jsx`, `MyAvailability.jsx`, `OnboardingScreen.jsx`, `CardGrid.jsx`, `SuperadminPage.jsx`, `MembersTab.jsx`, `CommunityTab.jsx`, `WorkgroupsTab.jsx`, `W3dsLinkCard.jsx`, `LoginScreen.jsx`) to `<Card>`/`<Card variant="warm">` from `@ecommons/ui`. Removed `.card`/`.card-warm` from CORE's `app/src/index.css`. Verified `vite build` clean, zero remaining `className="card"` matches.
- [x] `Button` (from `.btn-primary` / `.btn-secondary` / `.btn-danger` / `.btn-green` — variant prop)
  - Created in `ecommons-ui/src/components/Button.tsx` + `Button.css` (ecommons-ui commit `7c47f58`), `variant?: 'primary' | 'secondary' | 'danger' | 'green'` prop (default `'primary'`), all 4 CSS blocks moved byte-identical (danger/green unused in CORE, built anyway per the dead-CSS decision above). Swapped all `<button>` usage sites across 8 CORE files (`MembersTab.jsx`, `W3dsLinkCard.jsx`, `MyProfile.jsx`, `SuperadminPage.jsx`, `WorkgroupsTab.jsx`, `AvailabilityTab.jsx`, `CommunityTab.jsx`, `MyAvailability.jsx`) to `<Button>`/`<Button variant="secondary">` from `@ecommons/ui`. **Left untouched:** 3 `<label className="btn-secondary">` sites in `CommunityTab.jsx` (statuten/logo/photo upload triggers) — these are `<label>` elements wrapping a hidden `<input type="file">`, not `<button>`s, so they can't become `<Button>` (a real `<button>` there would lose the native label-for-file-input click behavior); they still pick up the `.btn-secondary` styling via the CSS shipped in `ecommons-ui`. Removed `.btn-primary`/`.btn-secondary`/`.btn-danger`/`.btn-green` from CORE's `app/src/index.css`. Verified `vite build` clean.
- [x] `Input` (from `.input`, incl. `textarea.input`)
  - Created in `ecommons-ui/src/components/Input.tsx` + `Input.css` (ecommons-ui commit `1e008f1`): `Input` (renders `<input>`) and `Textarea` (renders `<textarea>`), both apply the `.input` class, CSS moved byte-identical. Per the 2026-07-13 dead-CSS decision, built as real components even though nothing in CORE currently uses `.input` — **no CORE call-site swap** (there is nothing to swap; every current usage hand-rolls its own inline `inputStyle`, see below). Removed dead `.input`/`textarea.input` CSS from CORE's `app/src/index.css`. Verified `vite build` clean.
  - Several files hand-roll an equivalent inline `inputStyle` object instead of using the class (`OrganogramView`, `MyAvailability`, `MyWorkgroups`, `W3dsLinkCard`, `CommunityTab`, `MembersTab`, `WorkgroupsTab`, `AvailabilityTab`, `MyProfile`) — converging these onto the new `Input`/`Textarea` components is a visible-behavior-adjacent call (some have `padding: '7px 10px'` vs `'10px 14px'`, some borders `1px solid var(--color-sand-dark)` vs the real `.input`'s `2px solid var(--color-charcoal)`) — **will ask before unifying these, since some already visibly diverge from `.input`**
- [x] `Badge` (from `.badge` + `-orange`/`-green`/`-red`/`-gray`/`-blue`)
  - Created in `ecommons-ui/src/components/Badge.tsx` + `Badge.css` (ecommons-ui commit `8338971`), `variant?: 'orange' | 'green' | 'red' | 'gray' | 'blue'` prop (default `'gray'`), CSS moved byte-identical. Dead CSS (0 usages in CORE) — built anyway per the 2026-07-13 decision, no CORE call-site swap. Removed `.badge`/`.badge-*` from CORE's `app/src/index.css`. Verified `vite build` clean.
- [x] `Modal` (from `.modal-overlay` + `.modal` — currently hand-rolled inline wherever a dialog is needed, e.g. `PersonModal.jsx`)
  - Created in `ecommons-ui/src/components/Modal.tsx` + `Modal.css` (ecommons-ui commit `a7cc48d`). CSS moved, keyframes renamed `modal-fade-in`/`modal-scale-in` (from `fadeIn`/`scaleIn`) to avoid collision with CORE's own identically-named keyframes still used by `.animate-fade-in`/`.animate-scale-in`. Dead CSS (0 usages in CORE — real modals like `PersonModal.jsx` hand-roll their own inline overlay) — built anyway per the 2026-07-13 decision, no CORE call-site swap. Removed `.modal-overlay`/`.modal` from CORE's `app/src/index.css` (kept `@keyframes fadeIn`/`scaleIn` intact — still used). Verified `vite build` clean.
- [x] `AvailabilityBadge` → generalized to `EmojiBadge` (props: `emoji`, `tooltip`, `inline`)
  - Created in `ecommons-ui/src/components/EmojiBadge.tsx` + `EmojiBadge.css` (ecommons-ui commit `a2a2b3d`), byte-identical `.emoji-mono` CSS. CORE's `AvailabilityBadge.jsx` rewritten as a thin wrapper: unwraps `availability.type.emoji`/`reason`/`until` into `tooltip`, delegates rendering to `<EmojiBadge>` — used unchanged at both call sites (`CardGrid.jsx`, `PersonModal.jsx`). Removed `.emoji-mono` from CORE's `app/src/index.css`. Verified `vite build` clean.
- [x] `EmojiPicker` — mostly pure; the 5 built-in emoji categories are baked-in data, not CORE domain logic, so it moved whole.
  - Confirmed with user before moving (2026-07-13). Created in `ecommons-ui/src/components/EmojiPicker.tsx` (ecommons-ui commit `c84598a`), moved verbatim (`value`/`onChange` props, same 5 baked-in categories, same inline styles, relies on `.emoji-mono` already shipped via `EmojiBadge`). Deleted CORE's local `app/src/components/EmojiPicker.jsx`, swapped its 2 usage sites in `AvailabilityTab.jsx` to import from `@ecommons/ui`. Verified `vite build` clean.
- [x] `ProgressBar` (from `.progress-bar` / `.progress-bar-fill`)
  - Created in `ecommons-ui/src/components/ProgressBar.tsx` + `ProgressBar.css` (ecommons-ui commit `d162e4f`), `value` prop (0-100) sets fill width. CSS moved byte-identical. Dead CSS (0 usages in CORE) — built anyway per the 2026-07-13 decision, no CORE call-site swap. Removed `.progress-bar`/`.progress-bar-fill` from CORE's `app/src/index.css`. Verified `vite build` clean.
- [ ] Layout primitive: collapsible slot/panel toggle pattern (the `‹›` toggle button + width-animated panel seen in `InfoPanel.jsx`) — only the generic shell, not `InfoPanel` itself (which is deeply CORE-data-coupled: community/workgroup/person views, `useCommunity()`)
- [ ] Layout primitive: the `.topbar-slot-row` responsive-slot CSS pattern (absolute-centered on desktop, static full-width row on mobile) — portable as a generic layout utility even though today it's only used by CORE's `TopBar`

## NOT extractable as whole components (CORE-specific logic/data, stay in CORE)

- `InfoPanel.jsx` — imports `useCommunity()`, renders community/workgroup/person data shapes
- `LoginScreen.jsx` — imports CORE's `getAuthOffer`/`subscribeToAuthSession` API client, W3DS/eID copy and branding
- `PersonModal.jsx` — imports `useUser`/`useCommunity`, renders member profile data (only its modal-shell *pattern* is extractable, see above)
- `W3dsLinkCard.jsx` — imports CORE API client functions (`resolveCommunityW3id` etc.), W3DS business logic. Also has its own **duplicated** local `inputStyle` (doesn't use `.input`) — noted as an inconsistency but not touched until `Input` extraction decision above is resolved.
- `TopBar.jsx`, `CardGrid.jsx`, `OrganogramView.jsx`, `MyProfile.jsx`, `MyWorkgroups.jsx`, `MyAvailability.jsx`, `OnboardingScreen.jsx`, `AdminPanel.jsx`, `SuperadminPage.jsx`, all `views/admin/*`, all `views/graph/*`, `DeeplinkLogin.jsx` — all import CORE contexts (`useUser`, `useCommunity`, `useTopBarSlot`) and/or CORE's `api/client`, or render CORE-specific data (graph nodes tied to person/workgroup ids, member tables, etc.). These stay in CORE. Their *usages* of `.card`/`.btn-*`/`.input`/`.badge-*` classes are what get swapped to `@ecommons/ui` component imports once those components exist.

## "ActionCard renderer" — skipped

No `ActionCard` component/file exists anywhere in CORE (confirmed by reading
all 28 frontend files). User decision 2026-07-13: skip this item, proceed
with tokens + the other named components only.

## Process reminder (per instruction)

1. One token batch or one component at a time.
2. After each: rebuild `ecommons-ui` (`npm run build`), swap the usage in
   CORE to the `@ecommons/ui` import, verify CORE builds (`vite build`).
3. Commit after each working extraction.
4. Stop and ask before any change that affects visible behavior, not just
   code location (e.g. the `Input` divergence above, or unifying padding/
   border values that currently differ file-to-file).
