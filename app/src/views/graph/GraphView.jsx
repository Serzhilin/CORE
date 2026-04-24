import { useState, useEffect, useRef } from 'react'
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
          Graph canvas placeholder
          <pre style={{ fontSize: '0.7rem', marginTop: 8 }}>
            mode: {mode}{'\n'}
            selected: {JSON.stringify(selected)}
          </pre>
        </div>
      </div>
    </div>
  )
}
