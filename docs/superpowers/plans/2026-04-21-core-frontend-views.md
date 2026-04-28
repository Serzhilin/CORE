# CORE Frontend Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all CORE views: card-grid + radial SVG organogram, members table with person modal, my-profile editor, and admin panel (community / members / workgroups tabs).

**Architecture:** All views are React components under `app/src/views/`. They import from `app/src/context/CommunityContext.jsx` (community data) and `app/src/context/UserContext.jsx` (current user). API calls go through `app/src/api/client.js`. No external graph library — organogram is pure CSS + SVG.

**Tech Stack:** React 19, html2canvas (card grid PNG export), react-zoom-pan-pinch (radial zoom/pan), pure SVG (radial view)

**Prerequisites:** `2026-04-21-core-frontend-scaffold.md` is complete. The stub views (`OrganogramView`, `MembersTable`, `MyProfile`, `AdminPanel`) exist and will be replaced task by task.

**Community data shape** (returned by `GET /api/communities/:id`):
```js
{
  id, name, slug, description, logo_url, primary_color, title_font,
  members: [{
    membershipId, personId, firstName, lastName, email, avatarUrl,
    isAdmin, isAspirant, joinedAt,
    availability: { type: { id, name, emoji }, reason, from, until } | null
  }],
  workgroups: [{
    id, name, description, color, sort_order,
    roles: [{ id, name, description, color, sort_order }],
    members: [{ id, person_id, workgroup_id, is_workgroup_admin, roles: [roleId] }]
  }]
}
```

---

## File Structure

```
app/src/
  components/
    AvailabilityBadge.jsx      emoji + tooltip for unavailable members
    PersonModal.jsx            person profile modal (view + edit)
  views/
    OrganogramView.jsx         toggle card/radial + filter bar + export
    CardGrid.jsx               CSS grid of workgroup cards
    RadialView.jsx             pure SVG radial diagram + zoom/pan
    MembersTable.jsx           sortable, searchable member table
    MyProfile.jsx              edit profile + set own availability
    AdminPanel.jsx             3-tab container
    admin/
      CommunityTab.jsx         community settings + availability type mgmt
      MembersTab.jsx           member management table
      WorkgroupsTab.jsx        workgroups + roles + workgroup member mgmt
```

---

## Task 6: AvailabilityBadge + Card Grid

**Files:**
- Create: `app/src/components/AvailabilityBadge.jsx`
- Replace: `app/src/views/OrganogramView.jsx` (stub → container with CardGrid)
- Create: `app/src/views/CardGrid.jsx`

- [ ] **Step 1: Create `app/src/components/AvailabilityBadge.jsx`**

```jsx
export default function AvailabilityBadge({ availability, inline = false }) {
  if (!availability) return null
  const { type, reason, until } = availability
  const tooltip = [reason, until ? `until ${until}` : null].filter(Boolean).join(' · ')

  return (
    <span
      title={tooltip || type.name}
      style={{
        cursor: 'default',
        ...(inline ? { marginLeft: 4, fontSize: '0.85em' } : {}),
      }}
    >
      {type.emoji}
    </span>
  )
}
```

- [ ] **Step 2: Create `app/src/views/CardGrid.jsx`**

```jsx
import { useRef } from 'react'
import html2canvas from 'html2canvas'
import AvailabilityBadge from '../components/AvailabilityBadge'

export default function CardGrid({ community, filter, onMemberClick }) {
  const gridRef = useRef(null)

  // Build a lookup: personId → workgroup memberships with role colors
  const personRoles = {}
  for (const wg of community.workgroups) {
    for (const wm of wg.members) {
      const firstRoleId = wm.roles?.[0]
      const role = firstRoleId ? wg.roles.find((r) => r.id === firstRoleId) : null
      if (!personRoles[wm.person_id]) personRoles[wm.person_id] = {}
      personRoles[wm.person_id][wg.id] = role?.color || '#E8DDD0'
    }
  }

  const workgroups = community.workgroups
    .filter((wg) => !filter.workgroupId || wg.id === filter.workgroupId)
    .sort((a, b) => a.sort_order - b.sort_order)

  function membersForWorkgroup(wg) {
    return wg.members
      .map((wm) => community.members.find((m) => m.personId === wm.person_id))
      .filter(Boolean)
      .filter((m) => !filter.hideUnavailable || !m.availability)
      .filter((m) => !filter.roleId || wg.members
        .find((wm) => wm.person_id === m.personId)?.roles.includes(filter.roleId))
  }

  async function exportPng() {
    if (!gridRef.current) return
    const canvas = await html2canvas(gridRef.current, { backgroundColor: '#F5F0E8', useCORS: true })
    const a = document.createElement('a')
    a.download = 'organogram.png'
    a.href = canvas.toDataURL()
    a.click()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-secondary" onClick={exportPng} style={{ fontSize: '0.85rem' }}>
          Save as PNG
        </button>
      </div>

      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
          padding: 16,
          background: 'var(--color-cream)',
        }}
      >
        {workgroups.map((wg) => {
          const members = membersForWorkgroup(wg)
          return (
            <div
              key={wg.id}
              className="card"
              style={{ borderTop: `3px solid ${wg.color}`, overflow: 'hidden' }}
            >
              <div style={{ padding: '12px 16px 8px', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-title)' }}>
                {wg.name}
              </div>
              <div style={{ paddingBottom: 12 }}>
                {members.length === 0 && (
                  <div style={{ padding: '4px 16px', fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>No members</div>
                )}
                {members.map((m) => {
                  const dotColor = personRoles[m.personId]?.[wg.id] || '#E8DDD0'
                  const unavailable = !!m.availability
                  return (
                    <div
                      key={m.personId}
                      onClick={() => onMemberClick(m)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 16px', cursor: 'pointer',
                        opacity: unavailable ? 0.45 : 1,
                        borderLeft: m.isAspirant ? '3px dashed var(--color-sand-dark)' : '3px solid transparent',
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.9rem' }}>
                        {m.firstName || m.lastName || 'Unknown'}
                        {unavailable && <AvailabilityBadge availability={m.availability} inline />}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace `app/src/views/OrganogramView.jsx` with the container**

```jsx
import { useState } from 'react'
import { useCommunity } from '../context/CommunityContext'
import CardGrid from './CardGrid'
import { lazy, Suspense } from 'react'

const RadialView = lazy(() => import('./RadialView'))

export default function OrganogramView() {
  const { community, loading } = useCommunity()
  const [view, setView] = useState('cards') // 'cards' | 'radial'
  const [selectedMember, setSelectedMember] = useState(null)
  const [filter, setFilter] = useState({ workgroupId: '', roleId: '', hideUnavailable: false })

  if (loading) return <div style={{ color: 'var(--color-charcoal-light)' }}>Loading…</div>
  if (!community) return null

  const allRoles = community.workgroups.flatMap((wg) => wg.roles)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-title)', margin: 0 }}>Organogram</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={view === 'cards' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setView('cards')} style={{ fontSize: '0.85rem' }}
          >Cards</button>
          <button
            className={view === 'radial' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setView('radial')} style={{ fontSize: '0.85rem' }}
          >Radial</button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filter.workgroupId}
          onChange={(e) => setFilter((f) => ({ ...f, workgroupId: e.target.value }))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', background: 'white' }}
        >
          <option value="">All workgroups</option>
          {community.workgroups.map((wg) => (
            <option key={wg.id} value={wg.id}>{wg.name}</option>
          ))}
        </select>
        <select
          value={filter.roleId}
          onChange={(e) => setFilter((f) => ({ ...f, roleId: e.target.value }))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', background: 'white' }}
        >
          <option value="">All roles</option>
          {allRoles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filter.hideUnavailable}
            onChange={(e) => setFilter((f) => ({ ...f, hideUnavailable: e.target.checked }))}
          />
          Hide unavailable
        </label>
      </div>

      {view === 'cards' ? (
        <CardGrid community={community} filter={filter} onMemberClick={setSelectedMember} />
      ) : (
        <Suspense fallback={<div>Loading radial view…</div>}>
          <RadialView community={community} filter={filter} onMemberClick={setSelectedMember} />
        </Suspense>
      )}

      {/* Person modal will be added in Task 9 */}
    </div>
  )
}
```

- [ ] **Step 4: Start the app and verify the card grid renders**

```bash
cd /home/serzhilin/Projects/CORE
npm run db:up
cd api && npm run dev &
sleep 2
cd /home/serzhilin/Projects/CORE/app && npm run dev &
sleep 3
```

Open http://localhost:5175 — log in with dev login — check the organogram shows cards (empty initially). The filter bar and view toggle should be visible.

Kill processes:
```bash
kill %1 %2 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/components/AvailabilityBadge.jsx app/src/views/OrganogramView.jsx app/src/views/CardGrid.jsx
git commit -m "feat: organogram card grid with filter bar and PNG export"
```

---

## Task 7: Radial SVG View

**Files:**
- Replace: `app/src/views/RadialView.jsx` (stub → full SVG radial view)

- [ ] **Step 1: Install react-zoom-pan-pinch (already in package.json — verify)**

```bash
cd /home/serzhilin/Projects/CORE/app
ls node_modules/react-zoom-pan-pinch 2>/dev/null && echo "installed" || npm install react-zoom-pan-pinch
```

- [ ] **Step 2: Replace `app/src/views/RadialView.jsx` with SVG radial implementation**

The position math from the spec:
- `workgroupAngle(i) = (2π / N) * i - π/2` (start at top)
- `workgroupX(i) = cx + R_wg * cos(angle)`
- `memberX(i, j, total) = cx + (R_wg * (j+1) / (total+1)) * cos(angle)`

```jsx
import { useRef } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

const W = 900
const H = 900
const cx = W / 2
const cy = H / 2
const R_WG = 320   // radius for workgroup nodes
const R_WG_RECT_W = 100
const R_WG_RECT_H = 36

function workgroupAngle(i, n) { return (2 * Math.PI / n) * i - Math.PI / 2 }

export default function RadialView({ community, filter, onMemberClick }) {
  const svgRef = useRef(null)

  const workgroups = community.workgroups
    .filter((wg) => !filter.workgroupId || wg.id === filter.workgroupId)
    .sort((a, b) => a.sort_order - b.sort_order)

  // person → first role color lookup
  const personColor = {}
  for (const wg of community.workgroups) {
    for (const wm of wg.members) {
      if (!personColor[wm.person_id] && wm.roles.length) {
        const role = wg.roles.find((r) => r.id === wm.roles[0])
        personColor[wm.person_id] = role?.color || '#E8DDD0'
      }
    }
  }

  function membersForWorkgroup(wg) {
    return wg.members
      .map((wm) => {
        const member = community.members.find((m) => m.personId === wm.person_id)
        return member
      })
      .filter(Boolean)
      .filter((m) => !filter.hideUnavailable || !m.availability)
  }

  function exportSvg() {
    if (!svgRef.current) return
    const blob = new Blob([svgRef.current.outerHTML], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.download = 'organogram.svg'
    a.href = URL.createObjectURL(blob)
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const N = workgroups.length || 1

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn-secondary" onClick={exportSvg} style={{ fontSize: '0.85rem' }}>
          Save as SVG
        </button>
      </div>

      <div style={{ border: '1px solid var(--color-sand)', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
        <TransformWrapper minScale={0.3} maxScale={3} initialScale={1}>
          <TransformComponent wrapperStyle={{ width: '100%', height: 600 }}>
            <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
              {/* Center circle */}
              <circle cx={cx} cy={cy} r={60} fill="white" stroke="var(--color-sand-dark)" strokeWidth={2} />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: 13, fontFamily: 'var(--font-title)', fontWeight: 700, fill: 'var(--color-charcoal)' }}>
                {community.name.length > 14 ? community.name.slice(0, 13) + '…' : community.name}
              </text>

              {workgroups.map((wg, i) => {
                const angle = workgroupAngle(i, N)
                const wgX = cx + R_WG * Math.cos(angle)
                const wgY = cy + R_WG * Math.sin(angle)
                const members = membersForWorkgroup(wg)

                return (
                  <g key={wg.id}>
                    {/* Spoke */}
                    <line x1={cx} y1={cy} x2={wgX} y2={wgY}
                      stroke="var(--color-sand-dark)" strokeWidth={1.5} />

                    {/* Members on spoke */}
                    {members.map((m, j) => {
                      const t = (j + 1) / (members.length + 1)
                      const mX = cx + R_WG * t * Math.cos(angle)
                      const mY = cy + R_WG * t * Math.sin(angle)
                      const color = personColor[m.personId] || '#E8DDD0'
                      const unavailable = !!m.availability
                      return (
                        <g key={m.personId} onClick={() => onMemberClick(m)} style={{ cursor: 'pointer' }}>
                          <circle cx={mX} cy={mY} r={14}
                            fill={color}
                            opacity={unavailable ? 0.4 : 1}
                            stroke="white" strokeWidth={2} />
                          {unavailable && (
                            <text x={mX} y={mY} textAnchor="middle" dominantBaseline="middle" fontSize={10}>
                              {m.availability.type.emoji}
                            </text>
                          )}
                          <text x={mX} y={mY + 20} textAnchor="middle"
                            style={{ fontSize: 10, fill: 'var(--color-charcoal)', fontFamily: 'Inter, sans-serif' }}>
                            {m.firstName || '?'}
                          </text>
                        </g>
                      )
                    })}

                    {/* Workgroup rect */}
                    <rect
                      x={wgX - R_WG_RECT_W / 2}
                      y={wgY - R_WG_RECT_H / 2}
                      width={R_WG_RECT_W}
                      height={R_WG_RECT_H}
                      rx={6}
                      fill="white"
                      stroke={wg.color}
                      strokeWidth={2}
                    />
                    <text x={wgX} y={wgY} textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: 11, fontWeight: 600, fill: 'var(--color-charcoal)', fontFamily: 'Inter, sans-serif' }}>
                      {wg.name.length > 13 ? wg.name.slice(0, 12) + '…' : wg.name}
                    </text>
                  </g>
                )
              })}
            </svg>
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Start the app and verify the radial view renders**

```bash
cd /home/serzhilin/Projects/CORE
npm run db:up
cd api && npm run dev &
sleep 2
cd /home/serzhilin/Projects/CORE/app && npm run dev &
sleep 3
echo "Open http://localhost:5175, toggle to Radial view"
kill %1 %2 2>/dev/null || true
```

Expected: switching to "Radial" shows a SVG with a center circle and spoke layout. Empty community shows only the center circle.

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/RadialView.jsx
git commit -m "feat: radial SVG organogram with zoom/pan and SVG export"
```

---

## Task 8: Members Table + Person Modal

**Files:**
- Create: `app/src/components/PersonModal.jsx`
- Replace: `app/src/views/MembersTable.jsx`
- Modify: `app/src/views/OrganogramView.jsx` (wire PersonModal into it)

- [ ] **Step 1: Create `app/src/components/PersonModal.jsx`**

```jsx
import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import AvailabilityBadge from './AvailabilityBadge'

export default function PersonModal({ member, onClose }) {
  const { user } = useUser()
  const { community } = useCommunity()

  if (!member) return null

  const myMembership = community?.members.find((m) => m.personId === user?.id)
  const isAdmin = myMembership?.isAdmin ?? false
  const isOwn = member.personId === user?.id

  // Workgroup memberships for this person
  const wgMemberships = community?.workgroups
    .filter((wg) => wg.members.some((wm) => wm.person_id === member.personId))
    .map((wg) => {
      const wm = wg.members.find((wm) => wm.person_id === member.personId)
      const roles = (wm?.roles || []).map((rid) => wg.roles.find((r) => r.id === rid)).filter(Boolean)
      return { workgroup: wg, roles }
    }) || []

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(44,44,44,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 480, width: '100%', padding: 32, maxHeight: '80vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', margin: '0 0 4px' }}>
              {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'}
            </h2>
            {member.isAdmin && <span style={{ fontSize: '0.75rem', background: 'var(--color-sand)', borderRadius: 4, padding: '2px 8px' }}>Admin</span>}
            {member.isAspirant && <span style={{ fontSize: '0.75rem', background: '#FFF3CD', borderRadius: 4, padding: '2px 8px', marginLeft: 4 }}>Aspirant</span>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--color-charcoal-light)', lineHeight: 1 }}>×</button>
        </div>

        {/* Contact */}
        {member.email && (
          <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: 'var(--color-charcoal-light)' }}>
            📧 {member.email}
          </p>
        )}

        {/* Availability */}
        {member.availability && (
          <div style={{ background: 'var(--color-sand)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.9rem' }}>
            <AvailabilityBadge availability={member.availability} /> {member.availability.type.name}
            {member.availability.reason && <span style={{ color: 'var(--color-charcoal-light)' }}> — {member.availability.reason}</span>}
            {member.availability.until && <span style={{ color: 'var(--color-charcoal-light)' }}> (until {member.availability.until})</span>}
          </div>
        )}

        {/* Workgroups */}
        {wgMemberships.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--color-charcoal-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Workgroups</h4>
            {wgMemberships.map(({ workgroup, roles }) => (
              <div key={workgroup.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: workgroup.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{workgroup.name}</span>
                {roles.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>
                    — {roles.map((r) => r.name).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {(isAdmin || isOwn) && (
          <div style={{ paddingTop: 16, borderTop: '1px solid var(--color-sand)', fontSize: '0.85rem', color: 'var(--color-charcoal-light)' }}>
            Edit available in {isOwn ? '"My profile"' : '"Admin → Members"'}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire PersonModal into OrganogramView**

In `app/src/views/OrganogramView.jsx`, add the import and render the modal. Find the comment `{/* Person modal will be added in Task 9 */}` and replace it:

```jsx
// Add import at the top:
import PersonModal from '../components/PersonModal'

// Replace the comment at the bottom of the return:
{selectedMember && <PersonModal member={selectedMember} onClose={() => setSelectedMember(null)} />}
```

- [ ] **Step 3: Replace `app/src/views/MembersTable.jsx`**

```jsx
import { useState } from 'react'
import { useCommunity } from '../context/CommunityContext'
import { useUser } from '../context/UserContext'
import AvailabilityBadge from '../components/AvailabilityBadge'
import PersonModal from '../components/PersonModal'

const SORT_KEYS = { name: 'name', joined: 'joinedAt', availability: 'availability' }

export default function MembersTable() {
  const { community, loading } = useCommunity()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [selected, setSelected] = useState(null)

  if (loading) return <div style={{ color: 'var(--color-charcoal-light)' }}>Loading…</div>
  if (!community) return null

  function toggleSort(key) {
    if (sortKey === key) setSortAsc((a) => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const members = community.members
    .filter((m) => {
      const q = search.toLowerCase()
      return !q ||
        (m.firstName || '').toLowerCase().includes(q) ||
        (m.lastName || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q)
    })
    .map((m) => {
      const wgNames = community.workgroups
        .filter((wg) => wg.members.some((wm) => wm.person_id === m.personId))
        .map((wg) => wg.name)
      const roleNames = community.workgroups.flatMap((wg) => {
        const wm = wg.members.find((wm) => wm.person_id === m.personId)
        return (wm?.roles || []).map((rid) => wg.roles.find((r) => r.id === rid)?.name).filter(Boolean)
      })
      return { ...m, wgNames, roleNames }
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        const na = [a.firstName, a.lastName].filter(Boolean).join(' ')
        const nb = [b.firstName, b.lastName].filter(Boolean).join(' ')
        cmp = na.localeCompare(nb)
      } else if (sortKey === 'joinedAt') {
        cmp = (a.joinedAt || '').localeCompare(b.joinedAt || '')
      } else if (sortKey === 'availability') {
        cmp = (a.availability ? 1 : 0) - (b.availability ? 1 : 0)
      }
      return sortAsc ? cmp : -cmp
    })

  function SortHeader({ label, k }) {
    const active = sortKey === k
    return (
      <th
        onClick={() => toggleSort(k)}
        style={{ textAlign: 'left', padding: '10px 16px', cursor: 'pointer', background: active ? 'var(--color-sand)' : 'transparent', whiteSpace: 'nowrap', userSelect: 'none' }}
      >
        {label} {active ? (sortAsc ? '↑' : '↓') : ''}
      </th>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-title)', margin: 0 }}>Members</h2>
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-sand-dark)', width: 220, background: 'white' }}
        />
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead style={{ borderBottom: '2px solid var(--color-sand)' }}>
            <tr>
              <SortHeader label="Name" k="name" />
              <th style={{ textAlign: 'left', padding: '10px 16px' }}>Workgroups</th>
              <th style={{ textAlign: 'left', padding: '10px 16px' }}>Roles</th>
              <SortHeader label="Availability" k="availability" />
              <SortHeader label="Joined" k="joinedAt" />
            </tr>
          </thead>
          <tbody>
            {members.map((m, idx) => (
              <tr
                key={m.personId}
                onClick={() => setSelected(m)}
                style={{
                  cursor: 'pointer',
                  background: idx % 2 === 0 ? 'transparent' : 'var(--color-cream)',
                  opacity: m.availability ? 0.7 : 1,
                }}
              >
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>
                  {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || '—'}
                  {m.isAspirant && (
                    <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#FFF3CD', borderRadius: 4, padding: '1px 6px' }}>Aspirant</span>
                  )}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--color-charcoal-light)' }}>
                  {m.wgNames.join(', ') || '—'}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--color-charcoal-light)' }}>
                  {m.roleNames.join(', ') || '—'}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  {m.availability
                    ? <span title={m.availability.reason || ''}><AvailabilityBadge availability={m.availability} /> {m.availability.type.name}</span>
                    : <span style={{ color: 'var(--color-green)', fontSize: '0.85rem' }}>Available</span>}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--color-charcoal-light)' }}>
                  {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('nl-NL') : '—'}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--color-charcoal-light)' }}>No members found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <PersonModal member={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/components/PersonModal.jsx app/src/views/MembersTable.jsx app/src/views/OrganogramView.jsx
git commit -m "feat: person modal + sortable/searchable members table"
```

---

## Task 9: My Profile View

**Files:**
- Replace: `app/src/views/MyProfile.jsx`

`GET /api/me` returns `{ person: { id, ename, firstName, lastName, displayName, email, phone, bio, avatarUrl }, memberships }`. `PATCH /api/me` accepts `{ first_name, last_name, email, phone, bio, avatar_url }`.

`PATCH /api/communities/:cid/me/availability` accepts `{ type_id, reason, until }` or `{ clear: true }`.

- [ ] **Step 1: Replace `app/src/views/MyProfile.jsx`**

```jsx
import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import { updateMe, setMyAvailability } from '../api/client'

export default function MyProfile() {
  const { user, refreshMe } = useUser()
  const { communityId, community, availabilityTypes, myMembership, refresh } = useCommunity()

  const [form, setForm] = useState({
    first_name: user?.firstName || '',
    last_name: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [avForm, setAvForm] = useState({
    type_id: myMembership?.availability?.type.id || '',
    reason: myMembership?.availability?.reason || '',
    until: myMembership?.availability?.until || '',
  })
  const [avSaving, setAvSaving] = useState(false)

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    try {
      await updateMe(form)
      await refreshMe()
      setSaveMsg('Saved!')
    } catch (err) {
      setSaveMsg('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSetAvailability(e) {
    e.preventDefault()
    setAvSaving(true)
    try {
      await setMyAvailability(communityId, {
        type_id: avForm.type_id || undefined,
        reason: avForm.reason || undefined,
        until: avForm.until || undefined,
      })
      await refresh()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setAvSaving(false)
    }
  }

  async function handleClearAvailability() {
    setAvSaving(true)
    try {
      await setMyAvailability(communityId, { clear: true })
      await refresh()
      setAvForm({ type_id: '', reason: '', until: '' })
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setAvSaving(false)
    }
  }

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, avatar_url: reader.result }))
    reader.readAsDataURL(file)
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: 24 }}>My Profile</h2>

      {/* Profile form */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', color: 'var(--color-charcoal-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Personal information
        </h3>
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>First name</label>
              <input style={inputStyle} value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Last name</label>
              <input style={inputStyle} value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Email</label>
            <input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Phone</label>
            <input style={inputStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Bio</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Avatar</label>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            {saveMsg && <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>{saveMsg}</span>}
          </div>
        </form>
      </div>

      {/* Availability form */}
      {communityId && (
        <div className="card" style={{ padding: 28 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '1rem', color: 'var(--color-charcoal-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Availability in {community?.name}
          </h3>
          {myMembership?.availability && (
            <div style={{ background: 'var(--color-sand)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.9rem' }}>
              Currently: {myMembership.availability.type.emoji} {myMembership.availability.type.name}
              {myMembership.availability.reason && ` — ${myMembership.availability.reason}`}
            </div>
          )}
          <form onSubmit={handleSetAvailability} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Status</label>
              <select
                style={inputStyle}
                value={avForm.type_id}
                onChange={(e) => setAvForm((f) => ({ ...f, type_id: e.target.value }))}
              >
                <option value="">Available (no status)</option>
                {availabilityTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Reason (optional)</label>
              <input style={inputStyle} value={avForm.reason} onChange={(e) => setAvForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Short note…" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Until (optional)</label>
              <input type="date" style={inputStyle} value={avForm.until} onChange={(e) => setAvForm((f) => ({ ...f, until: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn-primary" disabled={avSaving || !avForm.type_id}>
                {avSaving ? 'Saving…' : 'Set availability'}
              </button>
              {myMembership?.availability && (
                <button type="button" className="btn-secondary" onClick={handleClearAvailability} disabled={avSaving}>
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/MyProfile.jsx
git commit -m "feat: my profile view — edit profile + set/clear availability"
```

---

## Task 10: Admin Panel — Community Tab

**Files:**
- Create: `app/src/views/admin/CommunityTab.jsx`

- [ ] **Step 1: Create `app/src/views/admin/CommunityTab.jsx`**

```jsx
import { useState } from 'react'
import { useCommunity } from '../../context/CommunityContext'
import {
  updateCommunity,
  listAvailabilityTypes,
  createAvailabilityType,
  updateAvailabilityType,
  archiveAvailabilityType,
} from '../../api/client'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box',
}

export default function CommunityTab() {
  const { communityId, community, availabilityTypes, refresh } = useCommunity()

  const [form, setForm] = useState({
    name: community?.name || '',
    slug: community?.slug || '',
    description: community?.description || '',
    primary_color: community?.primary_color || '#C4622D',
    title_font: community?.title_font || 'Playfair Display',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [atForm, setAtForm] = useState({ name: '', emoji: '' })
  const [atSaving, setAtSaving] = useState(false)
  const [editingAt, setEditingAt] = useState(null) // {id, name, emoji}

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    try {
      await updateCommunity(communityId, form)
      await refresh()
      setSaveMsg('Saved!')
    } catch (err) {
      setSaveMsg('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddAvailabilityType(e) {
    e.preventDefault()
    if (!atForm.name || !atForm.emoji) return
    setAtSaving(true)
    try {
      await createAvailabilityType(communityId, atForm)
      await refresh()
      setAtForm({ name: '', emoji: '' })
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setAtSaving(false)
    }
  }

  async function handleUpdateAt(id, data) {
    try {
      await updateAvailabilityType(communityId, id, data)
      await refresh()
      setEditingAt(null)
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  async function handleArchiveAt(id) {
    if (!confirm('Archive this availability type?')) return
    try {
      await archiveAvailabilityType(communityId, id)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Community settings */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
          Community settings
        </h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Name</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Slug</label>
            <input style={inputStyle} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} pattern="[a-z0-9-]+" />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-light)' }}>Lowercase letters, numbers, hyphens only</span>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Description</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Primary color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} style={{ width: 40, height: 36, border: 'none', padding: 0, cursor: 'pointer' }} />
                <input style={{ ...inputStyle, flex: 1 }} value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Title font</label>
              <select style={inputStyle} value={form.title_font} onChange={(e) => setForm((f) => ({ ...f, title_font: e.target.value }))}>
                <option>Playfair Display</option>
                <option>Inter</option>
                <option>Georgia</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            {saveMsg && <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>{saveMsg}</span>}
          </div>
        </form>
      </div>

      {/* Availability types */}
      <div className="card" style={{ padding: 28 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
          Availability types
        </h3>
        <div style={{ marginBottom: 16 }}>
          {availabilityTypes.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-sand)' }}>
              {editingAt?.id === t.id ? (
                <>
                  <input value={editingAt.emoji} onChange={(e) => setEditingAt((a) => ({ ...a, emoji: e.target.value }))} style={{ width: 48, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', textAlign: 'center' }} />
                  <input value={editingAt.name} onChange={(e) => setEditingAt((a) => ({ ...a, name: e.target.value }))} style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-sand-dark)' }} />
                  <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => handleUpdateAt(t.id, { name: editingAt.name, emoji: editingAt.emoji })}>Save</button>
                  <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => setEditingAt(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '1.1rem' }}>{t.emoji}</span>
                  <span style={{ flex: 1 }}>{t.name}</span>
                  <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '3px 8px' }} onClick={() => setEditingAt({ id: t.id, name: t.name, emoji: t.emoji })}>Edit</button>
                  <button style={{ background: 'none', border: 'none', color: 'var(--color-charcoal-light)', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => handleArchiveAt(t.id)}>Archive</button>
                </>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={handleAddAvailabilityType} style={{ display: 'flex', gap: 8 }}>
          <input placeholder="🏖" value={atForm.emoji} onChange={(e) => setAtForm((f) => ({ ...f, emoji: e.target.value }))} style={{ width: 60, padding: '8px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', textAlign: 'center' }} />
          <input placeholder="Name" value={atForm.name} onChange={(e) => setAtForm((f) => ({ ...f, name: e.target.value }))} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-sand-dark)' }} />
          <button type="submit" className="btn-primary" disabled={atSaving || !atForm.name || !atForm.emoji} style={{ fontSize: '0.85rem' }}>Add</button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/admin/CommunityTab.jsx
git commit -m "feat: admin community tab — settings + availability type management"
```

---

## Task 11: Admin Panel — Members Tab

**Files:**
- Create: `app/src/views/admin/MembersTab.jsx`

- [ ] **Step 1: Create `app/src/views/admin/MembersTab.jsx`**

```jsx
import { useState } from 'react'
import { useCommunity } from '../../context/CommunityContext'
import { addMember, updateMember, removeMember } from '../../api/client'

const inputStyle = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', fontSize: '0.9rem', background: 'white' }

export default function MembersTab() {
  const { communityId, community, refresh } = useCommunity()
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState({ first_name: '', last_name: '', email: '' })
  const [addSaving, setAddSaving] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    setAddSaving(true)
    try {
      await addMember(communityId, addForm)
      await refresh()
      setAdding(false)
      setAddForm({ first_name: '', last_name: '', email: '' })
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setAddSaving(false)
    }
  }

  async function handleUpdate(pid, data) {
    try {
      await updateMember(communityId, pid, data)
      await refresh()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  async function handleRemove(pid, name) {
    if (!confirm(`Remove ${name} from this community?`)) return
    try {
      await removeMember(communityId, pid)
      await refresh()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-title)' }}>Members</h3>
        <button className="btn-primary" onClick={() => setAdding(true)} style={{ fontSize: '0.85rem' }}>Add member</button>
      </div>

      {adding && (
        <div className="card-warm" style={{ padding: 20, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 16px' }}>Add member</h4>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>First name</label>
              <input style={inputStyle} value={addForm.first_name} onChange={(e) => setAddForm((f) => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>Last name</label>
              <input style={inputStyle} value={addForm.last_name} onChange={(e) => setAddForm((f) => ({ ...f, last_name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>Email</label>
              <input type="email" style={inputStyle} value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="submit" className="btn-primary" disabled={addSaving} style={{ fontSize: '0.85rem' }}>Add</button>
              <button type="button" className="btn-secondary" onClick={() => setAdding(false)} style={{ fontSize: '0.85rem' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead style={{ borderBottom: '2px solid var(--color-sand)' }}>
            <tr>
              {['Name', 'Email', 'Admin', 'Aspirant', 'Joined', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(community?.members || []).map((m, idx) => {
              const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || 'Unknown'
              return (
                <tr key={m.personId} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--color-cream)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{name}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-charcoal-light)', fontSize: '0.85rem' }}>{m.email || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <input type="checkbox" checked={m.isAdmin}
                      onChange={(e) => handleUpdate(m.personId, { is_admin: e.target.checked })} />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <input type="checkbox" checked={m.isAspirant}
                      onChange={(e) => handleUpdate(m.personId, { is_aspirant: e.target.checked })} />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <input
                      type="date"
                      value={m.joinedAt ? m.joinedAt.slice(0, 10) : ''}
                      onChange={(e) => handleUpdate(m.personId, { joined_at: e.target.value || null })}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', fontSize: '0.85rem' }}
                    />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => handleRemove(m.personId, name)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/admin/MembersTab.jsx
git commit -m "feat: admin members tab — add/edit/remove community members"
```

---

## Task 12: Admin Panel — Workgroups Tab

**Files:**
- Create: `app/src/views/admin/WorkgroupsTab.jsx`

- [ ] **Step 1: Create `app/src/views/admin/WorkgroupsTab.jsx`**

```jsx
import { useState } from 'react'
import { useCommunity } from '../../context/CommunityContext'
import {
  createWorkgroup, updateWorkgroup, deleteWorkgroup,
  createRole, updateRole, deleteRole,
  addWorkgroupMember, updateWorkgroupMember, removeWorkgroupMember,
  assignRole, unassignRole,
} from '../../api/client'

const inputStyle = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', fontSize: '0.9rem', background: 'white' }

export default function WorkgroupsTab() {
  const { communityId, community, refresh } = useCommunity()
  const [expanded, setExpanded] = useState(null)
  const [addWgForm, setAddWgForm] = useState({ name: '', color: '#C4622D' })
  const [addingWg, setAddingWg] = useState(false)
  const [addingRole, setAddingRole] = useState({}) // {wgId: {name, color}}
  const [addingMember, setAddingMember] = useState(null) // wgId

  async function handleCreateWorkgroup(e) {
    e.preventDefault()
    try {
      await createWorkgroup(communityId, addWgForm)
      await refresh()
      setAddingWg(false)
      setAddWgForm({ name: '', color: '#C4622D' })
    } catch (err) { alert(err.message) }
  }

  async function handleDeleteWorkgroup(wid) {
    if (!confirm('Delete this workgroup and all its roles?')) return
    try { await deleteWorkgroup(communityId, wid); await refresh() }
    catch (err) { alert(err.message) }
  }

  async function handleCreateRole(wid, e) {
    e.preventDefault()
    const data = addingRole[wid] || { name: '', color: '#C4622D' }
    if (!data.name) return
    try {
      await createRole(wid, data)
      await refresh()
      setAddingRole((r) => ({ ...r, [wid]: { name: '', color: '#C4622D' } }))
    } catch (err) { alert(err.message) }
  }

  async function handleDeleteRole(wid, rid) {
    if (!confirm('Delete role?')) return
    try { await deleteRole(wid, rid); await refresh() }
    catch (err) { alert(err.message) }
  }

  async function handleAddMember(wid, personId) {
    try { await addWorkgroupMember(wid, { person_id: personId }); await refresh(); setAddingMember(null) }
    catch (err) { alert(err.message) }
  }

  async function handleRemoveMember(wid, pid) {
    try { await removeWorkgroupMember(wid, pid); await refresh() }
    catch (err) { alert(err.message) }
  }

  async function handleToggleWgAdmin(wid, pid, val) {
    try { await updateWorkgroupMember(wid, pid, { is_workgroup_admin: val }); await refresh() }
    catch (err) { alert(err.message) }
  }

  async function handleAssignRole(wid, pid, roleId) {
    try { await assignRole(wid, pid, { role_id: roleId }); await refresh() }
    catch (err) { if (!err.message.includes('409')) alert(err.message) }
  }

  async function handleUnassignRole(wid, pid, rid) {
    try { await unassignRole(wid, pid, rid); await refresh() }
    catch (err) { alert(err.message) }
  }

  const communityMembers = community?.members || []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-title)' }}>Workgroups</h3>
        <button className="btn-primary" onClick={() => setAddingWg(true)} style={{ fontSize: '0.85rem' }}>Add workgroup</button>
      </div>

      {addingWg && (
        <div className="card-warm" style={{ padding: 20, marginBottom: 16 }}>
          <form onSubmit={handleCreateWorkgroup} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>Name</label>
              <input style={inputStyle} value={addWgForm.name} onChange={(e) => setAddWgForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>Color</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="color" value={addWgForm.color} onChange={(e) => setAddWgForm((f) => ({ ...f, color: e.target.value }))} style={{ width: 36, height: 34, border: 'none', padding: 0, cursor: 'pointer' }} />
                <input style={{ ...inputStyle, width: 90 }} value={addWgForm.color} onChange={(e) => setAddWgForm((f) => ({ ...f, color: e.target.value }))} />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ fontSize: '0.85rem' }}>Create</button>
            <button type="button" className="btn-secondary" onClick={() => setAddingWg(false)} style={{ fontSize: '0.85rem' }}>Cancel</button>
          </form>
        </div>
      )}

      {(community?.workgroups || []).map((wg) => {
        const isExpanded = expanded === wg.id
        const wgMembers = wg.members
          .map((wm) => ({ ...wm, member: communityMembers.find((m) => m.personId === wm.person_id) }))
          .filter((wm) => wm.member)

        const nonMembers = communityMembers.filter(
          (m) => !wg.members.some((wm) => wm.person_id === m.personId)
        )

        return (
          <div key={wg.id} className="card" style={{ marginBottom: 12, borderLeft: `4px solid ${wg.color}` }}>
            {/* Header */}
            <div
              onClick={() => setExpanded(isExpanded ? null : wg.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', userSelect: 'none' }}
            >
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-title)' }}>{wg.name}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>
                  {wg.members.length} members · {wg.roles.length} roles
                </span>
                <button
                  onClick={() => handleDeleteWorkgroup(wg.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Delete
                </button>
                <span style={{ color: 'var(--color-charcoal-light)' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--color-sand)', padding: 20 }}>
                {/* Roles */}
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>Roles</h4>
                  {wg.roles.map((r) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.color }} />
                      <span style={{ flex: 1, fontSize: '0.9rem' }}>{r.name}</span>
                      <button
                        onClick={() => handleDeleteRole(wg.id, r.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', fontSize: '0.8rem' }}
                      >×</button>
                    </div>
                  ))}
                  <form onSubmit={(e) => handleCreateRole(wg.id, e)} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input
                      placeholder="Role name"
                      value={(addingRole[wg.id] || {}).name || ''}
                      onChange={(e) => setAddingRole((r) => ({ ...r, [wg.id]: { ...(r[wg.id] || {}), name: e.target.value } }))}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <input
                      type="color"
                      value={(addingRole[wg.id] || {}).color || '#C4622D'}
                      onChange={(e) => setAddingRole((r) => ({ ...r, [wg.id]: { ...(r[wg.id] || {}), color: e.target.value } }))}
                      style={{ width: 36, height: 34, border: 'none', padding: 0, cursor: 'pointer' }}
                    />
                    <button type="submit" className="btn-secondary" style={{ fontSize: '0.8rem' }}>Add role</button>
                  </form>
                </div>

                {/* Members */}
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>Members</h4>
                  {wgMembers.map(({ member, is_workgroup_admin, roles }) => (
                    <div key={member.personId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500 }}>
                        {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={is_workgroup_admin}
                          onChange={(e) => handleToggleWgAdmin(wg.id, member.personId, e.target.checked)}
                        /> WG admin
                      </label>
                      <select
                        defaultValue=""
                        onChange={(e) => { if (e.target.value) handleAssignRole(wg.id, member.personId, e.target.value); e.target.value = '' }}
                        style={{ ...inputStyle, padding: '4px 6px', fontSize: '0.8rem' }}
                      >
                        <option value="">+ Role</option>
                        {wg.roles.filter((r) => !roles.includes(r.id)).map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      {roles.map((rid) => {
                        const role = wg.roles.find((r) => r.id === rid)
                        if (!role) return null
                        return (
                          <span key={rid} style={{ fontSize: '0.75rem', background: role.color + '30', border: `1px solid ${role.color}`, borderRadius: 4, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {role.name}
                            <button onClick={() => handleUnassignRole(wg.id, member.personId, rid)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--color-charcoal-light)' }}>×</button>
                          </span>
                        )
                      })}
                      <button
                        onClick={() => handleRemoveMember(wg.id, member.personId)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {addingMember === wg.id ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
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
                    <button className="btn-secondary" onClick={() => setAddingMember(wg.id)} style={{ fontSize: '0.8rem', marginTop: 8 }}>
                      + Add member
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/admin/WorkgroupsTab.jsx
git commit -m "feat: admin workgroups tab — workgroup/role/member/role-assignment management"
```

---

## Task 13: Admin Panel Container + Final Smoke Test

**Files:**
- Replace: `app/src/views/AdminPanel.jsx`

- [ ] **Step 1: Replace `app/src/views/AdminPanel.jsx`**

```jsx
import { useState } from 'react'
import { useCommunity } from '../context/CommunityContext'
import { useUser } from '../context/UserContext'
import CommunityTab from './admin/CommunityTab'
import MembersTab from './admin/MembersTab'
import WorkgroupsTab from './admin/WorkgroupsTab'

const TABS = [
  { key: 'community', label: 'Community' },
  { key: 'members', label: 'Members' },
  { key: 'workgroups', label: 'Workgroups' },
]

export default function AdminPanel() {
  const { community, myMembership } = useCommunity()
  const { user } = useUser()
  const [tab, setTab] = useState('community')

  const isAdmin = myMembership?.isAdmin ?? false
  const isWorkgroupAdmin = community?.workgroups?.some((wg) =>
    wg.members.some((wm) => wm.person_id === user?.id && wm.is_workgroup_admin)
  ) ?? false

  if (!isAdmin && !isWorkgroupAdmin) {
    return <div style={{ color: 'var(--color-charcoal-light)', padding: 32 }}>Access denied.</div>
  }

  const visibleTabs = isAdmin ? TABS : TABS.filter((t) => t.key === 'workgroups')

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: 24 }}>Admin</h2>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '2px solid var(--color-sand)' }}>
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 20px', fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? 'var(--color-terracotta)' : 'var(--color-charcoal-light)',
              borderBottom: tab === t.key ? '2px solid var(--color-terracotta)' : '2px solid transparent',
              marginBottom: -2, fontSize: '0.95rem', fontFamily: 'Inter, sans-serif',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'community' && isAdmin && <CommunityTab />}
      {tab === 'members' && isAdmin && <MembersTab />}
      {tab === 'workgroups' && <WorkgroupsTab />}
    </div>
  )
}
```

- [ ] **Step 2: Start both services and run through the full app manually**

```bash
cd /home/serzhilin/Projects/CORE
npm run db:up
npm run dev &
sleep 5
```

Open http://localhost:5175 and verify:
1. Login screen shows (QR on desktop, wallet link on mobile)
2. Dev login button works → lands on Organogram
3. Sidebar shows Organogram, Members, My profile, Admin links
4. Organogram shows empty card grid and radial toggle
5. Members table shows the current user
6. My profile loads and edit form pre-fills name fields
7. Admin panel shows three tabs (Community / Members / Workgroups)
8. Create a workgroup in Admin → Workgroups → verify it appears in organogram

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 3: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/AdminPanel.jsx
git commit -m "feat: admin panel — 3-tab container (community / members / workgroups)"
```

---

## Self-Review

**Spec coverage check:**

| Spec §5 requirement | Covered? |
|---|---|
| Sidebar + community switcher | ✅ Scaffold plan Task 5 |
| Organogram — card grid | ✅ Task 6 CardGrid.jsx |
| Card grid: colored top border, role dot, unavailable opacity | ✅ Task 6 |
| Card grid: filter bar (workgroup, role, hide unavailable) | ✅ Task 6 OrganogramView |
| Card grid: Save as PNG (html2canvas) | ✅ Task 6 CardGrid |
| Organogram — radial SVG | ✅ Task 7 RadialView.jsx |
| Radial: spokes, workgroup rect, person circle, role color | ✅ Task 7 |
| Radial: zoom/pan (react-zoom-pan-pinch) | ✅ Task 7 |
| Radial: Save as SVG | ✅ Task 7 |
| Person profile modal | ✅ Task 8 PersonModal.jsx |
| Members table — sortable, searchable, aspirant badge | ✅ Task 8 MembersTable.jsx |
| My profile — edit fields, avatar upload, set/clear availability | ✅ Task 9 MyProfile.jsx |
| Admin community tab — settings + branding + availability types | ✅ Task 10 CommunityTab.jsx |
| Admin members tab — add/edit/remove | ✅ Task 11 MembersTab.jsx |
| Admin workgroups tab — workgroups/roles/members/role assignment | ✅ Task 12 WorkgroupsTab.jsx |
| Onboarding screen — no memberships | ✅ Scaffold plan Task 5 |

**Placeholder scan:** No TBD / TODO / "similar to" patterns. All steps have complete code.

**Type consistency:**
- `community.members[].personId` used consistently (not `.id` or `.person_id`)
- `community.workgroups[].members[].person_id` used consistently (snake_case from API)
- `myMembership?.isAdmin` used consistently in Sidebar and AdminPanel
- `availabilityTypes` from CommunityContext used in MyProfile and CommunityTab
- `communityId` from CommunityContext used as path param in all API calls
