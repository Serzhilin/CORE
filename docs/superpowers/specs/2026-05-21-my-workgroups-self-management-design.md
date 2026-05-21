# My Workgroups Self-Management — Design Spec
_2026-05-21_

## Scope

Upgrade `app/src/views/MyWorkgroups.jsx` so regular users can join workgroups, leave workgroups, assign/unassign roles to themselves, and see all available workgroups. Remove WG admin badge and controls from both the user-facing view and the admin Workgroups tab — the feature does nothing functionally.

---

## 1. My Workgroups View — Joined Workgroups

Each workgroup the user is already in renders as a full card:

```
┌──────────────────────────────────────────────┐  ← left border: wg.color
│ Workgroup Name                               │
│ [● Role A ×]  [● Role B ×]  [+ Role ▾]      │
│                                   [Leave]    │
└──────────────────────────────────────────────┘
```

- **Name:** bold, title font, top-left
- **Role chips:** colored pill per assigned role, `×` unassigns via `unassignRole(wid, user.id, rid)` → `refresh()`
- **`+ Role` dropdown:** shown only when unassigned roles exist for this workgroup. `onChange` → `assignRole(wid, user.id, { role_id })` → `refresh()`. Uses `value=""` controlled pattern (resets after selection).
- **Leave button:** bottom-right, small red text. Confirm: `"Leave [workgroup name]?"`. On confirm → `removeWorkgroupMember(wid, user.id)` → `refresh()`.
- Card uses existing `.card` class + `borderLeft: 4px solid wg.color`, `padding: 20px 24px`.

Role assignment and leave are low-frequency operations — no optimistic updates, just call API + refresh.

---

## 2. My Workgroups View — Available Workgroups

Below joined workgroups, a "Join a workgroup" section — shown only when at least one unjoinable workgroup exists:

```
Join a workgroup
─────────────────────────────────────────
[color dot] Workgroup Name   X members   [Join]
[color dot] Workgroup Name   X members   [Join]
```

- Lighter treatment: `background: var(--color-cream-dark)`, same `border-radius: 12px`, no heavy shadow
- Left color dot (10px circle, `wg.color`) instead of full border
- Workgroup name + member count (`wg.members.length`)
- **Join button:** `btn-secondary`, small. On click → `addWorkgroupMember(wid, { person_id: user.id })` → `refresh()`. No confirm needed.
- Section heading: same uppercase label style as existing section headers

---

## 3. Remove WG Admin

**`app/src/views/MyWorkgroups.jsx`:**
- Remove the `{membership.is_workgroup_admin && <span>Admin</span>}` badge entirely

**`app/src/views/admin/WorkgroupsTab.jsx`:**
- Remove the WG admin `<label>` + `<input type="checkbox">` from each member row in the Members tab
- Remove the `handleToggleWgAdmin` handler (dead code after removal)
- Remove `updateWorkgroupMember` from the import (no longer used in this file)

---

## 4. Data Shape

`community.workgroups[].members[].roles` is an array of role IDs (strings). Role objects live in `community.workgroups[].roles`. Self-management maps `user.id` to `wm.person_id` to find the user's membership.

`user.id` comes from `useUser()` context. All workgroup mutation endpoints are already authenticated and do not require community admin.

---

## 5. Files Changed

| File | Change |
|------|--------|
| `app/src/views/MyWorkgroups.jsx` | Full rewrite — joined cards + available section + no WG admin badge |
| `app/src/views/admin/WorkgroupsTab.jsx` | Remove WG admin checkbox, handler, and import |

No API changes needed.

---

## 6. Out of Scope

- Role creation from this view (admin-only)
- Workgroup descriptions displayed here
- Any permission gating on self-join (open join for all community members)
- WG admin backend removal (column stays in DB, just hidden in UI)
