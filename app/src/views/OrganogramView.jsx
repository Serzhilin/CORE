import { useState, useRef, lazy, Suspense } from 'react'
import { useCommunity } from '../context/CommunityContext'
import CardGrid from './CardGrid'
import PersonModal from '../components/PersonModal'
import html2canvas from 'html2canvas'

const GraphView = lazy(() => import('./graph/GraphView'))

const inputStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', background: 'white', fontSize: '0.9rem' }
const checkStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', cursor: 'pointer' }

const INITIAL_FILTER = { workgroupId: '', roleName: '', showUnavailable: true, showAspirants: true, search: '' }

export default function OrganogramView() {
  const { community, loading } = useCommunity()
  const [view, setView] = useState('graph')
  const [selectedMember, setSelectedMember] = useState(null)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Unified filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>

        {/* View toggle — always first */}
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

        {/* Shared filters */}
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

        <label style={checkStyle}>
          <input type="checkbox" checked={filter.showUnavailable} onChange={(e) => patch({ showUnavailable: e.target.checked })} />
          Show unavailable
        </label>
        <label style={checkStyle}>
          <input type="checkbox" checked={filter.showAspirants} onChange={(e) => patch({ showAspirants: e.target.checked })} />
          Show aspirants
        </label>

        <input
          placeholder="Search by name…"
          value={filter.search}
          onChange={(e) => patch({ search: e.target.value })}
          style={{ ...inputStyle, width: 160 }}
        />

      </div>

      {view === 'cards' ? (
        <CardGrid community={community} filter={filter} onMemberClick={setSelectedMember} gridRef={cardGridRef} />
      ) : (
        <Suspense fallback={<div>Loading graph…</div>}>
          <GraphView style={{ flex: 1, minHeight: 0 }}
            communityId={community.id}
            filters={filter}
            onFilterToWorkgroup={(wgId) => patch({ workgroupId: wgId })}
            exportRef={graphExportRef}
          />
        </Suspense>
      )}

      {selectedMember && <PersonModal member={selectedMember} onClose={() => setSelectedMember(null)} />}
    </div>
  )
}
