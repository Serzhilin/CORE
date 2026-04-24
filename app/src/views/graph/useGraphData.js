import { useMemo } from 'react'

export function useGraphData(graphData, mode, filters) {
  return useMemo(() => {
    if (!graphData) return { nodes: [], links: [] }

    const { workgroups, persons } = graphData

    // Apply person filters
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

    // Visible workgroups
    const visibleWorkgroups = filters.workgroupId
      ? workgroups.filter(wg => wg.id === filters.workgroupId)
      : workgroups

    // Workgroup nodes (always present)
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
        const activeMemberships = p.memberships.filter(m =>
          visibleWorkgroups.some(wg => wg.id === m.workgroupId)
        )
        const hasRole = activeMemberships.some(m => m.roles.length > 0)
        const colors = activeMemberships
          .map(m => visibleWorkgroups.find(wg => wg.id === m.workgroupId)?.color)
          .filter(Boolean)
        return {
          id: p.id,
          type: 'person',
          personId: p.id,
          name: [p.firstName, p.lastName].filter(Boolean).join(' '),
          isAspirant: p.isAspirant,
          isUnassigned: p.memberships.length === 0,
          hasRole,
          color: colors[0] ?? '#aaa',
          colors,
          availability: p.availability,
          r: hasRole ? 13 : p.memberships.length === 0 ? 8 : 10,
        }
      })

      const links = []
      visiblePersons.forEach(p => {
        p.memberships.forEach(m => {
          if (visibleWorkgroups.some(wg => wg.id === m.workgroupId)) {
            links.push({
              id: `link-${p.id}-${m.workgroupId}`,
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

    visiblePersons.forEach(p => {
      const activeMemberships = p.memberships.filter(m =>
        visibleWorkgroups.some(wg => wg.id === m.workgroupId)
      )

      if (activeMemberships.length === 0) {
        // Unassigned: single grey node
        cloneNodes.push({
          id: p.id,
          type: 'person',
          personId: p.id,
          name: [p.firstName, p.lastName].filter(Boolean).join(' '),
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

      const cloneIds = []
      activeMemberships.forEach(m => {
        const wg = visibleWorkgroups.find(wg => wg.id === m.workgroupId)
        const nodeId = `clone-${p.id}-${m.workgroupId}`
        cloneIds.push(nodeId)
        cloneNodes.push({
          id: nodeId,
          type: 'person',
          personId: p.id,
          workgroupId: m.workgroupId,
          name: [p.firstName, p.lastName].filter(Boolean).join(' '),
          isAspirant: p.isAspirant,
          isUnassigned: false,
          hasRole: m.roles.length > 0,
          color: wg?.color ?? '#aaa',
          colors: [wg?.color ?? '#aaa'],
          availability: p.availability,
          r: m.roles.length > 0 ? 13 : 10,
        })
        cloneLinks.push({
          id: `link-${nodeId}-wg`,
          source: nodeId,
          target: `wg-${m.workgroupId}`,
          type: 'member',
        })
      })

      // "same person" links between consecutive clones
      for (let i = 0; i < cloneIds.length - 1; i++) {
        cloneLinks.push({
          id: `same-${p.id}-${i}`,
          source: cloneIds[i],
          target: cloneIds[i + 1],
          type: 'same-person',
          personId: p.id,
        })
      }
    })

    return { nodes: [...wgNodes, ...cloneNodes], links: cloneLinks }
  }, [graphData, mode, filters])
}
