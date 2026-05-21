# Workgroups Admin UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the admin Workgroups tab with inline-editable names, sub-tabs for roles/members, and member cards.

**Architecture:** All changes live in a single component file. New state keys track inline-edit values and active sub-tab per workgroup. No new API endpoints — `updateWorkgroup` and `updateRole` already exist in the client.

**Tech Stack:** React (JSX), inline styles, existing CSS classes (`card`, `btn-secondary`, `btn-primary`), CSS variables from `index.css`.

---

## File Map

| File | Change |
|------|--------|
| `app/src/views/admin/WorkgroupsTab.jsx` | All changes — imports, state, handlers, JSX |

---

### Task 1: Add imports and new state

**Files:**
- Modify: `app/src/views/admin/WorkgroupsTab.jsx:1-18`

- [ ] **Step 1: Add `updateWorkgroup` and `updateRole` to the import**

Replace the current import block (lines 3-8):

```jsx
import {
  createWorkgroup, updateWorkgroup, deleteWorkgroup,
  createRole, updateRole, deleteRole,
  addWorkgroupMember, updateWorkgroupMember, removeWorkgroupMember,
  assignRole, unassignRole,
} from '../../api/client'
```

- [ ] **Step 2: Add new state declarations inside the component**

After the existing `useState` declarations (after `setAddingMember` line), add:

```jsx
const [editingWgName, setEditingWgName] = useState({})   // { [wgId]: string }
const [editingRoleName, setEditingRoleName] = useState({}) // { [roleId]: string }
const [activeTab, setActiveTab] = useState({})             // { [wgId]: 'roles' | 'members' }
```

- [ ] **Step 3: Verify the app still compiles**

```bash
cd /home/serzhilin/Projects/CORE && npm --prefix app run build 2>&1 | tail -10
```

Expected: no errors (warnings about unused vars are OK at this stage).

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/admin/WorkgroupsTab.jsx
git commit -m "feat(workgroups): add state and imports for inline editing + sub-tabs"
```

---

### Task 2: Workgroup name inline edit

**Files:**
- Modify: `app/src/views/admin/WorkgroupsTab.jsx` — add 2 handlers, update header JSX

- [ ] **Step 1: Add save and cancel handlers**

After `handleUnassignRole`, add:

```jsx
async function handleSaveWgName(wid, name) {
  const trimmed = name.trim()
  if (!trimmed) return
  try {
    await updateWorkgroup(communityId, wid, { name: trimmed })
    await refresh()
  } catch (err) { alert(err.message) }
  setEditingWgName((s) => { const n = { ...s }; delete n[wid]; return n })
}

function handleCancelWgName(wid) {
  setEditingWgName((s) => { const n = { ...s }; delete n[wid]; return n })
}
```

- [ ] **Step 2: Replace the workgroup header name span with inline-edit JSX**

Find the header `<div>` inside `.map((wg) => ...)` — the `<span>` that shows `{wg.name}` (currently line ~124). Replace that `<span>` with:

```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}
     onClick={(e) => e.stopPropagation()}>
  {editingWgName[wg.id] !== undefined ? (
    <input
      autoFocus
      value={editingWgName[wg.id]}
      onChange={(e) => setEditingWgName((s) => ({ ...s, [wg.id]: e.target.value }))}
      onBlur={() => handleSaveWgName(wg.id, editingWgName[wg.id])}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSaveWgName(wg.id, editingWgName[wg.id])
        if (e.key === 'Escape') handleCancelWgName(wg.id)
      }}
      style={{ ...inputStyle, fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '1rem', padding: '4px 8px' }}
      onClick={(e) => e.stopPropagation()}
    />
  ) : (
    <span
      style={{ fontWeight: 700, fontFamily: 'var(--font-title)', cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation()
        setEditingWgName((s) => ({ ...s, [wg.id]: wg.name }))
      }}
    >
      {wg.name}
    </span>
  )}
</div>
```

Keep the right-side `<div>` with count, delete button, and chevron exactly as-is.

- [ ] **Step 3: Start dev server and manually test**

```bash
cd /home/serzhilin/Projects/CORE && npm --prefix app run dev
```

Open `http://localhost:5175`. Go to Admin → Workgroups. Click a workgroup name — input appears. Type a new name, press Enter — name updates. Press Escape — reverts. Click elsewhere — saves.

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/admin/WorkgroupsTab.jsx
git commit -m "feat(workgroups): inline-editable workgroup name"
```

---

### Task 3: Sub-tabs (Roles / Members)

**Files:**
- Modify: `app/src/views/admin/WorkgroupsTab.jsx` — add tab bar JSX, wrap content sections

- [ ] **Step 1: Add a helper to get active tab (defaults to 'members')**

After the `communityMembers` line, add:

```jsx
function getTab(wgId) { return activeTab[wgId] || 'members' }
```

- [ ] **Step 2: Add the tab bar JSX inside the expanded panel**

Inside `{isExpanded && (...)}`, replace the opening `<div style={{ borderTop: ... padding: 20 }}>` content with a tab bar before the existing sections:

```jsx
{isExpanded && (
  <div style={{ borderTop: '1px solid var(--color-sand)' }}>
    {/* Tab bar */}
    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-sand)' }}>
      {['members', 'roles'].map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab((s) => ({ ...s, [wg.id]: tab }))}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: getTab(wg.id) === tab ? `2px solid ${wg.color}` : '2px solid transparent',
            padding: '10px 20px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: getTab(wg.id) === tab ? 600 : 400,
            color: getTab(wg.id) === tab ? wg.color : 'var(--color-charcoal-light)',
            textTransform: 'capitalize',
            marginBottom: -1,
          }}
        >
          {tab}
        </button>
      ))}
    </div>

    <div style={{ padding: 20 }}>
      {/* Roles section — shown when tab === 'roles' */}
      {getTab(wg.id) === 'roles' && (
        <div>
          {/* existing roles JSX goes here — move from current location */}
        </div>
      )}

      {/* Members section — shown when tab === 'members' */}
      {getTab(wg.id) === 'members' && (
        <div>
          {/* existing members JSX goes here — move from current location */}
        </div>
      )}
    </div>
  </div>
)}
```

Move the existing Roles `<div>` (currently inside `borderTop` div, `marginBottom: 20`) into the `tab === 'roles'` block, and the existing Members `<div>` into the `tab === 'members'` block. Remove the outer `padding: 20` wrapper that previously held both.

- [ ] **Step 3: Verify in browser**

Expand a workgroup. Two tabs appear: Members (active by default), Roles. Clicking Roles shows the roles section. Clicking Members shows the members section.

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/admin/WorkgroupsTab.jsx
git commit -m "feat(workgroups): roles/members sub-tabs in expanded panel"
```

---

### Task 4: Role name inline edit

**Files:**
- Modify: `app/src/views/admin/WorkgroupsTab.jsx` — add 2 handlers, update role row JSX

- [ ] **Step 1: Add save and cancel handlers for role names**

After `handleCancelWgName`, add:

```jsx
async function handleSaveRoleName(wid, rid, name) {
  const trimmed = name.trim()
  if (!trimmed) return
  try {
    await updateRole(wid, rid, { name: trimmed })
    await refresh()
  } catch (err) { alert(err.message) }
  setEditingRoleName((s) => { const n = { ...s }; delete n[rid]; return n })
}

function handleCancelRoleName(rid) {
  setEditingRoleName((s) => { const n = { ...s }; delete n[rid]; return n })
}
```

- [ ] **Step 2: Replace role name `<span>` with inline-edit JSX**

Inside the roles `.map((r) => ...)`, replace:

```jsx
<span style={{ flex: 1, fontSize: '0.9rem' }}>{r.name}</span>
```

with:

```jsx
{editingRoleName[r.id] !== undefined ? (
  <input
    autoFocus
    value={editingRoleName[r.id]}
    onChange={(e) => setEditingRoleName((s) => ({ ...s, [r.id]: e.target.value }))}
    onBlur={() => handleSaveRoleName(wg.id, r.id, editingRoleName[r.id])}
    onKeyDown={(e) => {
      if (e.key === 'Enter') handleSaveRoleName(wg.id, r.id, editingRoleName[r.id])
      if (e.key === 'Escape') handleCancelRoleName(r.id)
    }}
    style={{ ...inputStyle, flex: 1, padding: '3px 7px', fontSize: '0.9rem' }}
  />
) : (
  <span
    style={{ flex: 1, fontSize: '0.9rem', cursor: 'pointer' }}
    onClick={() => setEditingRoleName((s) => ({ ...s, [r.id]: r.name }))}
  >
    {r.name}
  </span>
)}
```

- [ ] **Step 3: Verify in browser**

Go to Roles tab of any workgroup. Click a role name — input appears. Edit and press Enter — name updates. Escape reverts.

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/admin/WorkgroupsTab.jsx
git commit -m "feat(workgroups): inline-editable role names"
```

---

### Task 5: Member cards

**Files:**
- Modify: `app/src/views/admin/WorkgroupsTab.jsx` — replace members list JSX entirely

- [ ] **Step 1: Replace the entire members list JSX**

Inside the `tab === 'members'` block, replace the `{wgMembers.map(...)}` section and the add-member block with:

```jsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
  {wgMembers.map(({ member, is_workgroup_admin, roles }) => {
    const displayName = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'
    const unassignedRoles = wg.roles.filter((r) => !roles.includes(r.id))
    return (
      <div
        key={member.personId}
        style={{
          background: 'white',
          border: '1px solid var(--color-sand)',
          borderRadius: 8,
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {/* Top row: name + admin toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{displayName}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', cursor: 'pointer', color: 'var(--color-charcoal-light)' }}>
            <input
              type="checkbox"
              checked={is_workgroup_admin}
              onChange={(e) => handleToggleWgAdmin(wg.id, member.personId, e.target.checked)}
            />
            WG admin
          </label>
        </div>

        {/* Bottom row: role chips + add role dropdown + remove */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {roles.map((rid) => {
            const role = wg.roles.find((r) => r.id === rid)
            if (!role) return null
            return (
              <span
                key={rid}
                style={{
                  fontSize: '0.75rem',
                  background: role.color + '22',
                  border: `1px solid ${role.color}`,
                  borderRadius: 4,
                  padding: '2px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--color-charcoal)',
                }}
              >
                {role.name}
                <button
                  onClick={() => handleUnassignRole(wg.id, member.personId, rid)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--color-charcoal-light)', fontSize: '0.9rem' }}
                >×</button>
              </span>
            )
          })}

          {unassignedRoles.length > 0 && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) handleAssignRole(wg.id, member.personId, e.target.value) }}
              style={{ ...inputStyle, padding: '2px 6px', fontSize: '0.78rem', color: 'var(--color-charcoal-light)' }}
            >
              <option value="">+ Role</option>
              {unassignedRoles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => handleRemoveMember(wg.id, member.personId)}
            style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', fontSize: '0.78rem', marginLeft: 'auto' }}
          >
            Remove
          </button>
        </div>
      </div>
    )
  })}

  {/* Add member */}
  {addingMember === wg.id ? (
    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
      <select
        defaultValue=""
        onChange={(e) => { if (e.target.value) handleAddMember(wg.id, e.target.value) }}
        style={{ ...inputStyle, flex: 1 }}
      >
        <option value="">Select community member…</option>
        {nonMembers.map((m) => (
          <option key={m.personId} value={m.personId}>
            {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || m.personId}
          </option>
        ))}
      </select>
      <button className="btn-secondary" onClick={() => setAddingMember(null)} style={{ fontSize: '0.8rem' }}>Cancel</button>
    </div>
  ) : (
    <button className="btn-secondary" onClick={() => setAddingMember(wg.id)} style={{ fontSize: '0.8rem', alignSelf: 'flex-start' }}>
      + Add member
    </button>
  )}
</div>
```

- [ ] **Step 2: Verify in browser — full flow**

1. Expand a workgroup → Members tab shows cards
2. Each card: name top-left, WG admin toggle top-right, role chips + `+ Role` dropdown bottom row, Remove button far right
3. Assign a role via dropdown — chip appears
4. Unassign role via `×` — chip disappears
5. Toggle WG admin — persists after page refresh
6. Remove member — card disappears
7. Add member — dropdown appears, select → new card appears

- [ ] **Step 3: Build check**

```bash
cd /home/serzhilin/Projects/CORE && npm --prefix app run build 2>&1 | tail -10
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/admin/WorkgroupsTab.jsx
git commit -m "feat(workgroups): member cards UX in workgroup admin panel"
```

---

## Done

All four features implemented and committed. Regenerate prod dump if needed:

```bash
PGPASSWORD=core pg_dump -h localhost -p 5436 -U core -d core --data-only --no-owner --no-acl -f /home/serzhilin/Projects/CORE/public/dev_seed.sql
```
