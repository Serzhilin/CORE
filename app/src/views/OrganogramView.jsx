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
