import WorkgroupNode from './WorkgroupNode'
import PersonNode from './PersonNode'
import CloneLink from './CloneLink'

function getHighlightedIds(selected, nodes, links) {
  if (!selected) return null
  const highlighted = new Set()

  if (selected.type === 'person') {
    // All clones of this person
    nodes.forEach(n => {
      if (n.type === 'person' && (n.personId === selected.id || n.id === selected.id)) {
        highlighted.add(n.id)
      }
    })
    // Their workgroup nodes (via links)
    links.forEach(l => {
      if (l.type !== 'member') return
      const srcId = typeof l.source === 'object' ? l.source.id : l.source
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target
      if (highlighted.has(srcId)) highlighted.add(tgtId)
      if (highlighted.has(tgtId)) highlighted.add(srcId)
    })
  }

  if (selected.type === 'workgroup') {
    const wgNodeId = `wg-${selected.id}`
    highlighted.add(wgNodeId)
    links.forEach(l => {
      if (l.type !== 'member') return
      const srcId = typeof l.source === 'object' ? l.source.id : l.source
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target
      if (srcId === wgNodeId || tgtId === wgNodeId) {
        highlighted.add(srcId)
        highlighted.add(tgtId)
      }
    })
  }

  return highlighted
}

export default function ForceGraph({ simNodes, simLinks, filters, selected, onSelect, svgRef, W, H }) {
  const highlightedIds = getHighlightedIds(selected, simNodes, simLinks)

  const memberLinks = simLinks.filter(l => l.type === 'member')
  const samePersonLinks = simLinks.filter(l => l.type === 'same-person')
  const wgNodes = simNodes.filter(n => n.type === 'workgroup')
  const personNodes = simNodes.filter(n => n.type === 'person')

  return (
    <svg
      ref={svgRef}
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ background: '#faf7f2', borderRadius: 8, border: '1px solid #e5ddd0', display: 'block' }}
      onClick={(e) => { if (e.target === e.currentTarget) onSelect(null) }}
    >
      {/* Member links */}
      <g>
        {memberLinks.map(link => {
          const src = link.source
          const tgt = link.target
          if (!src?.x || !tgt?.x) return null
          const srcId = typeof src === 'object' ? src.id : src
          const dimmed = highlightedIds && !highlightedIds.has(srcId)
          return (
            <line
              key={link.id}
              x1={src.x} y1={src.y}
              x2={tgt.x} y2={tgt.y}
              stroke={typeof src === 'object' ? (src.color ?? '#ddd') : '#ddd'}
              strokeWidth={1}
              opacity={dimmed ? 0.05 : 0.35}
            />
          )
        })}
      </g>

      {/* Clone "same person" links */}
      <g>
        {samePersonLinks.map(link => <CloneLink key={link.id} link={link} />)}
      </g>

      {/* Workgroup nodes */}
      <g>
        {wgNodes.map(node => (
          <WorkgroupNode
            key={node.id}
            node={node}
            dimmed={!!highlightedIds && !highlightedIds.has(node.id)}
            selected={selected?.type === 'workgroup' && selected?.id === node.workgroupId}
            onClick={() => onSelect({ type: 'workgroup', id: node.workgroupId })}
          />
        ))}
      </g>

      {/* Person nodes */}
      <g>
        {personNodes.map(node => {
          const matchesSearch = filters.search
            ? node.name.toLowerCase().includes(filters.search.toLowerCase())
            : null
          const dimmedBySearch = matchesSearch === false
          const dimmedBySelection = !!highlightedIds && !highlightedIds.has(node.id)
          return (
            <PersonNode
              key={node.id}
              node={node}
              dimmed={dimmedBySelection || dimmedBySearch}
              selected={
                selected?.type === 'person' &&
                (node.personId === selected.id || node.id === selected.id)
              }
              showName={filters.showNames || matchesSearch === true}
              onClick={() => onSelect({ type: 'person', id: node.personId ?? node.id })}
            />
          )
        })}
      </g>
    </svg>
  )
}
