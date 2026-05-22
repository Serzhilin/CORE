# Unified Info Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace two fragmented side panels (MemberSidePanel overlay + GraphSidePanel inside graph) with a single `InfoPanel` component that pushes content in both graph and cards views, with community/workgroup/person navigation inside.

**Architecture:** `InfoPanel` is a self-contained flex child of `OrganogramView`'s main content row. It manages its own open/closed state and internal navigation (community → workgroup → person). `OrganogramView` holds the selected item and passes it as a prop; `InfoPanel` auto-opens when selection changes. GraphView gets an `onWorkgroupSelect` prop alongside the existing `onPersonSelect`.

**Tech Stack:** React (JSX), inline styles, CSS variables from `index.css`, community context.

---

## File Map

| File | Action |
|------|--------|
| `app/src/components/InfoPanel.jsx` | **Create** — unified panel |
| `app/src/views/OrganogramView.jsx` | **Modify** — flex layout, panelSelection state, wire InfoPanel |
| `app/src/views/graph/GraphView.jsx` | **Modify** — add `onWorkgroupSelect`, remove GraphSidePanel |
| `app/src/components/MemberSidePanel.jsx` | **Delete** |
| `app/src/views/graph/GraphSidePanel.jsx` | **Delete** |
| `app/src/views/graph/PersonPanel.jsx` | **Delete** |
| `app/src/views/graph/WorkgroupPanel.jsx` | **Delete** |

---

### Task 1: Create InfoPanel component

**Files:**
- Create: `app/src/components/InfoPanel.jsx`

**Data shapes used (read-only reference):**
- `community.workgroups[i]` → `{ id, name, color, description, members: [{person_id, roles: string[]}], roles: [{id, name, color}] }`
- `community.members[i]` → `{ personId, firstName, lastName, bio, avatarUrl, isAdmin, isAspirant, isActivePartner, joinedAt, availability: { type: {emoji, name}, reason, until } | null }`
- `selection` prop → `null | { type: 'community'|'workgroup'|'person', id?: string, fromWorkgroup?: string }`

- [ ] **Step 1: Create the file**

```jsx
import { useState, useEffect } from 'react'
import { useCommunity } from '../context/CommunityContext'

const PANEL_WIDTH = 300
const TAB_WIDTH = 28

// ── helpers ──────────────────────────────────────────────────────────────────

function accentColor(selection, community) {
  if (!selection || selection.type === 'community') return 'var(--color-terracotta)'
  if (selection.type === 'workgroup') {
    const wg = community?.workgroups.find(w => w.id === selection.id)
    return wg?.color ?? 'var(--color-terracotta)'
  }
  if (selection.type === 'person') {
    if (selection.fromWorkgroup) {
      const wg = community?.workgroups.find(w => w.id === selection.fromWorkgroup)
      return wg?.color ?? 'var(--color-terracotta)'
    }
    return 'var(--color-terracotta)'
  }
  return 'var(--color-terracotta)'
}

// ── sub-views ─────────────────────────────────────────────────────────────────

function CommunityView({ community, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div>
        <div style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '1.1rem', marginBottom: 4 }}>
          {community.name}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>
          {community.members.length} members · {community.workgroups.length} workgroups
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--color-sand)', paddingTop: 12, flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)', marginBottom: 8 }}>
          Workgroups
        </div>
        {[...community.workgroups].sort((a, b) => a.name.localeCompare(b.name)).map(wg => (
          <div
            key={wg.id}
            onClick={() => onSelect({ type: 'workgroup', id: wg.id })}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-cream)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: wg.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 500 }}>{wg.name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-light)' }}>{wg.members.length}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WorkgroupView({ wg, community, onSelect, onBack, onFilterToWorkgroup }) {
  const members = wg.members
    .map(wm => ({ wm, member: community.members.find(m => m.personId === wm.person_id) }))
    .filter(x => x.member)
    .sort((a, b) => (a.member.firstName || '').localeCompare(b.member.firstName || ''))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-charcoal-light)', fontSize: '1.1rem', lineHeight: 1, padding: '2px 4px', marginLeft: -4 }}>‹</button>
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '1rem', borderLeft: `3px solid ${wg.color}`, paddingLeft: 8 }}>{wg.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-light)', marginTop: 2 }}>{wg.members.length} members</div>
        </div>
      </div>
      {wg.description && <div style={{ fontSize: '0.82rem', color: 'var(--color-charcoal-light)', lineHeight: 1.5 }}>{wg.description}</div>}

      {/* Member list */}
      <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--color-sand)', paddingTop: 8 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)', marginBottom: 8 }}>Members</div>
        {members.map(({ wm, member }) => {
          const roles = (wm.roles || []).map(rid => wg.roles.find(r => r.id === rid)).filter(Boolean)
          const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'
          return (
            <div
              key={member.personId}
              onClick={() => onSelect({ type: 'person', id: member.personId, fromWorkgroup: wg.id })}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '5px 4px', cursor: 'pointer', borderRadius: 5 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-cream)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: wg.color, flexShrink: 0, marginTop: 4 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{name}</div>
                {roles.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: wg.color, marginTop: 1 }}>{roles.map(r => r.name).join(', ')}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter button */}
      <button
        onClick={() => onFilterToWorkgroup(wg.id)}
        style={{ fontSize: '0.75rem', color: wg.color, background: 'none', border: `1px solid ${wg.color}`, borderRadius: 5, padding: '5px 10px', cursor: 'pointer', width: '100%' }}
      >
        Filter to this workgroup
      </button>
    </div>
  )
}

function PersonView({ member, community, fromWorkgroup, onBack }) {
  const wgMemberships = (community?.workgroups || [])
    .filter(wg => wg.members?.some(wm => wm.person_id === member.personId))
    .map(wg => {
      const wm = wg.members.find(wm => wm.person_id === member.personId)
      const roles = (wm?.roles || []).map(rid => wg.roles.find(r => r.id === rid)).filter(Boolean)
      return { wg, roles }
    })

  const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'
  const initial = (member.firstName || member.email || '?')[0].toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto' }}>
      {/* Back */}
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-charcoal-light)', fontSize: '0.82rem', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        ‹ {fromWorkgroup ? (community.workgroups.find(w => w.id === fromWorkgroup)?.name ?? 'Back') : 'Back'}
      </button>

      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {member.avatarUrl
          ? <img src={member.avatarUrl} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-sand-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>{initial}</div>
        }
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '0.95rem', lineHeight: 1.3 }}>{name}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {member.isAdmin && <span style={{ fontSize: '0.68rem', background: 'var(--color-sand)', borderRadius: 4, padding: '1px 6px' }}>Admin</span>}
            {member.isAspirant && <span style={{ fontSize: '0.68rem', background: '#FFF3CD', borderRadius: 4, padding: '1px 6px' }}>Aspirant</span>}
            {member.isActivePartner && <span style={{ fontSize: '0.68rem', background: '#E8F5E9', borderRadius: 4, padding: '1px 6px' }}>Active partner</span>}
          </div>
        </div>
      </div>

      {member.bio && (
        <div style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-light)', lineHeight: 1.6, borderTop: '1px solid var(--color-sand)', paddingTop: 10 }}>{member.bio}</div>
      )}

      {member.availability && (
        <div style={{ background: 'var(--color-sand)', borderRadius: 8, padding: '9px 12px', fontSize: '0.85rem' }}>
          <span style={{ marginRight: 5 }}>{member.availability.type.emoji}</span>
          <span style={{ fontWeight: 500 }}>{member.availability.type.name}</span>
          {member.availability.reason && <span style={{ color: 'var(--color-charcoal-light)' }}> — {member.availability.reason}</span>}
          {member.availability.until && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-charcoal-light)', marginTop: 3 }}>
              Until {new Date(member.availability.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
      )}

      {wgMemberships.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-sand)', paddingTop: 10 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)', marginBottom: 8 }}>Workgroups</div>
          {wgMemberships.map(({ wg, roles }) => (
            <div key={wg.id} style={{ borderLeft: `3px solid ${wg.color}`, paddingLeft: 10, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{wg.name}</div>
              {roles.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {roles.map(r => (
                    <span key={r.id} style={{ fontSize: '0.72rem', background: r.color + '22', border: `1px solid ${r.color}66`, borderRadius: 4, padding: '1px 6px' }}>{r.name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {member.joinedAt && (
        <div style={{ borderTop: '1px solid var(--color-sand)', paddingTop: 10, fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>
          Member since {new Date(member.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      )}
    </div>
  )
}

// ── Main InfoPanel ────────────────────────────────────────────────────────────

export default function InfoPanel({ selection, onSelect, onFilterToWorkgroup }) {
  const { community } = useCommunity()
  const [open, setOpen] = useState(false)

  // Auto-open when something is selected
  useEffect(() => {
    if (selection) setOpen(true)
  }, [selection])

  if (!community) return null

  const accent = accentColor(selection, community)

  function handleBack() {
    if (!selection || selection.type === 'community') return
    if (selection.type === 'workgroup') { onSelect(null); return }
    if (selection.type === 'person') {
      if (selection.fromWorkgroup) {
        onSelect({ type: 'workgroup', id: selection.fromWorkgroup })
      } else {
        onSelect(null)
      }
    }
  }

  function renderContent() {
    if (!selection || selection.type === 'community') {
      return <CommunityView community={community} onSelect={onSelect} />
    }
    if (selection.type === 'workgroup') {
      const wg = community.workgroups.find(w => w.id === selection.id)
      if (!wg) return null
      return <WorkgroupView wg={wg} community={community} onSelect={onSelect} onBack={handleBack} onFilterToWorkgroup={onFilterToWorkgroup} />
    }
    if (selection.type === 'person') {
      const member = community.members.find(m => m.personId === selection.id)
      if (!member) return null
      return <PersonView member={member} community={community} fromWorkgroup={selection.fromWorkgroup} onBack={handleBack} />
    }
    return null
  }

  return (
    <div style={{ display: 'flex', flexShrink: 0 }}>
      {/* Tab strip */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          width: TAB_WIDTH, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', background: 'white',
          borderLeft: `3px solid ${accent}`,
          transition: 'border-color 0.2s',
          userSelect: 'none',
        }}
        title={open ? 'Close panel' : 'Open panel'}
      >
        <span style={{ fontSize: '1rem', color: accent, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>›</span>
      </div>

      {/* Panel body */}
      <div style={{
        width: open ? PANEL_WIDTH : 0,
        overflow: 'hidden',
        transition: 'width 0.2s ease',
        background: 'white',
        borderLeft: '1px solid var(--color-sand)',
        boxShadow: open ? '-4px 0 16px rgba(44,44,44,0.06)' : 'none',
      }}>
        <div style={{ width: PANEL_WIDTH, height: '100%', overflowY: 'auto', padding: '20px 16px', boxSizing: 'border-box' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /home/serzhilin/Projects/CORE && npm --prefix app run build 2>&1 | tail -5
```
Expected: `✓ built in ...ms` (InfoPanel not yet wired, no errors).

- [ ] **Step 3: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/components/InfoPanel.jsx
git commit -m "feat(panel): create unified InfoPanel component"
```

---

### Task 2: Update OrganogramView — flex layout + wire InfoPanel

**Files:**
- Modify: `app/src/views/OrganogramView.jsx`

- [ ] **Step 1: Replace the entire file**

```jsx
import { useState, useRef, lazy, Suspense } from 'react'
import { useCommunity } from '../context/CommunityContext'
import CardGrid from './CardGrid'
import InfoPanel from '../components/InfoPanel'
import html2canvas from 'html2canvas'

const GraphView = lazy(() => import('./graph/GraphView'))

const inputStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', background: 'white', fontSize: '0.9rem' }
const checkStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', cursor: 'pointer' }

const INITIAL_FILTER = { workgroupId: '', roleName: '', showUnavailable: true, showAspirants: true, search: '' }

export default function OrganogramView() {
  const { community, loading } = useCommunity()
  const [view, setView] = useState(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'cards' : 'graph')
  const [panelSelection, setPanelSelection] = useState(null)
  const [filter, setFilter] = useState(INITIAL_FILTER)
  const cardGridRef = useRef(null)
  const graphExportRef = useRef(null)

  if (loading) return <div style={{ color: 'var(--color-charcoal-light)' }}>Loading…</div>
  if (!community) return null

  const allRoleNames = [...new Set(
    community.workgroups.flatMap((wg) => wg.roles.map((r) => r.name))
  )].sort()

  async function exportPng() {
    if (!cardGridRef.current) return
    const canvas = await html2canvas(cardGridRef.current, { backgroundColor: '#F5F0E8', useCORS: true })
    const a = document.createElement('a')
    a.download = 'organogram.png'
    a.href = canvas.toDataURL()
    a.click()
  }

  const patch = (p) => setFilter((f) => ({ ...f, ...p }))

  function handleMemberClick(member) {
    setPanelSelection({ type: 'person', id: member.personId })
  }

  function handlePersonSelect(pid) {
    setPanelSelection({ type: 'person', id: pid })
  }

  function handleWorkgroupSelect(wgId) {
    setPanelSelection({ type: 'workgroup', id: wgId })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-sand-dark)', flexShrink: 0 }}>
          {['graph', 'cards'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '6px 14px', border: 'none', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: 500, fontFamily: 'Inter, sans-serif',
                background: view === v ? 'var(--color-terracotta)' : 'white',
                color: view === v ? 'white' : 'var(--color-charcoal-light)',
              }}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--color-sand-dark)', flexShrink: 0 }} />

        <select value={filter.workgroupId} onChange={(e) => patch({ workgroupId: e.target.value })} style={inputStyle}>
          <option value="">All workgroups</option>
          {community.workgroups.map((wg) => (
            <option key={wg.id} value={wg.id}>{wg.name}</option>
          ))}
        </select>

        <select value={filter.roleName} onChange={(e) => patch({ roleName: e.target.value })} style={inputStyle}>
          <option value="">All roles</option>
          {allRoleNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <input
          placeholder="Search by name…"
          value={filter.search}
          onChange={(e) => patch({ search: e.target.value })}
          style={{ ...inputStyle, width: 160 }}
        />

        <label style={checkStyle}>
          <input type="checkbox" checked={filter.showUnavailable} onChange={(e) => patch({ showUnavailable: e.target.checked })} />
          Show unavailable
        </label>
      </div>

      {/* Main content row: view + InfoPanel */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {view === 'cards' ? (
            <CardGrid community={community} filter={filter} onMemberClick={handleMemberClick} gridRef={cardGridRef} />
          ) : (
            <Suspense fallback={<div>Loading graph…</div>}>
              <GraphView
                style={{ flex: 1, minHeight: 0, height: '100%' }}
                communityId={community.id}
                filters={filter}
                refreshKey={community.workgroups.flatMap(wg => wg.roles.map(r => r.id + r.name + r.color)).join('|')}
                onFilterToWorkgroup={(wgId) => patch({ workgroupId: wgId })}
                onPersonSelect={handlePersonSelect}
                onWorkgroupSelect={handleWorkgroupSelect}
                exportRef={graphExportRef}
              />
            </Suspense>
          )}
        </div>
        <InfoPanel
          selection={panelSelection}
          onSelect={setPanelSelection}
          onFilterToWorkgroup={(wgId) => patch({ workgroupId: wgId })}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /home/serzhilin/Projects/CORE && npm --prefix app run build 2>&1 | tail -5
```
Expected: build may warn about unused imports — that's fine. No errors.

- [ ] **Step 3: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/OrganogramView.jsx
git commit -m "feat(panel): wire InfoPanel into OrganogramView layout"
```

---

### Task 3: Update GraphView — add onWorkgroupSelect, remove GraphSidePanel

**Files:**
- Modify: `app/src/views/graph/GraphView.jsx`

- [ ] **Step 1: Replace the file**

```jsx
import { useState, useEffect, useRef } from 'react'
import { getCommunityGraph } from '../../api/client'
import { useGraphData } from './useGraphData'
import { useForceSimulation } from './useForceSimulation'
import ForceGraph from './ForceGraph'

export default function GraphView({ communityId, filters, onFilterToWorkgroup, onPersonSelect, onWorkgroupSelect, refreshKey, exportRef, style }) {
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const svgRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    getCommunityGraph(communityId)
      .then(setGraphData)
      .finally(() => setLoading(false))
  }, [communityId, refreshKey])

  const { nodes, links } = useGraphData(graphData, filters)
  const { simNodes, simLinks, reheat, simRef, W, H } = useForceSimulation(nodes, links)

  useEffect(() => { reheat() }, [nodes, reheat])

  useEffect(() => {
    if (!exportRef) return
    exportRef.current = () => {
      if (!svgRef.current) return
      const serializer = new XMLSerializer()
      const svgStr = serializer.serializeToString(svgRef.current)
      const blob = new Blob([svgStr], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `organogram-${new Date().toISOString().slice(0, 10)}.svg`
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [exportRef])

  if (loading) return <div style={{ padding: 40, color: 'var(--color-charcoal-light)' }}>Loading graph…</div>
  if (!graphData) return null

  function handleSelect(node) {
    setSelected(node)
    if (!node) return
    if (node.type === 'person' && onPersonSelect) onPersonSelect(node.personId ?? node.id)
    if (node.type === 'workgroup' && onWorkgroupSelect) onWorkgroupSelect(node.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, ...style }}>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <ForceGraph
          simNodes={simNodes}
          simLinks={simLinks}
          filters={filters}
          selected={selected}
          onSelect={handleSelect}
          svgRef={svgRef}
          simRef={simRef}
          W={W}
          H={H}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /home/serzhilin/Projects/CORE && npm --prefix app run build 2>&1 | tail -5
```
Expected: `✓ built in ...ms`

- [ ] **Step 3: Manual smoke test**

Start dev server: `npm --prefix app run dev`

Verify:
1. Graph loads, nodes render, can pan/zoom
2. Click person node → InfoPanel opens with person profile
3. Click workgroup node → InfoPanel opens with workgroup view + member list
4. Click member name in workgroup view → person view with back button
5. Back button → returns to workgroup view
6. Tab strip toggles panel open/closed
7. Switch to Cards view → panel state preserved, cards push left when panel open
8. Click card person → InfoPanel opens with person profile

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/graph/GraphView.jsx
git commit -m "feat(panel): GraphView fires onPersonSelect/onWorkgroupSelect, removes GraphSidePanel"
```

---

### Task 4: Delete obsolete files

**Files:**
- Delete: `app/src/components/MemberSidePanel.jsx`
- Delete: `app/src/views/graph/GraphSidePanel.jsx`
- Delete: `app/src/views/graph/PersonPanel.jsx`
- Delete: `app/src/views/graph/WorkgroupPanel.jsx`

- [ ] **Step 1: Delete the files**

```bash
cd /home/serzhilin/Projects/CORE
rm app/src/components/MemberSidePanel.jsx
rm app/src/views/graph/GraphSidePanel.jsx
rm app/src/views/graph/PersonPanel.jsx
rm app/src/views/graph/WorkgroupPanel.jsx
```

- [ ] **Step 2: Verify build is still clean**

```bash
npm --prefix app run build 2>&1 | tail -5
```
Expected: `✓ built in ...ms`

- [ ] **Step 3: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add -A
git commit -m "chore: delete obsolete panel components replaced by InfoPanel"
```

---

## Done

Four tasks complete. One unified `InfoPanel` handles all detail views across both graph and cards. Old MemberSidePanel, GraphSidePanel, PersonPanel, WorkgroupPanel are gone.
