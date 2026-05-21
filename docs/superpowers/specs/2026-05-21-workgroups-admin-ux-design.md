# Workgroups Admin UX — Design Spec
_2026-05-21_

## Scope

Improve the admin Workgroups tab (`app/src/views/admin/WorkgroupsTab.jsx`) with four focused changes:
1. Inline-editable workgroup names
2. Two sub-tabs (Roles / Members) inside each expanded panel
3. Inline-editable role names
4. Member cards replacing the messy inline row layout

No new API endpoints needed — `updateWorkgroup` and `updateRole` already exist in the client.

---

## 1. Workgroup Name — Inline Edit

**Trigger:** Pencil icon (✏) appears on hover next to workgroup name in the collapsed/expanded header.  
**Interaction:** Click name or pencil → name replaced by `<input>` pre-filled with current name.  
**Save:** Enter or blur → call `updateWorkgroup(communityId, wg.id, { name: newName })` → `refresh()`.  
**Cancel:** Escape → revert to original name, no API call.  
**State:** `editingWgName: { [wgId]: string | null }` — `null` means not editing.  
**Error:** On API failure, show inline error text below input (not `alert()`).

The chevron, delete button, and member/role count stay right-aligned and unaffected during editing.

---

## 2. Sub-tabs: Roles / Members

**Location:** Inside the expanded panel, directly below the top border — before any content.  
**Style:** Pill-style minimal tabs. Active tab has underline or subtle background fill using the workgroup's `color`. Inactive tab is plain text.  
**State:** `activeTab: { [wgId]: 'roles' | 'members' }` — default `'members'`.  
**Behaviour:** Switching tabs preserves all other state (add-role form values, addingMember, etc.).

---

## 3. Role Name — Inline Edit

**Location:** Roles tab, each role row.  
**Trigger:** Click the role name text.  
**Interaction:** Name replaced by `<input>` pre-filled with current name.  
**Save:** Enter or blur → call `updateRole(wg.id, r.id, { name: newName })` → `refresh()`.  
**Cancel:** Escape → revert, no API call.  
**State:** `editingRoleName: { [roleId]: string | null }`.  
**Layout:** Color dot stays left. Delete `×` stays right. Input takes the flex-1 slot between them.

Add-role form at the bottom of the list is unchanged.

---

## 4. Member Cards

Replace the current single-row-per-member layout with small cards.

**Card anatomy:**
```
┌─────────────────────────────────────┐
│ Full Name (bold)      [☐ WG admin]  │
│ [Role A ×] [Role B ×]  [+ Role ▾]  │
│                          [Remove]   │
└─────────────────────────────────────┘
```

- **Name:** `firstName lastName` or email fallback, bold, left.
- **WG admin toggle:** checkbox + label, top-right.
- **Role chips:** colored chips with `×` to unassign. Same style as current (`role.color + '30'` background, colored border).
- **`+ Role` dropdown:** shown only when `wg.roles` has unassigned roles for this member. On change, calls `assignRole`; resets to default after selection.
- **Remove:** red text button, bottom-right of card.
- **Card style:** `background: white`, `border: 1px solid var(--color-sand)`, `border-radius: 8px`, `padding: 10px 14px`. No shadow (avoids card-within-card heaviness).

Cards are stacked vertically (full width), consistent with the 680px max-width column layout.

**Add member:** `+ Add member` button below all cards. On click, shows a member-select dropdown (same as current). Cancel closes it. Auto-closes after selection.

---

## Files Changed

| File | Change |
|------|--------|
| `app/src/views/admin/WorkgroupsTab.jsx` | All changes — inline editing state, sub-tabs, member cards |

No other files need modification. `updateWorkgroup` and `updateRole` are already exported from `app/src/api/client.js`.

---

## Out of Scope

- Workgroup color editing (exists in create form, not added to edit)
- Role color editing inline (color dot is display-only for now)
- Drag-to-reorder roles or members
- Member search/filter
