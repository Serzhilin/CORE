import { useState, useRef, lazy, Suspense } from 'react'
import { Input, Panel } from '@ecommons/ui'
import { useCommunity } from '../context/CommunityContext'
import { useSetTopBarSlot } from '../context/TopBarSlotContext'
import CardGrid from './CardGrid'
import InfoPanel from '../components/InfoPanel'
import html2canvas from 'html2canvas'

const GraphView = lazy(() => import('./graph/GraphView'))

const inputStyle = { padding: '0 10px', height: 34, boxSizing: 'border-box', appearance: 'none', WebkitAppearance: 'none', borderRadius: 0, border: '2px solid var(--color-charcoal)', boxShadow: 'var(--block-shadow-sm)', background: 'white', fontSize: '0.9rem' }
const checkStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', cursor: 'pointer' }

const INITIAL_FILTER = { workgroupId: '', roleName: '', showUnavailable: true, search: '' }

export default function OrganogramView() {
  const { community, loading } = useCommunity()
  const [view, setView] = useState(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'cards' : 'graph')
  const [panelSelection, setPanelSelection] = useState(null)
  const [filter, setFilter] = useState(INITIAL_FILTER)
  const cardGridRef = useRef(null)
  const graphExportRef = useRef(null)

  const allRoleNames = community ? [...new Set(
    community.workgroups.flatMap((wg) => wg.roles.map((r) => r.name))
  )].sort() : []

  const patch = (p) => setFilter((f) => ({ ...f, ...p }))

  useSetTopBarSlot(
    community ? (
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
        <Panel shadow="sm" style={{ display: 'flex', height: 34, boxSizing: 'border-box', overflow: 'hidden', flexShrink: 0 }}>
          {['graph', 'cards'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '0 14px', height: '100%', boxSizing: 'border-box', border: 'none', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: 500, fontFamily: 'var(--font-sans)',
                background: view === v ? 'var(--color-terracotta)' : 'white',
                color: view === v ? 'white' : 'var(--color-charcoal-light)',
              }}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </Panel>

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

        <Input
          placeholder="Search by name…"
          value={filter.search}
          onChange={(e) => patch({ search: e.target.value })}
          style={{ height: 34, padding: '0 10px', boxSizing: 'border-box', boxShadow: 'var(--block-shadow-sm)', width: 160 }}
        />

        <label style={checkStyle}>
          <input type="checkbox" checked={filter.showUnavailable} onChange={(e) => patch({ showUnavailable: e.target.checked })} />
          Show unavailable
        </label>
      </div>
    ) : null,
    [community, view, filter, allRoleNames.join('|')]
  )

  if (loading) return <div style={{ color: 'var(--color-charcoal-light)' }}>Loading…</div>
  if (!community) return null

  async function exportPng() {
    if (!cardGridRef.current) return
    const canvas = await html2canvas(cardGridRef.current, { backgroundColor: '#F5F0E8', useCORS: true })
    const a = document.createElement('a')
    a.download = 'organogram.png'
    a.href = canvas.toDataURL()
    a.click()
  }

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
      {/* Main content row: view + InfoPanel */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, overflow: view === 'cards' ? 'auto' : 'visible' }}>
          {view === 'cards' ? (
            <CardGrid community={community} filter={filter} onMemberClick={handleMemberClick} gridRef={cardGridRef} selectedPersonId={panelSelection?.type === 'person' ? panelSelection.id : null} />
          ) : (
            <Suspense fallback={<div>Loading graph…</div>}>
              <GraphView
                style={{ flex: 1, minHeight: 0, height: '100%' }}
                communityId={community.id}
                filters={filter}
                refreshKey={community.workgroups.flatMap(wg => wg.roles.map(r => r.id + r.name + r.color)).join('|')}
                selection={panelSelection}
                onSelectionClear={() => setPanelSelection(null)}
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
