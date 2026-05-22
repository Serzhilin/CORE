# Unified Info Panel — Design Spec
_2026-05-22_

## Scope

Replace the current fragmented side panel setup (MemberSidePanel fixed overlay + GraphSidePanel absolute inside graph + WorkgroupPanel + PersonPanel) with a single `InfoPanel` component that lives in `OrganogramView`, works identically across graph and cards views, and pushes content rather than overlaying it.

---

## 1. Layout

`OrganogramView` becomes a horizontal flex container:

```
[ content area (flex: 1) ] [ tab strip (24px) ] [ panel (300px, when open) ]
```

- **Content area**: graph or cards — fills available space, reflowing naturally when panel opens
- **Tab strip**: always visible, 24px wide, contains only a centered chevron (`‹`/`›`). Clicking toggles panel open/closed. When something is selected, the strip takes the selected item's accent color (workgroup color or community primary color).
- **Panel**: 300px wide, slides in/out with CSS transition (`width` or `transform`). White background, `border-left: 1px solid var(--color-sand)`, `box-shadow: -4px 0 16px rgba(0,0,0,0.07)`.

The graph SVG resizes with its container naturally. The card grid reflowing via CSS grid `auto-fill` also responds automatically.

---

## 2. Panel Navigation State

Internal to `InfoPanel`:

```js
// panel state shape
{ type: 'community' }
{ type: 'workgroup', id: string }
{ type: 'person', id: string, fromWorkgroup?: string }
```

Navigation stack is NOT needed — only one level of back exists: person → workgroup (when `fromWorkgroup` is set). Back button appears only when `fromWorkgroup` is set.

---

## 3. Panel Views

### Community overview (default when nothing selected)
- Community name (title font, large)
- Member count + workgroup count as stats
- List of workgroups as clickable rows (color dot + name + member count) → navigate to workgroup view

### Workgroup view
- Workgroup name (title font) + color accent on left border
- Description (if set)
- Member list — sorted alpha, clickable rows → navigate to person view with `fromWorkgroup` set
- Each row: color dot + name + roles (in workgroup color)
- "Filter to workgroup" button (existing behavior)
- Close/back: back goes to community overview

### Person view
- Avatar (56px circle, fallback initial)
- Name (bold, title font) + badges (Admin, Aspirant, Active partner)
- Bio (if set)
- Availability + until date (if set)
- Workgroups + roles (left-color-border cards per workgroup)
- Joined date (if set)
- Back button → workgroup view (if `fromWorkgroup`) or community overview

---

## 4. Behavior

**Open/closed**: toggled by tab strip click. State persists across graph↔cards view switch.

**Selection cleared on view switch**: switching graph↔cards resets panel content to community overview (panel stays open if it was open).

**Selecting from graph**: clicking a workgroup node → workgroup view. Clicking a person node → person view (no `fromWorkgroup`). Clicking person in workgroup panel → person view with `fromWorkgroup` set.

**Selecting from cards**: clicking a member row → person view (no `fromWorkgroup`).

**Initial state**: panel closed, content = community overview.

---

## 5. Files

| Action | File |
|--------|------|
| Create | `app/src/components/InfoPanel.jsx` — unified panel with internal nav state |
| Modify | `app/src/views/OrganogramView.jsx` — flex layout, panel open state, wire InfoPanel |
| Modify | `app/src/views/CardGrid.jsx` — `onMemberClick` still fires, no change needed |
| Modify | `app/src/views/graph/GraphView.jsx` — pass `onWorkgroupSelect` + `onPersonSelect` to GraphSidePanel/ForceGraph |
| Modify | `app/src/views/graph/ForceGraph.jsx` — workgroup node click calls `onSelect` (already does) |
| Delete | `app/src/components/MemberSidePanel.jsx` — replaced by InfoPanel |
| Delete | `app/src/views/graph/GraphSidePanel.jsx` — replaced by InfoPanel |
| Delete | `app/src/views/graph/PersonPanel.jsx` — content moved into InfoPanel |
| Keep | `app/src/views/graph/WorkgroupPanel.jsx` — content moved into InfoPanel (file can be deleted) |

---

## 6. Out of Scope

- Resizable panel width (drag to resize)
- Panel state persisted to localStorage
- Multiple items selected simultaneously
- Animation beyond simple CSS width transition
