# Interactive Organogram Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static radial organogram with an interactive D3 force-directed graph showing all community members clustered by workgroup, with a rich side panel, toolbar filters, two view modes (by person / by workgroup), and SVG export.

**Architecture:** D3 force simulation drives physics; React re-renders SVG nodes on each tick via a `useState` counter. All filter/selection state lives in `GraphView.jsx`. The API adds a single `/communities/:id/graph` endpoint returning a compact payload (workgroups + persons with memberships). The graph replaces the existing "Radial" tab inside `OrganogramView.jsx`.

**Tech Stack:** D3 v7 (`d3-force`, `d3-selection` for export), React 19, SVG. D3 is not yet installed.

---

## File Map

**Create:**
- `app/src/views/graph/GraphView.jsx` — state owner, fetches graph data, composes all subcomponents
- `app/src/views/graph/GraphToolbar.jsx` — all 8 toolbar controls
- `app/src/views/graph/useGraphData.js` — transforms raw API response → `{ nodes, links }` per mode
- `app/src/views/graph/useForceSimulation.js` — D3 simulation hook, returns `simulationNodes`, `simulationLinks`, `reheat`
- `app/src/views/graph/ForceGraph.jsx` — SVG canvas, renders nodes/links, emits click events
- `app/src/views/graph/WorkgroupNode.jsx` — large workgroup circle
- `app/src/views/graph/PersonNode.jsx` — person dot with aspirant/unassigned/role-holder variants
- `app/src/views/graph/CloneLink.jsx` — dashed "same person" link for by-workgroup mode
- `app/src/views/graph/GraphSidePanel.jsx` — sliding right panel container
- `app/src/views/graph/PersonPanel.jsx` — person detail content
- `app/src/views/graph/WorkgroupPanel.jsx` — workgroup detail content

**Modify:**
- `api/src/services/CommunityService.ts` — add `getCommunityGraph()`
- `api/src/controllers/CommunityController.ts` — add `getCommunityGraphHandler`
- `api/src/index.ts` — add route `GET /api/communities/:id/graph`
- `app/src/api/client.js` — add `getCommunityGraph(id)`
- `app/src/views/OrganogramView.jsx` — add "Graph" tab, lazy-load `GraphView`

---

## Task 1: Install D3 and scaffold directory

**Files:**
- Modify: `app/package.json`
- Create: `app/src/views/graph/` (directory)

- [ ] **Step 1: Install D3**

```bash
cd /home/serzhilin/Projects/CORE/app && npm install d3
```

Expected: D3 v7 added to `dependencies` in `package.json`.

- [ ] **Step 2: Create graph directory**

```bash
mkdir -p /home/serzhilin/Projects/CORE/app/src/views/graph
```

- [ ] **Step 3: Commit**

```bash
cd /home/serzhilin/Projects/CORE && git add app/package.json app/package-lock.json
git commit -m "chore: install d3 for force graph"
```

---

## Task 2: API — graph endpoint

**Files:**
- Modify: `api/src/services/CommunityService.ts`
- Modify: `api/src/controllers/CommunityController.ts`
- Modify: `api/src/index.ts`
- Modify: `app/src/api/client.js`

- [ ] **Step 1: Add `getCommunityGraph` to CommunityService.ts**

Append to `api/src/services/CommunityService.ts`:

```typescript
export async function getCommunityGraph(communityId: string) {
    const workgroups = await AppDataSource.getRepository(Workgroup).find({
        where: { community_id: communityId },
        order: { sort_order: "ASC" },
    });
    const wgIds = workgroups.map((w) => w.id);

    const roles = wgIds.length
        ? await AppDataSource.getRepository(Role).findBy({ workgroup_id: In(wgIds) })
        : [];

    const wgMemberships = wgIds.length
        ? await AppDataSource.getRepository(WorkgroupMembership).findBy({ workgroup_id: In(wgIds) })
        : [];
    const wgmIds = wgMemberships.map((m) => m.id);
    const wgMemberRoles = wgmIds.length
        ? await AppDataSource.getRepository(WorkgroupMemberRole).findBy({ workgroup_membership_id: In(wgmIds) })
        : [];

    const communityMemberships = await AppDataSource.getRepository(CommunityMembership).find({
        where: { community_id: communityId },
    });
    const personIds = communityMemberships.map((m) => m.person_id);
    const persons = personIds.length
        ? await AppDataSource.getRepository(Person).findBy({ id: In(personIds) })
        : [];

    const atIds = [...new Set(
        communityMemberships.map((m) => m.availability_type_id).filter((id): id is string => id !== null)
    )];
    const availabilityTypes = atIds.length
        ? await AppDataSource.getRepository(AvailabilityType).findBy({ id: In(atIds) })
        : [];
    const atMap = Object.fromEntries(availabilityTypes.map((t) => [t.id, t]));

    return {
        workgroups: workgroups.map((wg) => ({
            id: wg.id,
            name: wg.name,
            color: wg.color,
            description: wg.description,
        })),
        persons: communityMemberships.map((cm) => {
            const person = persons.find((p) => p.id === cm.person_id)!;
            const at = cm.availability_type_id ? atMap[cm.availability_type_id] : null;
            const myMemberships = wgMemberships.filter((wm) => wm.person_id === cm.person_id);
            return {
                id: cm.person_id,
                firstName: person?.first_name ?? null,
                lastName: person?.last_name ?? null,
                isAspirant: cm.is_aspirant,
                isAdmin: cm.is_admin,
                availability: at ? { name: at.name, emoji: at.emoji } : null,
                memberships: myMemberships.map((wm) => {
                    const myRoleIds = wgMemberRoles
                        .filter((r) => r.workgroup_membership_id === wm.id)
                        .map((r) => r.role_id);
                    const myRoleNames = roles
                        .filter((r) => myRoleIds.includes(r.id))
                        .map((r) => r.name);
                    return { workgroupId: wm.workgroup_id, roles: myRoleNames };
                }),
            };
        }),
    };
}
```

- [ ] **Step 2: Add handler to CommunityController.ts**

Add import at the top of `api/src/controllers/CommunityController.ts`:
```typescript
import { createCommunity, getMyCommunities, getCommunityFull, updateCommunity, getCommunityGraph } from "../services/CommunityService";
```

Append function:
```typescript
export async function getCommunityGraphHandler(req: Request, res: Response) {
    const data = await getCommunityGraph(req.params.id);
    res.json(data);
}
```

- [ ] **Step 3: Add route to api/src/index.ts**

Add import in the community controller import line:
```typescript
import { listCommunities, createCommunityHandler, getCommunityHandler, updateCommunityHandler, getCommunityGraphHandler } from "./controllers/CommunityController";
```

Add route after line 58 (`app.get("/api/communities/:id", ...)`):
```typescript
app.get("/api/communities/:id/graph", requireAuth, requireCommunityMember, getCommunityGraphHandler);
```

- [ ] **Step 4: Add client function to app/src/api/client.js**

Add after `getCommunity`:
```js
export const getCommunityGraph = (id) => req('GET', `/communities/${id}/graph`)
```

- [ ] **Step 5: Test the endpoint**

With the API running (`npm run dev` in `api/`), run:
```bash
# Get a valid token first, then:
curl -s -H "Authorization: Bearer <token>" http://localhost:3003/api/communities/<community-id>/graph | python3 -m json.tool | head -60
```

Expected: JSON with `workgroups` array and `persons` array, each person having `memberships` array.

- [ ] **Step 6: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/services/CommunityService.ts api/src/controllers/CommunityController.ts api/src/index.ts app/src/api/client.js
git commit -m "feat: add GET /communities/:id/graph endpoint"
```

---

## Task 3: GraphView shell + OrganogramView wiring

**Files:**
- Create: `app/src/views/graph/GraphView.jsx`
- Modify: `app/src/views/OrganogramView.jsx`

- [ ] **Step 1: Create GraphView.jsx shell**

Create `app/src/views/graph/GraphView.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { getCommunityGraph } from '../../api/client'

const INITIAL_FILTERS = {
  workgroupId: '',
  roleId: '',
  hideUnavailable: false,
  showAspirants: true,
  showNames: false,
  search: '',
}

export default function GraphView({ communityId }) {
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('by-person') // 'by-person' | 'by-workgroup'
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [selected, setSelected] = useState(null) // { type: 'person'|'workgroup', id }

  useEffect(() => {
    setLoading(true)
    getCommunityGraph(communityId)
      .then(setGraphData)
      .finally(() => setLoading(false))
  }, [communityId])

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS)
    setSelected(null)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--color-charcoal-light)' }}>Loading graph…</div>
  if (!graphData) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', minHeight: 500 }}>
      <div style={{ marginBottom: 8 }}>
        {/* GraphToolbar goes here — Task 4 */}
        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
          {graphData.workgroups.length} workgroups · {graphData.persons.length} members
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        {/* ForceGraph goes here — Task 7 */}
        <div style={{ padding: 20, color: '#888' }}>
          Graph canvas — coming in Task 7
          <pre style={{ fontSize: '0.7rem', marginTop: 8 }}>
            mode: {mode}{'\n'}
            selected: {JSON.stringify(selected)}
          </pre>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add "Graph" tab to OrganogramView.jsx**

In `app/src/views/OrganogramView.jsx`, add a lazy import at the top:

```jsx
const GraphView = lazy(() => import('./graph/GraphView'))
```

In the `useContext` line, also grab `communityId` — or just read it from `community.id`. Change the view state to include `'graph'`:

```jsx
const [view, setView] = useState('cards') // 'cards' | 'radial' | 'graph'
```

Add the Graph button next to the existing view toggle buttons (after the Radial button):
```jsx
<button
  className={view === 'graph' ? 'btn-primary' : 'btn-secondary'}
  onClick={() => setView('graph')} style={{ fontSize: '0.85rem' }}
>Graph</button>
```

Add a third branch in the render:
```jsx
{view === 'graph' ? (
  <Suspense fallback={<div>Loading graph…</div>}>
    <GraphView communityId={community.id} />
  </Suspense>
) : view === 'cards' ? (
  <CardGrid community={community} filter={filter} onMemberClick={setSelectedMember} />
) : (
  <Suspense fallback={<div>Loading radial view…</div>}>
    <RadialView community={community} filter={filter} onMemberClick={setSelectedMember} />
  </Suspense>
)}
```

- [ ] **Step 3: Verify it loads**

Start dev server (`npm run dev` in `app/`), navigate to Organogram, click "Graph" button.
Expected: "Graph canvas — coming in Task 7" placeholder text + workgroup/member counts visible.

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/graph/GraphView.jsx app/src/views/OrganogramView.jsx
git commit -m "feat: scaffold GraphView and wire into OrganogramView"
```

---

## Task 4: GraphToolbar component

**Files:**
- Create: `app/src/views/graph/GraphToolbar.jsx`
- Modify: `app/src/views/graph/GraphView.jsx`

- [ ] **Step 1: Create GraphToolbar.jsx**

Create `app/src/views/graph/GraphToolbar.jsx`:

```jsx
export default function GraphToolbar({ graphData, mode, filters, onModeChange, onFiltersChange, onReset, onExport }) {
  const allRoles = [...new Map(
    graphData.persons.flatMap(p => p.memberships.flatMap(m =>
      m.roles.map(r => [r, r])
    ))
  ).values()]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '8px 12px', background: '#faf7f2',
      borderRadius: 8, border: '1px solid #e5ddd0', fontSize: '0.82rem',
    }}>
      {/* View mode toggle */}
      <div style={{ display: 'flex', border: '1px solid #e5ddd0', borderRadius: 6, overflow: 'hidden' }}>
        <button
          onClick={() => onModeChange('by-person')}
          style={{
            padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
            background: mode === 'by-person' ? 'var(--color-terracotta)' : 'white',
            color: mode === 'by-person' ? 'white' : '#888',
          }}
        >By person</button>
        <button
          onClick={() => onModeChange('by-workgroup')}
          style={{
            padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
            background: mode === 'by-workgroup' ? 'var(--color-terracotta)' : 'white',
            color: mode === 'by-workgroup' ? 'white' : '#888',
          }}
        >By workgroup</button>
      </div>

      <div style={{ width: 1, height: 24, background: '#e5ddd0' }} />

      {/* Workgroup filter */}
      <select
        value={filters.workgroupId}
        onChange={e => onFiltersChange({ workgroupId: e.target.value })}
        style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #e5ddd0', fontSize: '0.78rem', background: 'white', color: '#555' }}
      >
        <option value="">All workgroups</option>
        {graphData.workgroups.map(wg => (
          <option key={wg.id} value={wg.id}>{wg.name}</option>
        ))}
      </select>

      {/* Role filter */}
      <select
        value={filters.roleId}
        onChange={e => onFiltersChange({ roleId: e.target.value })}
        style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #e5ddd0', fontSize: '0.78rem', background: 'white', color: '#555' }}
      >
        <option value="">All roles</option>
        {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      <div style={{ width: 1, height: 24, background: '#e5ddd0' }} />

      {/* Toggles */}
      {[
        ['hideUnavailable', 'Hide unavailable'],
        ['showAspirants', 'Show aspirants'],
        ['showNames', 'Show names'],
      ].map(([key, label]) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.75rem', color: '#555' }}>
          <input
            type="checkbox"
            checked={!!filters[key]}
            onChange={e => onFiltersChange({ [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}

      <div style={{ width: 1, height: 24, background: '#e5ddd0' }} />

      {/* Search */}
      <input
        placeholder="🔍 Search person…"
        value={filters.search}
        onChange={e => onFiltersChange({ search: e.target.value })}
        style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #e5ddd0', fontSize: '0.78rem', width: 140 }}
      />

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button onClick={onReset}
          style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #e5ddd0', fontSize: '0.75rem', background: 'white', cursor: 'pointer', color: '#555' }}>
          ⟳ Reset
        </button>
        <button onClick={onExport}
          style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #e5ddd0', fontSize: '0.75rem', background: 'white', cursor: 'pointer', color: '#555' }}>
          ↓ SVG
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire GraphToolbar into GraphView.jsx**

In `app/src/views/graph/GraphView.jsx`, add:
```jsx
import GraphToolbar from './GraphToolbar'
```

Replace the `{/* GraphToolbar goes here */}` placeholder with:
```jsx
<GraphToolbar
  graphData={graphData}
  mode={mode}
  filters={filters}
  onModeChange={setMode}
  onFiltersChange={(patch) => setFilters(f => ({ ...f, ...patch }))}
  onReset={resetFilters}
  onExport={() => {/* wired in Task 12 */}}
/>
```

- [ ] **Step 3: Verify toolbar renders**

Navigate to Graph view. Expected: full toolbar visible with all controls. Selecting workgroup or role dropdown shows real data names.

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/graph/GraphToolbar.jsx app/src/views/graph/GraphView.jsx
git commit -m "feat: add graph toolbar with all 8 controls"
```

---

## Task 5: useGraphData hook — data transformation

**Files:**
- Create: `app/src/views/graph/useGraphData.js`

This hook transforms the raw API response into `{ nodes, links }` for D3, applying the current mode and filters.

- [ ] **Step 1: Create useGraphData.js**

Create `app/src/views/graph/useGraphData.js`:

```js
import { useMemo } from 'react'

export function useGraphData(graphData, mode, filters) {
  return useMemo(() => {
    if (!graphData) return { nodes: [], links: [] }

    const { workgroups, persons } = graphData

    // Apply filters to persons
    let visiblePersons = persons
    if (filters.hideUnavailable) visiblePersons = visiblePersons.filter(p => !p.availability)
    if (!filters.showAspirants) visiblePersons = visiblePersons.filter(p => !p.isAspirant)
    if (filters.workgroupId) {
      visiblePersons = visiblePersons.filter(p =>
        p.memberships.some(m => m.workgroupId === filters.workgroupId)
      )
    }
    if (filters.roleId) {
      visiblePersons = visiblePersons.filter(p =>
        p.memberships.some(m => m.roles.includes(filters.roleId))
      )
    }

    const visiblePersonIds = new Set(visiblePersons.map(p => p.id))

    // Workgroup nodes (always present, filtered if workgroupId set)
    const visibleWorkgroups = filters.workgroupId
      ? workgroups.filter(wg => wg.id === filters.workgroupId)
      : workgroups

    const wgNodes = visibleWorkgroups.map(wg => ({
      id: `wg-${wg.id}`,
      type: 'workgroup',
      workgroupId: wg.id,
      name: wg.name,
      color: wg.color,
      r: 28,
    }))

    if (mode === 'by-person') {
      const personNodes = visiblePersons.map(p => {
        const wgs = p.memberships.filter(m =>
          visibleWorkgroups.some(wg => wg.id === m.workgroupId)
        )
        const hasRole = wgs.some(m => m.roles.length > 0)
        const primaryColor = wgs.length > 0
          ? (visibleWorkgroups.find(wg => wg.id === wgs[0].workgroupId)?.color ?? '#aaa')
          : '#aaa'
        return {
          id: p.id,
          type: 'person',
          personId: p.id,
          name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
          isAspirant: p.isAspirant,
          isUnassigned: p.memberships.length === 0,
          hasRole,
          color: primaryColor,
          colors: wgs.map(m => visibleWorkgroups.find(wg => wg.id === m.workgroupId)?.color).filter(Boolean),
          availability: p.availability,
          r: hasRole ? 13 : p.memberships.length === 0 ? 8 : 10,
        }
      })

      const links = []
      visiblePersons.forEach(p => {
        p.memberships.forEach(m => {
          if (visibleWorkgroups.some(wg => wg.id === m.workgroupId) && visiblePersonIds.has(p.id)) {
            links.push({
              id: `${p.id}-${m.workgroupId}`,
              source: p.id,
              target: `wg-${m.workgroupId}`,
              type: 'member',
            })
          }
        })
      })

      return { nodes: [...wgNodes, ...personNodes], links }
    }

    // by-workgroup: clone nodes
    const cloneNodes = []
    const cloneLinks = []
    const clonesByPerson = {}

    visiblePersons.forEach(p => {
      const myMemberships = p.memberships.filter(m =>
        visibleWorkgroups.some(wg => wg.id === m.workgroupId)
      )
      if (myMemberships.length === 0) {
        // unassigned: single grey node
        cloneNodes.push({
          id: p.id,
          type: 'person',
          personId: p.id,
          name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
          isAspirant: p.isAspirant,
          isUnassigned: true,
          hasRole: false,
          color: '#aaa',
          colors: [],
          availability: p.availability,
          r: 8,
        })
        return
      }

      clonesByPerson[p.id] = []
      myMemberships.forEach(m => {
        const wg = visibleWorkgroups.find(wg => wg.id === m.workgroupId)
        const hasRole = m.roles.length > 0
        const nodeId = `clone-${p.id}-${m.workgroupId}`
        cloneNodes.push({
          id: nodeId,
          type: 'person',
          personId: p.id,
          workgroupId: m.workgroupId,
          name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
          isAspirant: p.isAspirant,
          isUnassigned: false,
          hasRole,
          color: wg?.color ?? '#aaa',
          colors: [wg?.color ?? '#aaa'],
          availability: p.availability,
          r: hasRole ? 13 : 10,
        })
        clonesByPerson[p.id].push(nodeId)
        cloneLinks.push({
          id: `${nodeId}-wg`,
          source: nodeId,
          target: `wg-${m.workgroupId}`,
          type: 'member',
        })
      })

      // "same person" links between clones
      const ids = clonesByPerson[p.id]
      for (let i = 0; i < ids.length - 1; i++) {
        cloneLinks.push({
          id: `same-${p.id}-${i}`,
          source: ids[i],
          target: ids[i + 1],
          type: 'same-person',
          personId: p.id,
        })
      }
    })

    return { nodes: [...wgNodes, ...cloneNodes], links: cloneLinks }
  }, [graphData, mode, filters])
}
```

- [ ] **Step 2: Import and use in GraphView.jsx**

In `app/src/views/graph/GraphView.jsx` add:
```jsx
import { useGraphData } from './useGraphData'
```

Inside the component body, after state declarations:
```jsx
const { nodes, links } = useGraphData(graphData, mode, filters)
```

Add to the debug output for verification:
```jsx
<pre style={{ fontSize: '0.7rem', marginTop: 8 }}>
  nodes: {nodes.length} | links: {links.length}
</pre>
```

- [ ] **Step 3: Verify node/link counts**

In Graph view with De Woonwolk loaded, expected with default filters:
- `by-person` mode: ~10 workgroup nodes + ~52 person nodes + many links
- Switch to `by-workgroup`: node count increases (clones for cross-members)

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/graph/useGraphData.js app/src/views/graph/GraphView.jsx
git commit -m "feat: add useGraphData hook for node/link transformation"
```

---

## Task 6: useForceSimulation hook

**Files:**
- Create: `app/src/views/graph/useForceSimulation.js`

- [ ] **Step 1: Create useForceSimulation.js**

Create `app/src/views/graph/useForceSimulation.js`:

```js
import { useRef, useState, useEffect, useCallback } from 'react'
import * as d3 from 'd3'

const W = 900
const H = 700
const CX = W / 2
const CY = H / 2
const R_ORBIT = 260 // radius of workgroup orbit

function getWorkgroupPositions(workgroupNodes) {
  const n = workgroupNodes.length
  return workgroupNodes.map((wg, i) => {
    const angle = (2 * Math.PI / n) * i - Math.PI / 2
    return { id: wg.id, fx: CX + R_ORBIT * Math.cos(angle), fy: CY + R_ORBIT * Math.sin(angle) }
  })
}

export function useForceSimulation(nodes, links) {
  const simRef = useRef(null)
  const [tick, setTick] = useState(0)

  const reheat = useCallback(() => {
    if (simRef.current) simRef.current.alpha(0.5).restart()
  }, [])

  useEffect(() => {
    if (!nodes.length) return

    // Deep-copy nodes so D3 can mutate x/y without touching React state
    const simNodes = nodes.map(n => ({ ...n }))
    const simLinks = links.map(l => ({ ...l }))

    // Fix workgroup nodes on an orbit circle
    const wgPositions = getWorkgroupPositions(simNodes.filter(n => n.type === 'workgroup'))
    const wgPosMap = Object.fromEntries(wgPositions.map(p => [p.id, p]))
    simNodes.forEach(n => {
      if (n.type === 'workgroup') {
        const pos = wgPosMap[n.id]
        if (pos) { n.fx = pos.fx; n.fy = pos.fy; n.x = pos.fx; n.y = pos.fy }
      }
    })

    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks)
        .id(d => d.id)
        .distance(d => d.type === 'same-person' ? 50 : 80)
        .strength(d => d.type === 'same-person' ? 0.3 : 0.6)
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('collide', d3.forceCollide(d => (d.r ?? 10) + 6))
      .force('center', d3.forceCenter(CX, CY).strength(0.02))
      .on('tick', () => setTick(t => t + 1))
      .on('end', () => setTick(t => t + 1))

    simRef.current = sim
    simRef.current._nodes = simNodes
    simRef.current._links = simLinks

    return () => sim.stop()
  }, [nodes, links])

  const simNodes = simRef.current?._nodes ?? []
  const simLinks = simRef.current?._links ?? []

  return { simNodes, simLinks, reheat, W, H }
}
```

- [ ] **Step 2: Import in GraphView.jsx and pass through**

In `GraphView.jsx`:
```jsx
import { useForceSimulation } from './useForceSimulation'
```

After `useGraphData`:
```jsx
const { simNodes, simLinks, reheat, W, H } = useForceSimulation(nodes, links)
```

Add to the debug output:
```jsx
<pre style={{ fontSize: '0.7rem', marginTop: 8 }}>
  sim nodes with position: {simNodes.filter(n => n.x).length}/{simNodes.length}
</pre>
```

- [ ] **Step 3: Verify simulation runs**

After loading Graph view, wait ~2 seconds. The positioned node count should equal the total node count as the simulation settles.

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/graph/useForceSimulation.js app/src/views/graph/GraphView.jsx
git commit -m "feat: add D3 force simulation hook"
```

---

## Task 7: ForceGraph SVG canvas, WorkgroupNode, PersonNode, CloneLink

**Files:**
- Create: `app/src/views/graph/ForceGraph.jsx`
- Create: `app/src/views/graph/WorkgroupNode.jsx`
- Create: `app/src/views/graph/PersonNode.jsx`
- Create: `app/src/views/graph/CloneLink.jsx`
- Modify: `app/src/views/graph/GraphView.jsx`

- [ ] **Step 1: Create WorkgroupNode.jsx**

Create `app/src/views/graph/WorkgroupNode.jsx`:

```jsx
export default function WorkgroupNode({ node, dimmed, selected, onClick }) {
  const opacity = dimmed ? 0.15 : 1
  return (
    <g
      transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
      style={{ cursor: 'pointer' }}
      onClick={() => onClick(node)}
    >
      <circle
        r={node.r}
        fill={node.color}
        fillOpacity={0.18}
        stroke={node.color}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray="5,3"
        opacity={opacity}
      />
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={9}
        fontWeight={700}
        fill={node.color}
        opacity={opacity}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {node.name.length > 12 ? node.name.slice(0, 11) + '…' : node.name}
      </text>
    </g>
  )
}
```

- [ ] **Step 2: Create PersonNode.jsx**

Create `app/src/views/graph/PersonNode.jsx`:

```jsx
export default function PersonNode({ node, dimmed, selected, showName, onClick }) {
  const opacity = dimmed ? 0.12 : 1
  const x = node.x ?? 0
  const y = node.y ?? 0
  const r = node.r ?? 10
  const isMulti = node.colors && node.colors.length >= 2

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: 'pointer' }}
      onClick={() => onClick(node)}
    >
      {/* Base circle */}
      <circle
        r={r}
        fill={node.isUnassigned ? '#ccc' : node.color}
        fillOpacity={node.isAspirant ? 0.35 : 0.85}
        stroke={node.isUnassigned ? '#aaa' : (node.isAspirant ? node.color : 'white')}
        strokeWidth={node.isAspirant ? 2 : 1.5}
        strokeDasharray={node.isAspirant ? '3,2' : 'none'}
        opacity={opacity}
      />
      {/* Second colour ring for cross-members */}
      {isMulti && (
        <circle
          r={r + 3}
          fill="none"
          stroke={node.colors[1]}
          strokeWidth={2}
          opacity={opacity * 0.7}
        />
      )}
      {/* Selection ring */}
      {selected && (
        <circle r={r + 5} fill="none" stroke={node.color} strokeWidth={2} opacity={0.5} />
      )}
      {/* Name label */}
      {showName && (
        <text
          y={r + 11}
          textAnchor="middle"
          fontSize={7}
          fill="#555"
          opacity={opacity}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {node.name}
        </text>
      )}
    </g>
  )
}
```

- [ ] **Step 3: Create CloneLink.jsx**

Create `app/src/views/graph/CloneLink.jsx`:

```jsx
export default function CloneLink({ link, simNodes }) {
  const source = simNodes.find(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source))
  const target = simNodes.find(n => n.id === (typeof link.target === 'object' ? link.target.id : link.target))
  if (!source?.x || !target?.x) return null
  return (
    <line
      x1={source.x} y1={source.y}
      x2={target.x} y2={target.y}
      stroke="#bbb"
      strokeWidth={1}
      strokeDasharray="4,3"
      opacity={0.6}
    />
  )
}
```

- [ ] **Step 4: Create ForceGraph.jsx**

Create `app/src/views/graph/ForceGraph.jsx`:

```jsx
import WorkgroupNode from './WorkgroupNode'
import PersonNode from './PersonNode'
import CloneLink from './CloneLink'

export default function ForceGraph({ simNodes, simLinks, filters, selected, mode, onSelect, svgRef, W, H }) {
  // Compute which nodes are highlighted (dimming logic)
  const highlightedIds = getHighlightedIds(selected, simNodes, simLinks)

  return (
    <svg
      ref={svgRef}
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ background: '#faf7f2', borderRadius: 8, border: '1px solid #e5ddd0', display: 'block' }}
      onClick={(e) => { if (e.target === e.currentTarget) onSelect(null) }}
    >
      {/* Links */}
      <g>
        {simLinks.map(link => {
          if (link.type === 'same-person') return <CloneLink key={link.id} link={link} simNodes={simNodes} />
          const src = simNodes.find(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source))
          const tgt = simNodes.find(n => n.id === (typeof link.target === 'object' ? link.target.id : link.target))
          if (!src?.x || !tgt?.x) return null
          return (
            <line
              key={link.id}
              x1={src.x} y1={src.y}
              x2={tgt.x} y2={tgt.y}
              stroke={src.color ?? '#ddd'}
              strokeWidth={1}
              opacity={highlightedIds && !highlightedIds.has(link.id) ? 0.08 : 0.4}
            />
          )
        })}
      </g>
      {/* Workgroup nodes (behind persons) */}
      <g>
        {simNodes.filter(n => n.type === 'workgroup').map(node => (
          <WorkgroupNode
            key={node.id}
            node={node}
            dimmed={highlightedIds ? !highlightedIds.has(node.id) : false}
            selected={selected?.id === node.workgroupId && selected?.type === 'workgroup'}
            onClick={() => onSelect({ type: 'workgroup', id: node.workgroupId })}
          />
        ))}
      </g>
      {/* Person nodes */}
      <g>
        {simNodes.filter(n => n.type === 'person').map(node => {
          const spotlight = filters.search
            ? node.name.toLowerCase().includes(filters.search.toLowerCase())
            : null
          return (
            <PersonNode
              key={node.id}
              node={node}
              dimmed={
                (highlightedIds ? !highlightedIds.has(node.id) : false) ||
                (spotlight === false)
              }
              selected={
                selected?.type === 'person' && (
                  node.personId === selected.id || node.id === selected.id
                )
              }
              showName={filters.showNames || spotlight === true}
              onClick={() => onSelect({ type: 'person', id: node.personId ?? node.id })}
            />
          )
        })}
      </g>
    </svg>
  )
}

function getHighlightedIds(selected, nodes, links) {
  if (!selected) return null
  const highlighted = new Set()

  if (selected.type === 'person') {
    // Highlight selected person (all their clones) + their workgroups
    nodes.forEach(n => {
      if (n.type === 'person' && (n.personId === selected.id || n.id === selected.id)) highlighted.add(n.id)
      if (n.type === 'workgroup') {
        const connected = links.some(l => {
          const src = typeof l.source === 'object' ? l.source.id : l.source
          const tgt = typeof l.target === 'object' ? l.target.id : l.target
          const personNode = nodes.find(nd => nd.personId === selected.id || nd.id === selected.id)
          return personNode && (src === personNode.id || tgt === personNode.id) && (src === n.id || tgt === n.id)
        })
        if (connected) highlighted.add(n.id)
      }
    })
    // Also highlight all clones
    nodes.filter(n => n.personId === selected.id).forEach(n => highlighted.add(n.id))
    // Highlight links too
    links.forEach(l => {
      const src = typeof l.source === 'object' ? l.source.id : l.source
      const tgt = typeof l.target === 'object' ? l.target.id : l.target
      if (highlighted.has(src) || highlighted.has(tgt)) highlighted.add(l.id)
    })
  }

  if (selected.type === 'workgroup') {
    const wgNode = nodes.find(n => n.type === 'workgroup' && n.workgroupId === selected.id)
    if (wgNode) {
      highlighted.add(wgNode.id)
      links.forEach(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source
        const tgt = typeof l.target === 'object' ? l.target.id : l.target
        if (src === wgNode.id || tgt === wgNode.id) {
          highlighted.add(src)
          highlighted.add(tgt)
          highlighted.add(l.id)
        }
      })
    }
  }

  return highlighted
}
```

- [ ] **Step 5: Wire ForceGraph into GraphView.jsx**

In `app/src/views/graph/GraphView.jsx`:
```jsx
import { useRef } from 'react'
import ForceGraph from './ForceGraph'
```

Add `svgRef`:
```jsx
const svgRef = useRef(null)
```

Replace the placeholder div with:
```jsx
<ForceGraph
  simNodes={simNodes}
  simLinks={simLinks}
  filters={filters}
  selected={selected}
  mode={mode}
  onSelect={setSelected}
  svgRef={svgRef}
  W={W}
  H={H}
/>
```

- [ ] **Step 6: Verify graph renders**

Navigate to Graph view. Expected:
- Workgroup circles visible on a ring around the centre
- Person dots clustered near their workgroup(s)
- Cross-members visible between groups
- Unassigned persons near centre in grey
- Clicking a person dims others
- Clicking a workgroup dims to show only its cluster
- Clicking background clears selection

- [ ] **Step 7: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/graph/ForceGraph.jsx app/src/views/graph/WorkgroupNode.jsx app/src/views/graph/PersonNode.jsx app/src/views/graph/CloneLink.jsx app/src/views/graph/GraphView.jsx
git commit -m "feat: render force graph with workgroup/person nodes and dimming"
```

---

## Task 8: GraphSidePanel, PersonPanel, WorkgroupPanel

**Files:**
- Create: `app/src/views/graph/GraphSidePanel.jsx`
- Create: `app/src/views/graph/PersonPanel.jsx`
- Create: `app/src/views/graph/WorkgroupPanel.jsx`
- Modify: `app/src/views/graph/GraphView.jsx`

- [ ] **Step 1: Create PersonPanel.jsx**

Create `app/src/views/graph/PersonPanel.jsx`:

```jsx
export default function PersonPanel({ person, graphData, onClose }) {
  const initials = [person.firstName?.[0], person.lastName?.[0]].filter(Boolean).join('')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-title)' }}>
            {person.firstName} {person.lastName}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            {person.isAdmin && (
              <span style={{ fontSize: '0.68rem', background: '#f0ece4', borderRadius: 3, padding: '1px 5px' }}>Admin</span>
            )}
            {person.isAspirant && (
              <span style={{ fontSize: '0.68rem', background: '#fef3c7', borderRadius: 3, padding: '1px 5px', color: '#92400e' }}>Aspirant</span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '1.1rem' }}>×</button>
      </div>

      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--color-terracotta), #2563EB)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 700, fontSize: '1rem',
      }}>{initials}</div>

      {/* Workgroups & roles */}
      <div style={{ borderTop: '1px solid #f0ece4', paddingTop: 8 }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#aaa', marginBottom: 6 }}>
          Workgroups & roles
        </div>
        {person.memberships.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: '#aaa', fontStyle: 'italic' }}>No workgroup</div>
        ) : person.memberships.map(m => {
          const wg = graphData.workgroups.find(w => w.id === m.workgroupId)
          if (!wg) return null
          return (
            <div key={m.workgroupId} style={{
              background: `${wg.color}11`, borderLeft: `3px solid ${wg.color}`,
              borderRadius: '0 4px 4px 0', padding: '5px 8px', marginBottom: 4,
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{wg.name}</div>
              <div style={{ fontSize: '0.7rem', color: m.roles.length ? wg.color : '#aaa', marginTop: 2 }}>
                {m.roles.length ? m.roles.join(', ') : 'no role'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Availability */}
      <div style={{ borderTop: '1px solid #f0ece4', paddingTop: 6 }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#aaa', marginBottom: 4 }}>
          Status
        </div>
        {person.availability ? (
          <div style={{ fontSize: '0.78rem', color: '#b45309' }}>
            {person.availability.emoji} {person.availability.name}
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: '#16a34a' }}>● Available</div>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f0ece4' }}>
        <div style={{ fontSize: '0.72rem', color: '#bbb', textAlign: 'center' }}>click graph to close</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create WorkgroupPanel.jsx**

Create `app/src/views/graph/WorkgroupPanel.jsx`:

```jsx
export default function WorkgroupPanel({ workgroup, graphData, onClose, onFilterToWorkgroup }) {
  const members = graphData.persons.filter(p =>
    p.memberships.some(m => m.workgroupId === workgroup.id)
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-title)' }}>{workgroup.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4 }}>{members.length} members</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '1.1rem' }}>×</button>
      </div>

      {workgroup.description && (
        <div style={{ fontSize: '0.78rem', color: '#666' }}>{workgroup.description}</div>
      )}

      {/* Members */}
      <div style={{ borderTop: '1px solid #f0ece4', paddingTop: 8, flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#aaa', marginBottom: 6 }}>
          Members
        </div>
        {members.map(p => {
          const m = p.memberships.find(m => m.workgroupId === workgroup.id)
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: workgroup.color, flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '0.78rem' }}>{p.firstName} {p.lastName}</span>
                {m?.roles.length > 0 && (
                  <span style={{ fontSize: '0.68rem', color: workgroup.color, marginLeft: 5 }}>· {m.roles.join(', ')}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ paddingTop: 6, borderTop: '1px solid #f0ece4' }}>
        <button
          onClick={() => onFilterToWorkgroup(workgroup.id)}
          style={{ fontSize: '0.75rem', color: workgroup.color, background: 'none', border: `1px solid ${workgroup.color}`, borderRadius: 5, padding: '4px 8px', cursor: 'pointer' }}
        >
          Filter to this workgroup
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create GraphSidePanel.jsx**

Create `app/src/views/graph/GraphSidePanel.jsx`:

```jsx
import PersonPanel from './PersonPanel'
import WorkgroupPanel from './WorkgroupPanel'

export default function GraphSidePanel({ selected, graphData, onClose, onFilterToWorkgroup }) {
  const visible = !!selected
  const person = selected?.type === 'person'
    ? graphData.persons.find(p => p.id === selected.id) : null
  const workgroup = selected?.type === 'workgroup'
    ? graphData.workgroups.find(wg => wg.id === selected.id) : null

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: 220,
      background: 'white',
      borderLeft: `3px solid ${person ? (person.memberships[0] ? graphData.workgroups.find(wg => wg.id === person.memberships[0].workgroupId)?.color ?? '#ccc' : '#ccc') : (workgroup?.color ?? '#ccc')}`,
      padding: '14px 12px',
      boxShadow: '-4px 0 12px rgba(0,0,0,0.06)',
      transform: visible ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.2s ease',
      overflowY: 'auto',
      zIndex: 10,
    }}>
      {person && (
        <PersonPanel person={person} graphData={graphData} onClose={onClose} />
      )}
      {workgroup && (
        <WorkgroupPanel workgroup={workgroup} graphData={graphData} onClose={onClose} onFilterToWorkgroup={onFilterToWorkgroup} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire GraphSidePanel into GraphView.jsx**

In `app/src/views/graph/GraphView.jsx`:
```jsx
import GraphSidePanel from './GraphSidePanel'
```

Wrap the graph canvas area with a `position: relative` div and add the panel:
```jsx
<div style={{ flex: 1, position: 'relative' }}>
  <ForceGraph
    simNodes={simNodes}
    simLinks={simLinks}
    filters={filters}
    selected={selected}
    mode={mode}
    onSelect={setSelected}
    svgRef={svgRef}
    W={W}
    H={H}
  />
  <GraphSidePanel
    selected={selected}
    graphData={graphData}
    onClose={() => setSelected(null)}
    onFilterToWorkgroup={(wgId) => setFilters(f => ({ ...f, workgroupId: wgId }))}
  />
</div>
```

- [ ] **Step 5: Verify side panel**

Click a person node. Expected: panel slides in from right showing name, avatar initials, workgroup cards with roles, and availability status. Click × or background: panel slides out.

Click a workgroup node. Expected: panel shows workgroup name + member list.

- [ ] **Step 6: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/graph/GraphSidePanel.jsx app/src/views/graph/PersonPanel.jsx app/src/views/graph/WorkgroupPanel.jsx app/src/views/graph/GraphView.jsx
git commit -m "feat: add sliding side panel for person and workgroup detail"
```

---

## Task 9: By-workgroup mode and toolbar mode switching

**Files:**
- Modify: `app/src/views/graph/GraphView.jsx`
- Modify: `app/src/views/graph/useForceSimulation.js`

The `useGraphData` hook already produces clone nodes for `by-workgroup` mode (Task 5). The simulation needs to reheat when mode changes so the new node layout settles.

- [ ] **Step 1: Reheat simulation on mode or filter change**

In `app/src/views/graph/GraphView.jsx`, add a `useEffect` that reheats the simulation whenever `nodes` changes:

```jsx
import { useRef, useEffect } from 'react'
```

```jsx
useEffect(() => {
  reheat()
}, [nodes, reheat])
```

- [ ] **Step 2: Verify mode switch**

Toggle "By person" / "By workgroup" in the toolbar. Expected:
- In by-workgroup: nodes re-animate, cross-members have dashed clone links visible
- In by-person: single node per person, no clone links

- [ ] **Step 3: Verify filter wiring**

Select a workgroup in the dropdown. Expected: nodes not in that workgroup fade out or disappear. Clear filter: all nodes return.

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/graph/GraphView.jsx
git commit -m "feat: reheat simulation on mode/filter change"
```

---

## Task 10: Search spotlight

**Files:**
- Modify: `app/src/views/graph/ForceGraph.jsx`

The `filters.search` string is already threaded into `ForceGraph` and `PersonNode` uses `spotlight` to drive `dimmed` and `showName`. This task adds the centering animation.

- [ ] **Step 1: Add search centering to ForceGraph.jsx**

In `ForceGraph.jsx`, import `useEffect`:
```jsx
import { useEffect } from 'react'
```

Add inside the component, after the SVG JSX:
```jsx
// Centre + pulse on search match
useEffect(() => {
  if (!filters.search || !svgRef.current) return
  const match = simNodes.find(n =>
    n.type === 'person' && n.name.toLowerCase().includes(filters.search.toLowerCase())
  )
  // Highlight is already handled by dimmed/showName in PersonNode
  // (centering via viewBox pan is a future enhancement — current: nodes dim + name shown)
}, [filters.search, simNodes, svgRef])
```

- [ ] **Step 2: Verify search**

Type "Robin" in the search box. Expected: all nodes except Robin's dim, Robin's name label appears.

- [ ] **Step 3: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/graph/ForceGraph.jsx
git commit -m "feat: search spotlight dims non-matching nodes"
```

---

## Task 11: SVG Export

**Files:**
- Modify: `app/src/views/graph/GraphView.jsx`

- [ ] **Step 1: Add export function to GraphView.jsx**

In `GraphView.jsx`, add an `exportSvg` function and wire it to the toolbar's `onExport`:

```jsx
const exportSvg = () => {
  if (!svgRef.current) return
  const svg = svgRef.current
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svg)
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `organogram-${new Date().toISOString().slice(0, 10)}.svg`
  a.click()
  URL.revokeObjectURL(url)
}
```

In the toolbar `onExport` prop, replace the placeholder:
```jsx
onExport={exportSvg}
```

- [ ] **Step 2: Verify export**

Click "↓ SVG". Expected: a file named `organogram-2026-04-24.svg` downloads and opens correctly in a browser or vector editor.

- [ ] **Step 3: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/graph/GraphView.jsx
git commit -m "feat: SVG export from organogram graph"
```

---

## Task 12: Polish — node colours for existing workgroups

**Files:**
- Database (SQL)

Currently all 6 new workgroups have the default terracotta colour. Set distinct colours so the graph clusters are visually distinguishable.

- [ ] **Step 1: Assign distinct workgroup colours**

```bash
docker exec -i core-postgres psql -U core -d core << 'SQL'
UPDATE workgroups SET color = '#C4622D' WHERE name = 'Coordinatiecomissie';
UPDATE workgroups SET color = '#2563EB' WHERE name = 'Architectuurcomissie';
UPDATE workgroups SET color = '#16a34a' WHERE name = 'Toelatingscomissie';
UPDATE workgroups SET color = '#7c3aed' WHERE name = 'Board';
UPDATE workgroups SET color = '#db2777' WHERE name = 'Financiëncomité';
UPDATE workgroups SET color = '#0891b2' WHERE name = 'Tuin & Buitenruimte';
UPDATE workgroups SET color = '#65a30d' WHERE name = 'Gemeenschappelijke Ruimtes';
UPDATE workgroups SET color = '#ea580c' WHERE name = 'Duurzaamheid & Energie';
UPDATE workgroups SET color = '#0d9488' WHERE name = 'Communicatie & PR';
UPDATE workgroups SET color = '#854d0e' WHERE name = 'Onderhoud & Beheer';
SQL
```

- [ ] **Step 2: Verify in graph**

Reload graph. Expected: each workgroup cluster has a distinct colour; cross-members show multiple colour rings.

- [ ] **Step 3: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git commit --allow-empty -m "chore: assign distinct colours to workgroups (applied via SQL)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Force-directed D3 layout (Tasks 6–7)
- ✅ By person / By workgroup toggle (Tasks 5, 9)
- ✅ All 8 toolbar controls (Task 4)
- ✅ Rich side panel with dimming (Tasks 7, 8)
- ✅ Workgroup click → panel + cluster dim (Task 7)
- ✅ Unassigned members near centre (Task 5 — `isUnassigned` + center force)
- ✅ Role-holders bigger circles (Task 5 — r=13 vs r=10)
- ✅ Aspirants dashed outline (Task 7 PersonNode)
- ✅ API graph endpoint (Task 2)
- ✅ SVG export (Task 11)
- ✅ Workgroup colours (Task 12)

**Type consistency check:**
- `node.personId` used in ForceGraph → set in useGraphData ✅
- `node.workgroupId` used in WorkgroupNode → set in useGraphData ✅
- `link.type === 'same-person'` checked in ForceGraph → set in useGraphData ✅
- `graphData.workgroups` / `graphData.persons` shape used in panels → matches API response ✅
- `simRef.current._nodes` / `._links` accessed in hook → set in useEffect ✅
