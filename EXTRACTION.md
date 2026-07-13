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

## Status: token + base-style batches done. Card, Button, Input, Select, Badge, Modal, ProgressBar, EmojiBadge, EmojiPicker, CollapsiblePanel, Panel, Avatar, Label, Icon/TrashIcon + topbar-slot-row layout primitives done. Input divergence resolved (unified to `.input` look). Dead animation/prose CSS deleted. Subagent completeness audit (2026-07-13) found 4 items, all 4 now resolved (see below). Post-audit gap list identified (Avatar, Label, Icon, Dropdown/Menu, Table, Tabs, Checkbox, Toast, Loading, Typography, Layout shell) — extracting one at a time; user approved extracting all remaining items in sequence. Avatar, Label, Icon done. Next: Dropdown/Menu.

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

- [x] Animations: `pulse-ring`, `slideIn`, `fadeIn`, `scaleIn`, `pulse-soft`, `greetingFlash`, `revealResult` + their `.animate-*`/`.greeting-flash`/`.reveal-result` classes — confirmed dead (2026-07-13, grepped all CORE `.jsx`, zero matches), **deleted** from CORE's `app/src/index.css`. Not moved to ecommons-ui (dead code, nothing to preserve). Verified `vite build` clean.
- [x] Scrollbar styling (`::-webkit-scrollbar*`) — moved byte-identical to `ecommons-ui/src/tokens/index.css` (ecommons-ui commit `b85bb37`), removed from CORE's `app/src/index.css`. Verified `vite build` clean.
- [x] Rich text / prose styles: `.agenda-html`, `.tiptap`, `.ProseMirror`, `.upcoming-row-btn` — confirmed dead (2026-07-13, grepped all CORE `.jsx`, zero matches), **deleted** from CORE's `app/src/index.css`. Not moved to ecommons-ui (dead code, nothing to preserve). Verified `vite build` clean.

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
  - Several files hand-rolled an equivalent inline `inputStyle` object instead of using the class (`OrganogramView`, `MyAvailability`, `MyWorkgroups`, `W3dsLinkCard`, `CommunityTab`, `MembersTab`, `WorkgroupsTab`, `AvailabilityTab`, `MyProfile`, plus `SuperadminPage` found later) — converging these onto the new `Input`/`Textarea` components is a visible-behavior-adjacent call (some have `padding: '7px 10px'` vs `'10px 14px'`, some borders `1px solid var(--color-sand-dark)` vs the real `.input`'s `2px solid var(--color-charcoal)`).
  - **User decision 2026-07-13: unify to `.input`'s look**, accepting the resulting visible change (thicker charcoal border, focus ring, placeholder styling) across these forms. Swapped every `<input>`/`<textarea>` using the named `inputStyle` const (or `{ ...inputStyle, ... }` spread) to `<Input>`/`<Textarea>` from `@ecommons/ui`, layering component-specific sizing via the `style` prop (e.g. `width: 90`, `flex: 1`, `fontFamily: 'monospace'`), dropping now-redundant border/padding/font-size/background overrides that `.input`'s CSS already supplies. Files touched: `OrganogramView.jsx`, `MyAvailability.jsx`, `W3dsLinkCard.jsx`, `CommunityTab.jsx`, `MembersTab.jsx`, `WorkgroupsTab.jsx`, `AvailabilityTab.jsx`, `MyProfile.jsx`, `SuperadminPage.jsx` (9 files with actual `<input>`/`<textarea>` swaps; `MyWorkgroups.jsx` reviewed, no-op — only a `<select>` uses `inputStyle`).
  - **Deliberately left out of scope** (not part of the named `inputStyle` pattern, no unapproved new components introduced): `<select>` elements (still using local `inputStyle` const where present — `OrganogramView`, `MyAvailability`, `CommunityTab`, `MembersTab`, `WorkgroupsTab`, `AvailabilityTab`), `type="color"` and `type="file"` inputs, and `MembersTab.jsx`'s separate inline-cell date-editor `<input>` (its own distinct local style object, not the named `inputStyle` const).
  - Local `inputStyle` const deleted where it became fully unused after swapping (`W3dsLinkCard.jsx`, `MyProfile.jsx`, `SuperadminPage.jsx`); kept where a `<select>` (or other consumer) still references it (`OrganogramView.jsx`, `MyAvailability.jsx`, `CommunityTab.jsx`, `MembersTab.jsx`, `WorkgroupsTab.jsx`, `AvailabilityTab.jsx`).
  - Verified `vite build` clean after the full batch.
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
- [x] Layout primitive: collapsible slot/panel toggle pattern (the `‹›` toggle button + width-animated panel seen in `InfoPanel.jsx`) — only the generic shell, not `InfoPanel` itself (which is deeply CORE-data-coupled: community/workgroup/person views, `useCommunity()`)
  - Created `CollapsiblePanel` in `ecommons-ui/src/components/CollapsiblePanel.tsx` (ecommons-ui commit `3a53a31`), props `open`, `onToggle`, `accentColor` (default `var(--color-terracotta)`), `width` (default `300`), `children` — moved verbatim from InfoPanel's desktop-only toggle+panel JSX block. CORE's `InfoPanel.jsx` desktop return block replaced with `<CollapsiblePanel open={open} onToggle={...} accentColor={accent} width={PANEL_WIDTH}>{renderContent()}</CollapsiblePanel>`; the mobile slide-over drawer branch (different pattern — full-screen overlay + close ×) was left untouched, out of scope per the original note. Verified `vite build` clean.
- [x] Layout primitive: the `.topbar-slot-row` responsive-slot CSS pattern (absolute-centered on desktop, static full-width row on mobile) — portable as a generic layout utility even though today it's only used by CORE's `TopBar`
  - Moved to `ecommons-ui/src/styles/layout.css` (ecommons-ui commit `3a53a31`), imported globally alongside tokens in `src/index.ts`. CSS moved byte-identical. No CORE call-site change needed — `TopBar.jsx` still references `className="topbar-slot-row"`, now resolved via the `@ecommons/ui` `@import`. Removed the class from CORE's `app/src/index.css`. Verified `vite build` clean.
- [x] `Panel` — generic bordered-box neubrutalist frame (2px charcoal border + block-shadow + radius 0), found hand-rolled inline in 3 spots after auditing token-var usage vs actual component usage (see below)
  - Created `Panel.tsx` + `Panel.css` in `ecommons-ui/src/components/` (ecommons-ui commit `af9496b`): a div component (`shadow?: 'default' | 'sm'` prop, default maps to `var(--block-shadow)`, `'sm'` to `var(--block-shadow-sm)`) plus the raw `.panel-frame`/`.panel-frame-sm` CSS classes shipped globally, for applying the same frame directly to non-div elements (e.g. `<svg>`). Swapped 3 CORE call sites: `OrganogramView.jsx`'s view-toggle button wrapper (`<Panel shadow="sm">`), `views/graph/ForceGraph.jsx`'s SVG canvas (`className="panel-frame"` directly on the `<svg>`, since Panel renders a div), `components/TopBar.jsx`'s account dropdown menu (`<Panel>`). All 3 already used `var(--color-charcoal)`/`var(--block-shadow*)` tokens correctly — the audit finding was that the *composition* (border+shadow+radius0 repeating 3+ places) was still duplicated inline rather than componentized. Verified `vite build` clean.

## Completeness audit (2026-07-13, via subagent) — findings 1-4

Dispatched a subagent to check whether all styling was actually extracted.
It found 4 items beyond what's tracked above:

1. **`<select>` frame duplication across 6 files** (`OrganogramView`,
   `MyAvailability`, `CommunityTab`, `MembersTab`, `WorkgroupsTab`,
   `AvailabilityTab`) — each still hand-rolls a local `inputStyle` const for
   `<select>` elements, since the earlier Input/Textarea unification
   deliberately excluded `<select>` (see note above). **Resolved 2026-07-13
   (user requested a real `Select` component):** created
   `ecommons-ui/src/components/Select.tsx` (ecommons-ui commit `e556366`) —
   same pattern as `Input`/`Textarea`, wraps `<select>` in the `.input`
   class. Swapped every `<select>` across all 6 files (7 files counting
   `OrganogramView`'s prior `className="input"` selects, redone as real
   `<Select>`), deleted the now-fully-unused `inputStyle` consts. CORE
   commit `7b54ac1`.
   - **Caught in the same pass:** `.input`'s `width: 100%` stretches a
     `<select>` to fill its flex/block container — none of the original
     hand-rolled selects had `width: 100%` (they auto-sized to content), so
     this would've been a silent layout regression, including in
     `OrganogramView`'s two selects from item 2's earlier fix (already
     shipped without a width override). Added explicit `width: 'auto'`
     overrides wherever a select needs to keep its original auto-sizing;
     left `width: 100%` (i.e. no override) only where the select was
     already in a container that made `100%` correct (e.g. `CommunityTab`'s
     title-font select, matching its sibling `Input` fields in the same
     form). Verified `vite build` clean.
2. **`OrganogramView.jsx`'s two `<select>`s had a permanent block-shadow** —
   its local `inputStyle` applied `boxShadow: 'var(--block-shadow-sm)'`
   unconditionally, but the real `.input` CSS only applies that shadow (and
   the terracotta border) on `:focus`. **Fixed**: swapped both selects to
   `className="input"` (bypassing the need for a new `Select` component —
   `.input`'s CSS applies to any element, not just `<input>`/`<textarea>`),
   deleted the now-unused local `inputStyle` const. Verified `vite build`
   clean, committed.
3. **Badge/chip pattern hand-rolled in 4 files, zero `Badge` usage** —
   `InfoPanel.jsx` (Admin pill, membershipType pill, per-role color chips),
   `PersonModal.jsx` (Admin pill, membershipType pill with hardcoded
   `#FFF3CD`), `MyWorkgroups.jsx` (per-role color chips), `WorkgroupsTab.jsx`
   (per-role color chips). The existing `Badge` component's fixed 5-variant
   enum can't represent dynamic per-role colors or off-palette pills.
   **User decision 2026-07-13: add a `color` override prop to `Badge`**
   (derives `background`/`borderColor` from a hex value, bypassing the
   variant classes) plus a `plain` variant (no forced color/border, for
   pills like Admin/membershipType that need full custom `style` control).
   Implemented in `ecommons-ui/src/components/Badge.tsx`+`.css` (ecommons-ui
   commit `790c668`) — border moved off the shared `.badge` base and onto
   each variant class individually (mechanical, no visual change) plus new
   `.badge-custom` (border-width only, color inline). Swapped all 4 CORE
   files onto `<Badge>`, preserving each site's exact alpha/border/padding
   via `style` overrides where it diverged from Badge's new defaults (e.g.
   `MyWorkgroups`'s `20`-alpha background vs the default `22`,
   `WorkgroupsTab`'s full-opacity border vs the default `66`-alpha). CORE
   commit `326f80e`. Verified `vite build` clean.
4. **`SuperadminPage.jsx`'s status pill mixed a CSS-var fallback with a
   hardcoded hex** — `background: var(--color-green, #dcfce7)`,
   `color: '#166534'`, neither matching the actual `--color-green`/badge
   token palette. **Fixed**: swapped to `<Badge variant="green">`/`<Badge
   variant="gray">` (a clean 1:1 match — no new API needed, this was
   basically an unBadged 2-state badge). CORE commit `d4a94fb`. Verified
   `vite build` clean.

## Post-audit gap list (2026-07-13) — un-extracted JSX-shape patterns

The subagent audit above grepped for duplicated CSS/token *values*, which by
construction misses duplicated *shapes* (repeated JSX patterns with no
shared class/const to grep for). User pushed back on the "gaps" framing
("things DO EXIST in CORE — why not extract them?") — clarified these were
never extracted because they were never a named/approved target, not
because they're impossible. Agreed to extract one at a time, same process,
starting with Avatar then Label.

- [x] `Avatar` (img-or-initials circle, `borderRadius: '50%'`) — found hand-rolled in `InfoPanel.jsx`, `PersonModal.jsx`, `TopBar.jsx`
  - Created `ecommons-ui/src/components/Avatar.tsx` (ecommons-ui commit `d0362b4`), no dedicated CSS file (pure inline-style component, matching all 3 original sites). Props: `src`, `alt`, `size` (required), `background` (default `var(--color-sand-dark)`), `color` (default `white`), `fontSize`, `fontWeight` (default `700`), `style`, `children` — renders `<img>` when `src` is truthy, else a flex-centered div showing `children` (initials). Caller-supplied `style` spread last so any property can be overridden per site.
  - Exempt from the `border-radius: 0` neubrutalist rule by design (avatars are circular).
  - Swapped 3 genuine call sites: `InfoPanel.jsx` (`size={104}`, `fontSize="2.2rem"`), `PersonModal.jsx` (`size={52}`, `fontSize="1.2rem"`, `fontWeight={600}`), `TopBar.jsx` (`size={51}`, `fontSize="1.3rem"`, `fontWeight={600}`, dynamic `background` for admin vs non-admin).
  - `TopBar.jsx` structural note: its avatar was a self-styled `<button>` (the button *was* the circle). Restructured into a plain reset-styled `<button>` (no border/padding/background) wrapping the new `<Avatar>`, which now owns all circle styling. Judged pixel-identical output (same size/colors/position, only DOM nesting changed) so this did not require a fresh visible-behavior question.
  - **Excluded from scope:** small colored status/workgroup dots in `TopBar.jsx` and `InfoPanel.jsx` that also use `borderRadius: '50%'` but are indicator dots, not avatars (false-positive grep matches). `CardGrid.jsx`'s avatar-or-fallback block — its no-image fallback is a bespoke SVG ring data-viz (workgroup/role color rings), not a plain initials circle, so it's a genuinely different, CORE-specific component, not the same pattern.
  - CORE commit `73459ef`. Verified `vite build` clean across all 3 files.
- [x] `Label` (`display:block, marginBottom, fontSize, fontWeight:500` form-field label) — found hand-rolled identically across 6 files
  - Created `ecommons-ui/src/components/Label.tsx` (ecommons-ui commit `8c2de1c`), no dedicated CSS (pure inline-style component). Props: standard `LabelHTMLAttributes<HTMLLabelElement>` plus `size?: 'sm' | 'md'` (default `'md'`) mapping to `fontSize: '0.8rem'`/`'0.85rem'`; base style always sets `display:'block', marginBottom:4, fontWeight:500`; caller `style` spread last for per-site overrides.
  - Swapped 9 call sites total across 6 files: `MyProfile.jsx` (8, `md`), `MyAvailability.jsx` (3, `md`), `admin/AvailabilityTab.jsx` (4, `sm`), `admin/MembersTab.jsx` (5, `sm`), `admin/WorkgroupsTab.jsx` (4, `sm`; 2 needed `style={{ marginBottom: 6 }}` override), `admin/CommunityTab.jsx` (9, `md`; 3 needed `style={{ marginBottom: 8 }}` override for the Statuten/Logo/Group-photo upload sections).
  - **Caught mid-edit:** a blind `</label>` → `</Label>` replace in `CommunityTab.jsx` initially also flipped the closing tags of 3 unrelated `<label className="btn-secondary">` file-upload triggers (filtered out of the original grep because it excluded lines containing "btn-secondary"), breaking the build with mismatched tags. Fixed by reverting those 3 closing tags back to `</label>`; re-verified with an open/close count check (`grep -c "<Label"` vs `grep -c "</Label>"`) across all 6 files before the final build.
  - **Excluded from scope:** `OrganogramView.jsx`'s checkbox `<label style={checkStyle}>` (different shape — a clickable checkbox row, not a form-field caption), `SuperadminPage.jsx`'s inline status `<label>` (different shape — no `display`/`marginBottom`/`fontWeight`), `CommunityTab.jsx`'s 3 `<label className="btn-secondary">` file-input triggers (a styled-button-via-label pattern, not this component).
  - CORE commit `56de5f0`. Verified `vite build` clean.
- [x] `Icon` shell + `TrashIcon` (feather-style `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">` outer shape) — trash-can path found duplicated verbatim 7x
  - Created `ecommons-ui/src/components/Icon.tsx` (ecommons-ui commit `e07e5e9`), no dedicated CSS. Exports generic `Icon` (props `size` default `16`, `strokeWidth` default `2`, `style`, `children` — renders the shared outer `<svg>` shell) and concrete `TrashIcon` (props `size` default `14`, `style` — built on `Icon`, hardcodes the 5-path trash shape).
  - Only `TrashIcon` extracted as a named icon: its exact path data was duplicated verbatim across `CommunityTab.jsx` (x3, all `size=14`), `AvailabilityTab.jsx` (x1, `size=14`), `MembersTab.jsx` (x1, `size=15`), `WorkgroupsTab.jsx` (x2, `size=14`) — 7 sites total, all swapped to `<TrashIcon />`/`<TrashIcon size={15} />`.
  - **Excluded from scope:** the camera icon (`MyProfile.jsx`), chevron/arrow icons (`MyWorkgroups.jsx` x3), and pencil icon (`MembersTab.jsx`) are each used exactly once — one-off, not duplicated — so left as inline `<svg>`, same bar as `CardGrid.jsx`'s excluded avatar-ring SVG.
  - CORE commit `46cf10a`. Verified `vite build` clean, zero remaining matches for the trash path string.

## NOT extractable as whole components (CORE-specific logic/data, stay in CORE)

- `InfoPanel.jsx` — imports `useCommunity()`, renders community/workgroup/person data shapes
- `LoginScreen.jsx` — imports CORE's `getAuthOffer`/`subscribeToAuthSession` API client, W3DS/eID copy and branding
- `PersonModal.jsx` — imports `useUser`/`useCommunity`, renders member profile data (only its modal-shell *pattern* is extractable, see above)
- `W3dsLinkCard.jsx` — imports CORE API client functions (`resolveCommunityW3id` etc.), W3DS business logic. Its inline `inputStyle` was unified to `<Input>` per the Input-divergence resolution above; the const itself is now deleted from this file.
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
