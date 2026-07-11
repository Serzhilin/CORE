import { useMemo } from 'react'

export function useGraphData(graphData, filters) {
  return useMemo(() => {
    if (!graphData) return { nodes: [], links: [] }

    const { workgroups, persons } = graphData

    let visiblePersons = persons
    if (!filters.showUnavailable) visiblePersons = visiblePersons.filter(p => !p.availability)
    if (filters.workgroupId) {
      visiblePersons = visiblePersons.filter(p =>
        p.memberships.some(m => m.workgroupId === filters.workgroupId)
      )
    }
    if (filters.roleName) {
      visiblePersons = visiblePersons.filter(p =>
        p.memberships.some(m => m.roles.some(r => r.name === filters.roleName))
      )
    }

    const visibleWorkgroups = filters.workgroupId
      ? workgroups.filter(wg => wg.id === filters.workgroupId)
      : workgroups

    const wgNodes = visibleWorkgroups.map(wg => ({
      id: `wg-${wg.id}`,
      type: 'workgroup',
      workgroupId: wg.id,
      name: wg.name,
      color: wg.color,
      r: 55,
    }))

    const personNodes = visiblePersons.map(p => {
      const activeMemberships = p.memberships.filter(m =>
        visibleWorkgroups.some(wg => wg.id === m.workgroupId)
      )
      const hasRole = activeMemberships.some(m => m.roles.length > 0)
      const colors = activeMemberships
        .map(m => visibleWorkgroups.find(wg => wg.id === m.workgroupId)?.color)
        .filter(Boolean)
      const roleColors = activeMemberships
        .flatMap(m => m.roles.map(r => r.color))
        .filter(Boolean)
      return {
        id: p.id,
        type: 'person',
        personId: p.id,
        name: [p.firstName, p.lastName].filter(Boolean).join(' '),
        isUnassigned: p.memberships.length === 0,
        hasRole,
        color: colors[0] ?? '#aaa',
        colors,
        roleColors,
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
  }, [graphData, filters])
}
