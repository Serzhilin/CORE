import { useState, useEffect, useRef } from 'react'
import { getCommunityGraph } from '../../api/client'
import { useGraphData } from './useGraphData'
import { useForceSimulation } from './useForceSimulation'
import ForceGraph from './ForceGraph'

export default function GraphView({ communityId, filters, selection, onSelectionClear, onPersonSelect, onWorkgroupSelect, refreshKey, exportRef, style }) {
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(true)
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
    if (!node) { if (onSelectionClear) onSelectionClear(); return }
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
          selected={selection}
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
