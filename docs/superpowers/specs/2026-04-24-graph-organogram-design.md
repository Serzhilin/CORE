# Interactive Organogram Graph — Design Spec
**Date:** 2026-04-24  
**Status:** Approved

---

## 1. Overview

Replace the current static radial organogram with an interactive force-directed graph showing the De Woonwolk community. The graph makes structural patterns visible: who's in multiple workgroups, who has no workgroup, who holds leadership roles, and who are aspirants. It is also the primary navigation surface into member detail.

---

## 2. Technology

- **D3 force simulation** drives layout physics; React renders SVG nodes declaratively on each tick.
- D3 handles: `forceLink`, `forceManyBody`, `forceCenter`, `forceCollide`, `forceRadial` (for cluster gravity).
- React state holds filtered/derived node+link data; D3 mutates `x/y` on tick; a `useRef` keeps the simulation outside React render cycles.
- No external graph library — D3 + React SVG gives full control over styling and interaction.

---

## 3. Graph Modes (toolbar toggle)

Two modes switchable at any time without page reload:

### By Person (default)
One node per person. People in multiple workgroups appear once, positioned at the gravitational intersection of their workgroups. Edges connect each person to every workgroup they belong to.

### By Workgroup
One node per workgroup membership. A person in 3 workgroups = 3 nodes, each inside their respective workgroup cluster. Nodes for the same person are linked by a dashed "same person" line. Clicking any clone highlights all clones and opens the shared side panel.

---

## 4. Node Types & Visual Language

| Node type | Shape | Size | Style |
|-----------|-------|------|-------|
| Workgroup | Circle | Large (r ≈ 28px) | Filled with workgroup colour, label centred |
| Person – has role | Circle | Medium-large (r ≈ 13px) | Solid fill, workgroup colour(s) |
| Person – regular member | Circle | Medium (r ≈ 10px) | Solid fill, workgroup colour |
| Person – aspirant | Circle | Medium (r ≈ 10px) | Dashed stroke outline, lighter fill |
| Person – unassigned | Circle | Small (r ≈ 8px) | Grey, no workgroup colour, floats near community centre |

Cross-members (By Person mode): half-half colour fill or dominant-colour fill with a coloured ring from the secondary workgroup.

---

## 5. Force Layout

- Each workgroup node is a fixed gravity attractor using `forceRadial` or a custom positioning force.
- Person nodes are attracted to their workgroup node(s) via `forceLink` with configurable strength.
- `forceManyBody` provides repulsion between all nodes to prevent overlap.
- `forceCollide` enforces minimum spacing.
- Unassigned persons are attracted toward the SVG centre (community node, if rendered) with weak force, so they cluster loosely in the middle.

---

## 6. Side Panel (on node click)

Rich panel slides in from the right; graph stays interactive on the left.

**Content:**
- Name (serif, bold) + system role badge (Admin/Member)
- Avatar placeholder (initials, gradient)
- Workgroups & roles: each workgroup as a coloured card (border-left in workgroup colour), role shown inside
- Availability status (● Available / ● Sick / etc.)

**Graph behaviour while panel is open:**
- Non-connected nodes dim to ~20% opacity
- Clicking a workgroup node: panel shows workgroup info + member list; graph dims to show only that cluster fully
- Click background or × to close panel; full opacity restored

**Workgroup node panel content:**
- Workgroup name and description
- Member list with roles
- Quick "filter to this workgroup" link

---

## 7. Toolbar (all 8 controls)

```
[ By person | By workgroup ]  |  [All workgroups ▾]  [All roles ▾]  |
[ ] Hide unavailable  [ ] Show aspirants  [ ] Show names  |
[🔍 Search person…]  [ ⟳ Reset ]  [ ↓ SVG ]
```

| Control | Behaviour |
|---------|-----------|
| View mode toggle | Switches between By Person / By Workgroup modes |
| Filter by workgroup | Dims/hides all nodes not in the selected workgroup |
| Filter by role | Highlights nodes where person holds the selected role |
| Hide unavailable | Removes sick/vacation persons from graph |
| Show/hide aspirants | Toggles aspirant nodes (dashed style) |
| Show/hide names | Toggles name labels under nodes; hover reveals name when hidden |
| Search / spotlight | Type name → matching node pulses and centres; others dim |
| Export SVG/PNG | Downloads current graph state |

All filter state lives in React; the D3 simulation receives filtered node/link arrays and re-heats on change.

---

## 8. Unassigned Members

Persons with no workgroup memberships float near the community centre. They are visually distinct (grey, smaller) and intentionally visible — an unassigned member signals "no active workgroup, may need onboarding or re-engagement." The Show/hide aspirants toggle does not affect unassigned non-aspirants.

---

## 9. API

A new endpoint `GET /community/:id/graph` returns:
```json
{
  "workgroups": [{ "id", "name", "color" }],
  "persons": [{
    "id", "firstName", "lastName", "isAspirant", "availability",
    "memberships": [{ "workgroupId", "roles": ["role name"] }]
  }]
}
```

This is a single fetch that gives the graph everything it needs. The existing `getCommunityFull` service can be extended or a dedicated graph query written.

---

## 10. Component Structure

```
GraphView.jsx              — top-level view, owns all state
  GraphToolbar.jsx         — toolbar, emits filter/mode changes
  ForceGraph.jsx           — SVG canvas, D3 simulation, node/link rendering
    WorkgroupNode.jsx      — large coloured workgroup circle
    PersonNode.jsx         — person dot with visual variant logic
    CloneLink.jsx          — dashed "same person" link (By Workgroup mode)
  GraphSidePanel.jsx       — sliding right panel
    PersonPanel.jsx        — person detail content
    WorkgroupPanel.jsx     — workgroup detail content
```

---

## 11. State Shape

```js
{
  mode: 'by-person' | 'by-workgroup',
  filters: { workgroupId, roleId, hideUnavailable, showAspirants, showNames, search },
  selected: { type: 'person'|'workgroup', id } | null,
  graphData: { nodes, links },          // raw from API
  simulationNodes: [...],               // D3-mutated copies with x/y
  simulationLinks: [...],
}
```

---

## 12. Out of Scope

- Drag-to-rearrange nodes (D3 drag could be added later)
- Real-time updates via WebSocket
- Editing community structure from within the graph
- Mobile-optimised layout (graph is desktop-first)
