import { useState, useEffect, useRef } from 'react'
import { getCommunityGraph } from '../../api/client'
import GraphToolbar from './GraphToolbar'
import { useGraphData } from './useGraphData'
import { useForceSimulation } from './useForceSimulation'
import ForceGraph from './ForceGraph'
import GraphSidePanel from './GraphSidePanel'

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
  const svgRef = useRef(null)

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

  const { nodes, links } = useGraphData(graphData, mode, filters)
  const { simNodes, simLinks, reheat, W, H } = useForceSimulation(nodes, links)

  if (loading) return <div style={{ padding: 40, color: 'var(--color-charcoal-light)' }}>Loading graph…</div>
  if (!graphData) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', minHeight: 500 }}>
      <div style={{ marginBottom: 8 }}>
        <GraphToolbar
          graphData={graphData}
          mode={mode}
          filters={filters}
          onModeChange={setMode}
          onFiltersChange={(patch) => setFilters(f => ({ ...f, ...patch }))}
          onReset={resetFilters}
          onExport={() => {/* wired in Task 11 */}}
        />
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <ForceGraph
          simNodes={simNodes}
          simLinks={simLinks}
          filters={filters}
          selected={selected}
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
    </div>
  )
}
