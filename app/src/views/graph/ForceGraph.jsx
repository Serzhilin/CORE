import { useEffect, useRef, useState } from 'react'
import WorkgroupNode from './WorkgroupNode'
import PersonNode from './PersonNode'

function getHighlightedIds(selected, nodes, links) {
  if (!selected) return null
  const highlighted = new Set()

  if (selected.type === 'person') {
    nodes.forEach(n => {
      if (n.type === 'person' && (n.personId === selected.id || n.id === selected.id))
        highlighted.add(n.id)
    })
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

export default function ForceGraph({ simNodes, simLinks, filters, selected, onSelect, svgRef, simRef, W, H }) {
  const INITIAL_TR = { x: 90, y: 52.5, k: 0.85 }
  const [transform, setTransform] = useState(INITIAL_TR)
  const trRef = useRef(INITIAL_TR)
  const dragRef = useRef(null)  // { nodeId, isWorkgroup, moved }
  const panRef = useRef(null)   // { startCX, startCY, startTx, startTy }
  const wasDragged = useRef(false)
  const [isPanning, setIsPanning] = useState(false)

  function setTr(fn) {
    setTransform(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      trRef.current = next
      return next
    })
  }

  // Wheel zoom (needs passive:false for preventDefault)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    function onWheel(e) {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const rect = svg.getBoundingClientRect()
      const mx = (e.clientX - rect.left) / rect.width * W
      const my = (e.clientY - rect.top) / rect.height * H
      setTr(t => {
        const k = Math.max(0.15, Math.min(6, t.k * factor))
        const x = mx - (mx - t.x) * (k / t.k)
        const y = my - (my - t.y) * (k / t.k)
        return { x, y, k }
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [svgRef, W, H])

  function clientToGraph(clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = (clientX - rect.left) / rect.width * W
    const svgY = (clientY - rect.top) / rect.height * H
    const t = trRef.current
    return { x: (svgX - t.x) / t.k, y: (svgY - t.y) / t.k }
  }

  function handleSvgMouseDown(e) {
    if (e.button !== 0) return
    panRef.current = {
      startCX: e.clientX, startCY: e.clientY,
      startTx: trRef.current.x, startTy: trRef.current.y,
    }
    setIsPanning(true)
  }

  function handleNodeMouseDown(e, nodeId, isWorkgroup) {
    e.stopPropagation()
    if (e.button !== 0) return
    const node = simRef.current?._nodes.find(n => n.id === nodeId)
    if (node) { node.fx = node.x; node.fy = node.y }
    dragRef.current = { nodeId, isWorkgroup, moved: false, startCX: e.clientX, startCY: e.clientY }
    wasDragged.current = false
  }

  function handleMouseMove(e) {
    if (panRef.current && !dragRef.current) {
      const { startCX, startCY, startTx, startTy } = panRef.current
      const rect = svgRef.current.getBoundingClientRect()
      const dx = (e.clientX - startCX) / rect.width * W
      const dy = (e.clientY - startCY) / rect.height * H
      setTr(t => ({ ...t, x: startTx + dx, y: startTy + dy }))
    }

    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startCX
      const dy = e.clientY - dragRef.current.startCY
      if (Math.hypot(dx, dy) > 4) {
        dragRef.current.moved = true
        wasDragged.current = true
      }
      if (dragRef.current.moved) {
        const pos = clientToGraph(e.clientX, e.clientY)
        const node = simRef.current?._nodes.find(n => n.id === dragRef.current.nodeId)
        if (node) {
          node.fx = pos.x
          node.fy = pos.y
          simRef.current?.alpha(0.3).restart()
        }
      }
    }
  }

  function handleMouseUp() {
    if (dragRef.current) {
      const { nodeId, isWorkgroup, moved } = dragRef.current
      if (moved && !isWorkgroup) {
        // Release person nodes — let them float free again
        const node = simRef.current?._nodes.find(n => n.id === nodeId)
        if (node) { node.fx = null; node.fy = null }
        simRef.current?.alpha(0.3).restart()
      }
      dragRef.current = null
      // Clear wasDragged after click event fires
      setTimeout(() => { wasDragged.current = false }, 0)
    }
    panRef.current = null
    setIsPanning(false)
  }

  const highlightedIds = getHighlightedIds(selected, simNodes, simLinks)
  const memberLinks = simLinks.filter(l => l.type === 'member')
  const wgNodes = simNodes.filter(n => n.type === 'workgroup')
  const personNodes = simNodes.filter(n => n.type === 'person')

  // First-name uniqueness for label display
  const firstNameCounts = {}
  personNodes.forEach(n => { const f = (n.name || '').split(' ')[0]; firstNameCounts[f] = (firstNameCounts[f] || 0) + 1 })
  function personLabel(node) {
    const parts = (node.name || '').split(' ')
    const first = parts[0] || ''
    if (!first) return ''
    if (firstNameCounts[first] > 1 && parts[1]) return `${first} ${parts[1][0]}.`
    return first
  }
  const { x, y, k } = transform

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      className="panel-frame"
      style={{ background: '#fff', display: 'block', cursor: isPanning ? 'grabbing' : 'grab' }}
      onMouseDown={handleSvgMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={(e) => { if (e.target === e.currentTarget && !wasDragged.current) onSelect(null) }}
    >
      <g transform={`translate(${x},${y}) scale(${k})`}>
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
                stroke={typeof tgt === 'object' ? (tgt.color ?? '#ddd') : '#ddd'}
                strokeWidth={1}
                opacity={dimmed ? 0.05 : 0.35}
              />
            )
          })}
        </g>

        {/* Workgroup nodes */}
        <g>
          {wgNodes.map(node => (
            <WorkgroupNode
              key={node.id}
              node={node}
              dimmed={!!highlightedIds && !highlightedIds.has(node.id)}
              selected={selected?.type === 'workgroup' && selected?.id === node.workgroupId}
              onClick={() => { if (!wasDragged.current) onSelect({ type: 'workgroup', id: node.workgroupId }) }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id, true)}
            />
          ))}
        </g>

        {/* Person nodes */}
        <g>
          {personNodes.map(node => {
            const matchesSearch = filters.search
              ? node.name.toLowerCase().includes(filters.search.toLowerCase())
              : null
            return (
              <PersonNode
                key={node.id}
                node={{ ...node, name: personLabel(node) }}
                dimmed={(!!highlightedIds && !highlightedIds.has(node.id)) || matchesSearch === false}
                selected={selected?.type === 'person' && (node.personId === selected.id || node.id === selected.id)}
                showName={true}
                onClick={() => { if (!wasDragged.current) onSelect({ type: 'person', id: node.personId ?? node.id }) }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id, false)}
              />
            )
          })}
        </g>
      </g>
    </svg>
  )
}
