# CORE ecommons-ui Inline-Style Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate CORE's ~433 hand-rolled `style={{}}` blocks across 28 files so the app relies on `@ecommons/ui` components and design tokens as its primary styling mechanism, folding in the 3 already-deferred backlog items (icon-button → `Button variant="ghost"`, row/col wrappers → `.row`/`.stack`, muted text → `Muted`) along the way.

**Architecture:** Per-file CSS Modules (`ComponentName.module.css`, imported as `styles`, applied via `className`) hold every static style block. Genuinely runtime-computed values (data-driven colors, percentages, toggle-driven transforms) stay inline via `style={{}}`, restricted to only the dynamic properties — every static property in that same object moves to the module class. Where an ecommons-ui component already covers the block (`Card`, `Button`, `Badge`, etc.), swap it in instead of writing a class at all — that always wins over rule 2 or 3.

**Tech Stack:** React 18, Vite, `@ecommons/ui` (workspace package), CSS Modules, no CSS-in-JS runtime.

## Global Constraints

- No visual-behavior changes. This is a like-for-like style-authoring migration — same computed layout, same colors, same breakpoints.
- Every CSS Module value must use an ecommons-ui design token (`var(--space-*)`, `var(--color-*)`, `var(--font-*)`, `var(--block-shadow-*)`) wherever a token covers the value. Never a raw literal duplicating a token (e.g. never `padding: 32px` when `var(--space-32)` exists).
- Classification order for every block: (1) does an ecommons-ui component already do this — swap it in; (2) bespoke static layout — CSS Module class; (3) genuinely runtime-computed — stays inline, dynamic properties only.
- CSS Modules are per-file (`ComponentName.module.css` next to `ComponentName.jsx`), never global `index.css` additions.
- Each task ends with `npm run build` passing clean and a scoped commit.
- No browser automation available in this environment. Verification per task is: build passes, dev server boots, grep confirms no stray `style={{` beyond the task's documented allow-listed dynamic set. Real visual/rendering confirmation is owed to the user separately and must not be claimed as done.
- Two flagged inconsistencies (see Task 7 and Task 5) are surfaced to the user inline in this plan rather than silently normalized, per the design's explicit constraint.

---

## ecommons-ui Component API Quick Reference

```
Card       <Card style={{...}}>            — bordered white panel, padding built in
Panel      <Panel shadow="sm|md">           — raised surface, optional shadow
Button     <Button variant="primary|secondary|ghost|danger" size="sm|md">
Badge      <Badge style={{ borderColor, background }}>  — pill chip, accepts dynamic overrides via style
Input      <Input />, <Textarea />          — form fields, ref-forwarding
Select     <Select>...</Select>             — native select styled
Label      <Label>Text</Label>              — form field label
Heading    <Heading as="h1|h2|h3">          — semantic heading, token-styled
SectionLabel <SectionLabel>TEXT</SectionLabel> — uppercase small-caps section header
Muted      <Muted>text</Muted>              — small muted-color text span
ErrorText  <ErrorText>message</ErrorText>   — red inline error text
Loading    <Loading>children?</Loading>     — centered spinner + optional label
Avatar     <Avatar src={url} name={name} size={n} />
MenuItem   <MenuItem onClick={...}>Label</MenuItem>
Table, Thead, Th, Td   from '@ecommons/ui'  — token-styled table primitives; Td accepts `muted` prop
Tabs       <Tabs tabs={[...]} active={id} onChange={...} activeColor={hex} />
CollapsiblePanel <CollapsiblePanel title="..." defaultOpen={bool}>
Page       <Page maxWidth={n}>              — centered content wrapper with standard padding
Icon, TrashIcon  <TrashIcon onClick={...} />  — real SVG icon components, not raw <svg>
EmojiPicker, EmojiBadge
ProgressBar <ProgressBar value={pct} />
Modal      <Modal open={bool} onClose={...}>  — real overlay + centered panel, replaces hand-rolled fixed-overlay divs
```

## Substitution Rules (apply across every task)

| Hand-rolled pattern found in CORE | Replace with |
|---|---|
| `<label className="btn-secondary" style={{...}}>Upload</label>` wrapping a hidden `<input type=file>` | Keep native `<label>` (Button wraps `<button>`, not `<label>`) but replace `className="btn-secondary"` + inline style with a `.fileBtn` module class replicating the button look with tokens |
| Raw `<svg>`-only icon button (`onClick` on a bare `<svg>` or a `<button>` wrapping only an `<svg>`, no text) | `<TrashIcon onClick={...} />` if it's a delete/trash icon; otherwise wrap in `<Button variant="ghost" size="sm">` with the svg as children |
| `<div style={{display:'flex', flexDirection:'row', gap:...}}>` | `.row` utility class (already ships in ecommons-ui global styles) |
| `<div style={{display:'flex', flexDirection:'column', gap:...}}>` | `.stack` utility class (already ships in ecommons-ui global styles) |
| `<span style={{fontSize:'0.85rem', color:'var(--color-charcoal-light)'}}>` (or equivalent muted small text) | `<Muted>` component |
| `<div style={{position:'fixed', inset:0, background:'rgba(...)', display:'flex', alignItems:'center', justifyContent:'center'}}>` wrapping a modal-like panel | `<Modal open onClose={...}>` where feasible (flagged per-task if it changes close-on-backdrop-click behavior — ask before swapping) |
| Manual zebra-striping (`background: idx % 2 === 0 ? 'transparent' : 'var(--color-cream)'` on `<tr>`) | CSS Module `tbody tr:nth-child(even) { background: var(--color-cream); }` — no inline style or idx math needed at all |
| Flex-center loading/fallback wrapper repeated across a file | Single `.centerFill` (or similarly named) module class reused for every occurrence in that file |

---

## Task 1: Cluster A shared components — TopBar, InfoPanel, PersonModal, W3dsLinkCard, CardGrid

**Files:**
- Modify: `app/src/components/TopBar.jsx`, create `app/src/components/TopBar.module.css`
- Modify: `app/src/components/InfoPanel.jsx`, create `app/src/components/InfoPanel.module.css`
- Modify: `app/src/components/PersonModal.jsx`, create `app/src/components/PersonModal.module.css`
- Modify: `app/src/components/W3dsLinkCard.jsx`, create `app/src/components/W3dsLinkCard.module.css`
- Modify: `app/src/views/CardGrid.jsx`, create `app/src/views/CardGrid.module.css`

**Interfaces:**
- Consumes: existing `@ecommons/ui` exports (`Panel, Avatar, MenuItem, SectionLabel, CollapsiblePanel, Badge, Card, Button, Input, ErrorText, Heading`) — no new components needed.
- Produces: nothing consumed by later tasks (Cluster A files are leaves in the render tree for styling purposes).

- [ ] **Step 1: TopBar.jsx — extract static header layout**

Read `app/src/components/TopBar.jsx`. The header wrapper currently has:
```jsx
<header style={{ background: 'white', padding: '0 var(--space-32)', position: 'sticky', top: 0, zIndex: 200 }}>
```
and the `CommunityLogo` helper has:
```jsx
<img style={{ height: 48, maxWidth: 150, objectFit: 'contain', flexShrink: 0 }} src={src} alt={alt} />
```
Create `app/src/components/TopBar.module.css`:
```css
.header {
  background: white;
  padding: 0 var(--space-32);
  position: sticky;
  top: 0;
  z-index: 200;
}

.logo {
  height: 48px;
  max-width: 150px;
  object-fit: contain;
  flex-shrink: 0;
}
```
Update `TopBar.jsx`: `import styles from './TopBar.module.css'`, replace the header's `style={{...}}` with `className={styles.header}`, replace the logo `<img style={{...}}>` with `className={styles.logo}`. Repeat for every other static flex-row/gap/padding block in the file (the inner header row, the community-switcher `Panel` dropdown row, the `MenuItem` list wrapper) — each becomes its own class in the same module file. The live-community indicator dot's `background` color is genuinely dynamic (driven by connection state) — keep that one property inline, move `width`, `height`, `borderRadius` to a `.statusDot` class.

- [ ] **Step 2: InfoPanel.jsx — extract the three sub-views' static layout, keep dynamic accents inline**

Read `app/src/components/InfoPanel.jsx`. `CommunityView`, `WorkgroupView`, and `PersonView` each repeat flex/gap/padding wrapper patterns. Create `app/src/components/InfoPanel.module.css` with one class per distinct static wrapper shape (e.g. `.panelSection`, `.row`, `.avatarRow`, `.badgeRow`, `.mobileDrawer`, `.mobileDrawerOverlay`). The mobile drawer's `position: 'fixed'` overlay and slide-in panel are static except for the open/closed transform — keep only `transform` (or `translateX`) inline, driven by the drawer-open boolean; everything else (`position`, `inset`/`top`/`right`, `width`, `background`, `boxShadow`, `zIndex`, `transition`) moves to `.mobileDrawer` / `.mobileDrawerOverlay`. Leave every `wg.color` / `accent`-driven `borderColor`, `background`, or dot-fill inline exactly as-is — these are rule-3 dynamic values, do not template them into the CSS Module.

- [ ] **Step 3: PersonModal.jsx — extract overlay, flag Modal-component question**

Read `app/src/components/PersonModal.jsx`. It currently hand-rolls a fixed-overlay div wrapping a `Card`, rather than using the real `<Modal>` component from `@ecommons/ui`. **Do not swap it to `<Modal>` in this task** — that changes behavior (close-on-backdrop-click, focus trap, escape-key handling may differ) and is exactly the kind of decision the design says must be flagged rather than silently made. Extract only the static parts of the current fixed-overlay divs into `app/src/components/PersonModal.module.css` (`.overlay`, `.panelWrap`), keeping the component's current hand-rolled behavior identical. Note this Modal-swap question in the task's commit message body as a follow-up item for the user, e.g. `Note: PersonModal still hand-rolls its overlay instead of using <Modal> — flagged for user decision, not changed here.`

- [ ] **Step 4: W3dsLinkCard.jsx — extract remaining static blocks**

Read `app/src/components/W3dsLinkCard.jsx`. Extract the static flex/gap layout wrappers and the static-bordered preview box into `app/src/components/W3dsLinkCard.module.css` (e.g. `.row`, `.previewBox`). This file already uses `Card, Button, Input, SectionLabel, ErrorText` — no component swaps needed, only class extraction.

- [ ] **Step 5: CardGrid.jsx — extract grid container, keep per-card dynamic accents inline**

Read `app/src/views/CardGrid.jsx`. The grid container's `gridTemplateColumns` is static — move it to `.grid` in `app/src/views/CardGrid.module.css`. Each workgroup `Card`'s `borderTop` color, the `MemberRow` helper's selected-state `background`/`borderLeft`, and the dynamically-sized inline SVG role-ring are genuinely dynamic (driven by `wg.color`, `selected`, member role count) — keep only those specific properties inline; move any accompanying static properties (`padding`, `display`, `gap`, `borderRadius`) in the same style objects to `.card`, `.memberRow` classes.

- [ ] **Step 6: Build verify**

Run: `cd app && npm run build`
Expected: exits 0, no errors.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/TopBar.jsx app/src/components/TopBar.module.css \
        app/src/components/InfoPanel.jsx app/src/components/InfoPanel.module.css \
        app/src/components/PersonModal.jsx app/src/components/PersonModal.module.css \
        app/src/components/W3dsLinkCard.jsx app/src/components/W3dsLinkCard.module.css \
        app/src/views/CardGrid.jsx app/src/views/CardGrid.module.css
git commit -m "style: migrate Cluster A shared components to CSS Modules"
```

---

## Task 2: WorkgroupsTab.jsx (52 blocks, largest file)

**Files:**
- Modify: `app/src/views/admin/WorkgroupsTab.jsx`
- Create: `app/src/views/admin/WorkgroupsTab.module.css`

**Interfaces:**
- Consumes: `Card, Button, Input, Textarea, Badge, Select, Label, TrashIcon, Tabs, SectionLabel, Page` from `@ecommons/ui` (already imported).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Read the file in full, catalogue every `style={{`**

Run: `grep -n "style={{" app/src/views/admin/WorkgroupsTab.jsx` and read the file alongside the grep output.

- [ ] **Step 2: Extract expandable-card shell and click-to-edit layout**

Create `app/src/views/admin/WorkgroupsTab.module.css` with classes for: the expandable workgroup card shell (`.card`), the click-to-edit name/description row (`.editableField`, `.editableFieldActive`), the roles/members/details sub-tab content wrappers (`.tabContent`), and the color-picker row (`.colorPickerRow`). Every static `padding`, `gap`, `fontSize`, `fontWeight`, `borderRadius` value in these blocks must map to a token — cross-check against `app/src/index.css`'s token list while writing the classes.

- [ ] **Step 3: Keep dynamic color-driven values inline**

The workgroup card's `borderTop`/accent color (from `wg.color`), the color-picker `<input type="color">`'s own `value`, the `<Tabs activeColor={wg.color}>` prop (already correct, not a style block), and each Badge role-chip's dynamic `borderColor` stay inline/as-props. Move any static properties bundled in the same style object (padding, display, fontSize) to the module classes from Step 2.

- [ ] **Step 4: Fold in backlog items found in this file**

Grep this file for `flexDirection: 'row'` / `flexDirection: 'column'` blocks and any bare-icon `onClick` buttons. Replace static row/column flex wrappers with `.row`/`.stack` utility classes (already shipped in `@ecommons/ui`'s global stylesheet — import is already implicit via the package's CSS, no new import needed beyond what's already in `main.jsx`). Replace any hand-rolled icon-only buttons with `<Button variant="ghost" size="sm">` or `<TrashIcon>` per the Substitution Rules table.

- [ ] **Step 5: Build verify**

Run: `cd app && npm run build`
Expected: exits 0.

- [ ] **Step 6: Grep verify no stray dynamic-unjustified style blocks remain**

Run: `grep -n "style={{" app/src/views/admin/WorkgroupsTab.jsx`
Expected: only lines whose properties are genuinely dynamic (color/borderColor driven by `wg.color`, `r.color`, or a boolean toggle) — everything else should be gone.

- [ ] **Step 7: Commit**

```bash
git add app/src/views/admin/WorkgroupsTab.jsx app/src/views/admin/WorkgroupsTab.module.css
git commit -m "style: migrate WorkgroupsTab to CSS Modules, fold in ghost-button/row-col backlog"
```

---

## Task 3: CommunityTab.jsx (49 blocks) — includes the `btn-secondary` file-input fix

**Files:**
- Modify: `app/src/views/admin/CommunityTab.jsx`
- Create: `app/src/views/admin/CommunityTab.module.css`

**Interfaces:**
- Consumes: `Card, Button, Input, Select, Label, TrashIcon, SectionLabel, ErrorText, Page`.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Read the file, locate the 3 `className="btn-secondary"` file-input triggers**

Run: `grep -n "btn-secondary" app/src/views/admin/CommunityTab.jsx` — these are the statuten/logo/photo upload trigger `<label>` elements.

- [ ] **Step 2: Replace legacy `btn-secondary` class with a `.fileBtn` module class**

Create `app/src/views/admin/CommunityTab.module.css` including:
```css
.fileBtn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-8) var(--space-14);
  background: white;
  border: 1.5px solid var(--color-sand-dark);
  border-radius: 0;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-charcoal);
  cursor: pointer;
}
.fileBtn:hover {
  background: var(--color-cream);
}
```
(match the exact visual values from the current `.btn-secondary` global rule in `app/src/index.css` — read that rule first and copy its real padding/border/color values into this block instead of the placeholders above if they differ.)

Replace each `<label className="btn-secondary" style={{...}}>` with `<label className={styles.fileBtn}>`, keeping the hidden `<input type="file">` a native `<label>` (not swapped to `<Button>`, since `Button` wraps `<button>` not `<label>`) — this matches ALVer's proven precedent for the identical pattern.

- [ ] **Step 3: Extract remaining static layout**

Extract the community settings form's static flex/gap wrappers and the admins list row layout into additional classes in the same module file (`.formRow`, `.adminRow`).

- [ ] **Step 4: Build verify**

Run: `cd app && npm run build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add app/src/views/admin/CommunityTab.jsx app/src/views/admin/CommunityTab.module.css
git commit -m "style: migrate CommunityTab to CSS Modules, replace btn-secondary with .fileBtn module class"
```

---

## Task 4: AvailabilityTab.jsx (36 blocks)

**Files:**
- Modify: `app/src/views/admin/AvailabilityTab.jsx`
- Create: `app/src/views/admin/AvailabilityTab.module.css`

**Interfaces:**
- Consumes: `Card, Button, EmojiPicker, Input, Select, Label, TrashIcon, SectionLabel, Page`.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Read the file, extract the currently-unavailable list row layout**

Create `app/src/views/admin/AvailabilityTab.module.css` with a `.listRow` class for the currently-unavailable member rows (static flex/gap/padding), a `.form` class for the set/edit-availability form layout, and a `.typeRow` class for the availability-types CRUD rows.

- [ ] **Step 2: Keep EmojiPicker-driven dynamic values inline**

Any per-availability-type emoji-background or accent color driven by the type's own data stays inline; static padding/gap/display in the same objects moves to the classes from Step 1.

- [ ] **Step 3: Build verify**

Run: `cd app && npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/src/views/admin/AvailabilityTab.jsx app/src/views/admin/AvailabilityTab.module.css
git commit -m "style: migrate AvailabilityTab to CSS Modules"
```

---

## Task 5: MembersTab.jsx (31 blocks) — includes the zebra-stripe CSS simplification

**Files:**
- Modify: `app/src/views/admin/MembersTab.jsx`
- Create: `app/src/views/admin/MembersTab.module.css`

**Interfaces:**
- Consumes: `Card, Button, Input, Select, Label, TrashIcon, Table, Thead, Th, Td, ErrorText, Page, SectionLabel`.
- Produces: nothing consumed elsewhere.

**Flagged inconsistency (surfaced here per the design's constraint, not silently changed elsewhere):** this file manually computes zebra-striping via `background: idx % 2 === 0 ? 'transparent' : 'var(--color-cream)'` on each `<tr>`. Checked `~/Projects/ecommons-ui/src/components/Table.tsx` directly — `Table`/`Thead`/`Th`/`Td` have no built-in zebra-striping (`Td` only special-cases a `muted` prop), so this isn't duplicate logic, just a hand-rolled effect that a CSS Module can express more simply without the `idx` math at all. This task converts it to a pure-CSS `:nth-child(even)` rule — a code simplification, not a behavior change (same visual result), so it does not need a user decision the way the Modal-swap question in Task 1 does.

- [ ] **Step 1: Replace the idx-driven inline zebra-stripe with a CSS nth-child rule**

Create `app/src/views/admin/MembersTab.module.css` including:
```css
.memberTable tbody tr:nth-child(even) {
  background: var(--color-cream);
}
```
In `MembersTab.jsx`, add `className={styles.memberTable}` to the `<Table>` element, then remove the `style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--color-cream)' }}` prop (and the now-unused `idx` parameter, if nothing else in the row-render callback uses it) from each `<tr>`.

- [ ] **Step 2: Extract remaining static layout**

Extract the add-member flow's static form layout and the hover-reveal pencil-edit button wrapper into `.addMemberForm` and `.editableCell` classes in the same module file. The pencil-edit icon itself is currently a raw inline SVG (not the `TrashIcon`/`Icon` component pattern used for delete actions elsewhere in this same file) — per the Substitution Rules table, wrap it in `<Button variant="ghost" size="sm">` with the SVG as children rather than leaving it a bare clickable `<svg>`.

- [ ] **Step 3: Build verify**

Run: `cd app && npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/src/views/admin/MembersTab.jsx app/src/views/admin/MembersTab.module.css
git commit -m "style: migrate MembersTab to CSS Modules, replace idx-driven zebra-stripe with nth-child CSS"
```

---

## Task 6: Cluster C — MyProfile, MyWorkgroups, MyAvailability, OnboardingScreen, DeeplinkLogin

**Files:**
- Modify: `app/src/views/MyProfile.jsx`, create `app/src/views/MyProfile.module.css`
- Modify: `app/src/views/MyWorkgroups.jsx`, create `app/src/views/MyWorkgroups.module.css`
- Modify: `app/src/views/MyAvailability.jsx`, create `app/src/views/MyAvailability.module.css`
- Modify: `app/src/views/OnboardingScreen.jsx`, create `app/src/views/OnboardingScreen.module.css`
- Modify: `app/src/views/DeeplinkLogin.jsx`, create `app/src/views/DeeplinkLogin.module.css`

**Interfaces:**
- Consumes: `Card, Button, Input, Textarea, Label, Heading, Page, Badge, Select, SectionLabel, ErrorText` (already imported per-file).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: MyProfile.jsx — extract `camBadge` helper's static properties**

Read `app/src/views/MyProfile.jsx`. The `camBadge(active)` helper currently returns a full style object where only `opacity` actually varies with `active`. Create `app/src/views/MyProfile.module.css` with:
```css
.camBadge {
  position: absolute;
  bottom: var(--space-6);
  right: var(--space-6);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-charcoal);
  transition: opacity 0.15s ease;
}
```
Change `camBadge(active)` to return only `{ opacity: active ? 1 : 0.6 }` (or whatever the real current values are — confirm against the file), applied via `style={camBadge(active)}` alongside `className={styles.camBadge}`. Extract the banner+avatar upload layout's remaining static blocks into `.bannerRow`, `.avatarWrap` classes in the same module.

- [ ] **Step 2: MyWorkgroups.jsx — extract static layout, keep dynamic accents inline, fix raw SVG icon buttons**

Read `app/src/views/MyWorkgroups.jsx`. Create `app/src/views/MyWorkgroups.module.css` with a `.workgroupRow` class for the joined-workgroups list rows and a `.joinSection` class for the collapsible "Join a workgroup" section. Keep the dynamic `borderLeft` color (from `r.color`) and the dynamic Badge `background: \`${r.color}20\`` inline. Keep the chevron's `transform` (rotate based on `joinOpen`) inline — move any static `transition`, `width`, `height` on the same SVG to a `.chevron` class. Replace the leave/join raw inline SVG icon buttons with `<Button variant="ghost" size="sm">` wrapping the SVG, matching the `TrashIcon`-component convention used elsewhere in the app (WorkgroupsTab, CommunityTab, AvailabilityTab, MembersTab).

- [ ] **Step 3: MyAvailability.jsx — extract static layout**

Read `app/src/views/MyAvailability.jsx`. Create `app/src/views/MyAvailability.module.css` with `.statusBox` (current-status display) and `.form` (set-status form) classes. No dynamic values expected here beyond whatever status-color badge already uses `Badge`'s own style prop — verify while reading.

- [ ] **Step 4: OnboardingScreen.jsx — extract the eName copy box**

Read `app/src/views/OnboardingScreen.jsx`. Create `app/src/views/OnboardingScreen.module.css` with a `.enameBox` class for the copy-box layout. This file is small (7 blocks) — one class may cover most of it.

- [ ] **Step 5: DeeplinkLogin.jsx — extract layout, adopt ErrorText**

Read `app/src/views/DeeplinkLogin.jsx`. This file currently has no `@ecommons/ui` imports. Add `import { ErrorText } from '@ecommons/ui'` and swap the raw error-state `<p>`/`<div>` for `<ErrorText>`. Create `app/src/views/DeeplinkLogin.module.css` with a `.centerFill` class (flex-center, full height) replacing the raw `fontFamily:'var(--font-sans)'` wrapper div and the "Authenticating…" state div.

- [ ] **Step 6: Build verify**

Run: `cd app && npm run build`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add app/src/views/MyProfile.jsx app/src/views/MyProfile.module.css \
        app/src/views/MyWorkgroups.jsx app/src/views/MyWorkgroups.module.css \
        app/src/views/MyAvailability.jsx app/src/views/MyAvailability.module.css \
        app/src/views/OnboardingScreen.jsx app/src/views/OnboardingScreen.module.css \
        app/src/views/DeeplinkLogin.jsx app/src/views/DeeplinkLogin.module.css
git commit -m "style: migrate Cluster C profile/workgroup views to CSS Modules"
```

---

## Task 7: Cluster D — SuperadminPage, AdminPanel, App.jsx (includes the `Page` component flag)

**Files:**
- Modify: `app/src/views/SuperadminPage.jsx`, create `app/src/views/SuperadminPage.module.css`
- Modify: `app/src/views/AdminPanel.jsx`, create `app/src/views/AdminPanel.module.css`
- Modify: `app/src/App.jsx`, create `app/src/App.module.css`

**Interfaces:**
- Consumes: `Card, Button, Input, Badge, Loading, SectionLabel, ErrorText, Heading, Tabs` (already imported per-file).
- Produces: nothing consumed elsewhere.

**Flagged inconsistency (surfaced here, not silently changed):** `SuperadminPage.jsx`'s main return currently wraps content in a raw `<div style={{maxWidth:720, margin:'0 auto', padding:'var(--space-32)', fontFamily:'var(--font-sans)'}}>` instead of the `<Page maxWidth={...}>` component that `CardGrid`, `CommunityTab`, `WorkgroupsTab`, `MembersTab`, `AvailabilityTab`, `MyProfile`, `MyWorkgroups`, `MyAvailability`, and `OnboardingScreen` all already use consistently. This task does **not** swap it to `<Page>` — that's a visible-structure decision, not a style-location one, and per the design's hard constraint gets asked rather than assumed. It only extracts the current raw div's static properties into a module class, unchanged in behavior. Ask the user after this task (or during final review) whether `SuperadminPage` should adopt `<Page maxWidth={720}>` for consistency.

- [ ] **Step 1: SuperadminPage.jsx — extract static layout without changing the Page-component question**

Read `app/src/views/SuperadminPage.jsx`. Create `app/src/views/SuperadminPage.module.css` with:
```css
.wrapper {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-32);
  font-family: var(--font-sans);
}
```
Replace the raw wrapper div's `style={{...}}` with `className={styles.wrapper}` — no other change to this element. Extract the inner `AddCommunityCard` component's static layout into additional classes in the same module file.

- [ ] **Step 2: AdminPanel.jsx — extract the two blocks**

Read `app/src/views/AdminPanel.jsx`. Create `app/src/views/AdminPanel.module.css` with `.wrapper` (margin wrapper) and `.accessDenied` classes for its two `style={{}}` blocks.

- [ ] **Step 3: App.jsx — extract the shared loading-fallback pattern into one reused class**

Read `app/src/App.jsx`. The Layout loading gate, the `<Suspense>` fallback for lazy views, and the `<Suspense>` fallback for `SuperadminPage` all repeat the identical flex-center pattern. Create `app/src/App.module.css` with a single `.centerFill` class and apply it to all three fallback elements instead of writing three separate near-duplicate style objects. Extract the main `<div>`/`<main>` layout wrapper's static properties into a `.layout` class in the same file.

- [ ] **Step 4: Build verify**

Run: `cd app && npm run build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add app/src/views/SuperadminPage.jsx app/src/views/SuperadminPage.module.css \
        app/src/views/AdminPanel.jsx app/src/views/AdminPanel.module.css \
        app/src/App.jsx app/src/App.module.css
git commit -m "style: migrate Cluster D top-level views to CSS Modules"
```

---

## Task 8: LoginScreen.jsx (37 blocks)

**Files:**
- Modify: `app/src/components/LoginScreen.jsx`
- Create: `app/src/components/LoginScreen.module.css`

**Interfaces:**
- Consumes: `Card, Heading, ErrorText`, plus 4 existing global classes already ported from the earlier Tailwind-removal work (`.login-layout`, `.login-brand-col`, `.login-brand-header`, `.login-partner-grid`, defined in `app/src/index.css` — leave these global classes as-is, do not duplicate them into the module).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Extract the outer centered container and partner-app cards**

Read `app/src/components/LoginScreen.jsx`. Create `app/src/components/LoginScreen.module.css` with a `.centeredContainer` class for the outer wrapper (this is separate from the 4 global `.login-*` classes, which stay referenced via `className="login-layout"` etc. unchanged) and a `.partnerCard` class for each mapped partner-app card's static layout. Keep each app's dynamic fallback-avatar `background` color (per-app data-driven) inline on the element that also has `className={styles.partnerCard}`.

- [ ] **Step 2: Extract QR states and wallet-open link**

Extract the QR loading/waiting/error state wrappers into `.qrState` (or per-state classes if their layouts genuinely differ). Extract the mobile wallet-open `<a>` styled as a button into a `.walletBtn` class — same pattern as the `.fileBtn` in Task 3 and ALVer's proven `.walletBtn` precedent (a real `<a>` tag styled to look like a `Button`, not swapped to `<Button as="a">` since that prop doesn't exist on this component).

- [ ] **Step 3: Extract expiry note, W3DS info box, footer logos row**

Extract the expiry note box, the W3DS info box, and the footer logos row into `.expiryNote`, `.infoBox`, `.footerLogos` classes in the same module file.

- [ ] **Step 4: Build verify**

Run: `cd app && npm run build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/LoginScreen.jsx app/src/components/LoginScreen.module.css
git commit -m "style: migrate LoginScreen remaining inline blocks to CSS Modules"
```

---

## Task 9: Cluster F — OrganogramView, GraphView, WorkgroupNode, PersonNode, ForceGraph

**Files:**
- Modify: `app/src/views/OrganogramView.jsx`, create `app/src/views/OrganogramView.module.css`
- Modify: `app/src/views/graph/GraphView.jsx`, create `app/src/views/graph/GraphView.module.css`
- Modify: `app/src/views/graph/WorkgroupNode.jsx` — no CSS Module needed (see Step 3)
- Modify: `app/src/views/graph/PersonNode.jsx` — no CSS Module needed (see Step 3)
- Modify: `app/src/views/graph/ForceGraph.jsx` — no CSS Module needed (see Step 4)

**Interfaces:**
- Consumes: `Input, Panel, Select, Loading` (`OrganogramView.jsx`), `Loading` (`GraphView.jsx`).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: OrganogramView.jsx — extract the topbar filter row and view-toggle button**

Read `app/src/views/OrganogramView.jsx`. Create `app/src/views/OrganogramView.module.css` with:
```css
.filterRow {
  display: flex;
  gap: var(--space-10);
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
}

.viewTogglePanel {
  display: flex;
  width: 160px;
  height: 34px;
  box-sizing: border-box;
  overflow: hidden;
  flex-shrink: 0;
}

.viewToggleBtn {
  flex: 1;
  padding: 0 var(--space-14);
  height: 100%;
  box-sizing: border-box;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: var(--font-sans);
}

.selectSm {
  width: auto;
  height: 34px;
  padding: 0 var(--space-10);
  appearance: none;
}

.searchInput {
  height: 34px;
  padding: 0 var(--space-10);
  box-sizing: border-box;
  box-shadow: var(--block-shadow-sm);
  width: 160px;
}

.checkLabel {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  font-size: 0.9rem;
  cursor: pointer;
}

.mainColumn {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.contentRow {
  display: flex;
  flex: 1;
  min-height: 0;
}
```
Update the file: replace `const checkStyle = {...}` module-level object with `styles.checkLabel` used directly as `className={styles.checkLabel}` (delete the `checkStyle` constant). Replace the topbar slot's outer div `style={{...}}` with `className={styles.filterRow}`. Replace the view-toggle `<Panel style={{...}}>` with `className={styles.viewTogglePanel}` (keep `shadow="sm"` prop). Each toggle `<button>`'s static properties move to `className={styles.viewToggleBtn}`; keep only `background` and `color` inline since those depend on `view === v`. Replace both `<Select style={{...}}>` with `className={styles.selectSm}`. Replace `<Input style={{...}}>` with `className={styles.searchInput}`. Replace the outer return's `style={{ display:'flex', flexDirection:'column', height:'100%' }}` with `className={styles.mainColumn}`, and the content row's `style={{ display:'flex', flex:1, minHeight:0 }}` with `className={styles.contentRow}`. The `overflow: view === 'cards' ? 'auto' : 'visible'` on the inner flex column is genuinely dynamic — keep that one property inline on a div that also carries a `.contentColumn` class for its static `flex:1, minWidth:0`.

- [ ] **Step 2: GraphView.jsx — extract the two static wrapper divs**

Read `app/src/views/graph/GraphView.jsx`. Create `app/src/views/graph/GraphView.module.css`:
```css
.column {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.canvasWrap {
  flex: 1;
  position: relative;
  min-height: 0;
}
```
Replace `<div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, ...style }}>` with `className={styles.column} style={style}` (the `...style` spread from the `style` prop passed in by `OrganogramView` is genuinely dynamic/caller-supplied — keep it as the element's `style` prop, just drop the now-redundant static literal keys since they live in `.column`). Replace the inner `<div style={{ flex: 1, position: 'relative', minHeight: 0 }}>` with `className={styles.canvasWrap}`. Also replace the `<Loading style={{ padding: 'var(--space-32)' }}>` — move `padding: var(--space-32)` to a `.loadingPad` class in the same module and apply via `className`.

- [ ] **Step 3: WorkgroupNode.jsx and PersonNode.jsx — leave as-is**

Read `app/src/views/graph/WorkgroupNode.jsx` and `app/src/views/graph/PersonNode.jsx`. Every `style={{}}` in both files is on an SVG `<g>`/`<text>` element and is either `{ cursor: 'pointer' }` (static, but a single-property inline style on an SVG element inside a hot render loop — not worth a CSS Module class for one property, per YAGNI) or `{ pointerEvents: 'none', userSelect: 'none' }` (same reasoning). Do not create a CSS Module for these two files — there is no static-property bulk to extract, and SVG presentation attributes (`fill`, `stroke`, `opacity`, `r`, `strokeWidth`) are already passed as real SVG attributes, not `style` objects. No changes needed in this step; this step exists to document why these two files are intentionally excluded from the migration, so a later audit doesn't flag them as missed.

- [ ] **Step 4: ForceGraph.jsx — leave as-is**

Read `app/src/views/graph/ForceGraph.jsx`. Its one `style={{}}` block (`{ background: '#fff', display: 'block', cursor: isPanning ? 'grabbing' : 'grab' }}` on the root `<svg>`) has `cursor` genuinely dynamic (pan-state driven) and only two static properties. Extract just the two static properties into a `.canvas` class in a new `app/src/views/graph/ForceGraph.module.css`:
```css
.canvas {
  background: #fff;
  display: block;
}
```
Note: `#fff` here should become `white` or a token if `app/src/index.css` defines one for pure white — check the token list; if none covers plain white, leave the literal (design tokens don't need to be invented for values with no existing token). Apply `className={styles.canvas}` alongside `style={{ cursor: isPanning ? 'grabbing' : 'grab' }}`.

- [ ] **Step 5: Build verify**

Run: `cd app && npm run build`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add app/src/views/OrganogramView.jsx app/src/views/OrganogramView.module.css \
        app/src/views/graph/GraphView.jsx app/src/views/graph/GraphView.module.css \
        app/src/views/graph/ForceGraph.jsx app/src/views/graph/ForceGraph.module.css
git commit -m "style: migrate Cluster F graph views to CSS Modules"
```

---

## Task 10: Final whole-app grep audit + build/smoke check

**Files:**
- No new files expected. Possible small follow-up edits to any file flagged by the audit.

**Interfaces:**
- Consumes: the completed state of Tasks 1–9.
- Produces: nothing (terminal task).

- [ ] **Step 1: Grep for remaining `style={{` across the app**

Run: `grep -rn "style={{" app/src --include=*.jsx`
Expected: every remaining hit is one of the documented dynamic-value cases from Tasks 1–9 (color/borderColor driven by data, opacity/transform driven by boolean state, `cursor` driven by interaction state, the `GraphView` caller-supplied `style` spread). If any hit is a static block that was missed, extract it into that file's module (create the module file if the file wasn't touched by an earlier task).

- [ ] **Step 2: Grep for leftover Tailwind-era or duplicate-token literals**

Run: `grep -rn "className=\"btn-" app/src --include=*.jsx` and `grep -rn "padding: '[0-9]" app/src --include=*.jsx`
Expected: no hits — the `btn-secondary` pattern was fully replaced in Task 3, and no raw pixel literals should duplicate an existing `var(--space-*)` token.

- [ ] **Step 3: Confirm backlog items are folded in, not just deferred again**

Run: `grep -rln "flexDirection: 'row'" app/src --include=*.jsx` and `grep -rln "flexDirection: 'column'" app/src --include=*.jsx`
Expected: no hits outside of genuinely dynamic per-instance cases (there should be none — `.row`/`.stack` cover all static cases per Task 2/6 work).

- [ ] **Step 4: Sweep remaining muted-small-text sites onto the `Muted` component**

Run: `grep -rn "color: 'var(--color-charcoal-light)'" app/src --include=*.jsx` and `grep -rn "fontSize: '0.8" app/src --include=*.jsx`
For each hit that is a plain text `<span>`/`<div>` (not a table cell already using `<Td muted>`, and not a case where `color` is genuinely data-driven), replace it with `import { Muted } from '@ecommons/ui'` and `<Muted>{children}</Muted>`, deleting the now-unused `style={{}}` block. Skip any hit already covered by a `Td muted` prop (Table cells) — that's the correct existing mechanism, not a gap.

- [ ] **Step 5: Build and smoke-check the dev server**

Run: `cd app && npm run build`
Expected: exits 0.

Run: `cd app && npm run dev &` then `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`
Expected: `200`. Kill the dev server process afterward.

- [ ] **Step 6: Commit any final audit fixes**

```bash
git add -A
git commit -m "style: final audit pass for ecommons-ui migration"
```

(Skip this commit if Steps 1–3 found nothing to fix.)

---

## Open Questions For The User (do not resolve unilaterally — raise after Task 10, or sooner if blocking)

1. **PersonModal.jsx** hand-rolls its overlay instead of using the real `<Modal>` component (Task 1, Step 3). Should a follow-up task swap it to `<Modal>`, accepting whatever behavior differences that brings (backdrop-click-to-close, focus trap, escape-key handling)?
2. **SuperadminPage.jsx** doesn't use the `<Page>` component that every other top-level view uses consistently (Task 7). Should it be switched to `<Page maxWidth={720}>` for consistency, in a follow-up task?
