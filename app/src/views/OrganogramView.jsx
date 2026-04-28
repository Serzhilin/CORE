import { useState, lazy, Suspense } from 'react'
import { useCommunity } from '../context/CommunityContext'
import CardGrid from './CardGrid'
import PersonModal from '../components/PersonModal'

const GraphView = lazy(() => import('./graph/GraphView'))

export default function OrganogramView() {
  const { community, loading } = useCommunity()
  const [view, setView] = useState('cards') // 'cards' | 'graph'
  const [selectedMember, setSelectedMember] = useState(null)
  const [filter, setFilter] = useState({ workgroupId: '', roleId: '', hideUnavailable: false, search: '' })

  if (loading) return <div style={{ color: 'var(--color-charcoal-light)' }}>Loading…</div>
  if (!community) return null

  const allRoles = community.workgroups
    .flatMap((wg) => wg.roles)
    .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-title)', margin: 0 }}>Organogram</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={view === 'cards' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setView('cards')} style={{ fontSize: '0.85rem' }}
          >Cards</button>
          <button
            className={view === 'graph' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setView('graph')} style={{ fontSize: '0.85rem' }}
          >Graph</button>
        </div>
      </div>

      {/* Filter bar — cards only */}
      {view === 'cards' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Search by name…"
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', background: 'white', width: 160 }}
          />
          <select
            value={filter.workgroupId}
            onChange={(e) => setFilter((f) => ({ ...f, workgroupId: e.target.value }))}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', background: 'white' }}
          >
            <option value="">All workgroups</option>
            {community.workgroups.map((wg) => (
              <option key={wg.id} value={wg.id}>{wg.name}</option>
            ))}
          </select>
          <select
            value={filter.roleId}
            onChange={(e) => setFilter((f) => ({ ...f, roleId: e.target.value }))}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', background: 'white' }}
          >
            <option value="">All roles</option>
            {allRoles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filter.hideUnavailable}
              onChange={(e) => setFilter((f) => ({ ...f, hideUnavailable: e.target.checked }))}
            />
            Hide unavailable
          </label>
        </div>
      )}

      {view === 'cards' ? (
        <CardGrid community={community} filter={filter} onMemberClick={setSelectedMember} />
      ) : (
        <Suspense fallback={<div>Loading graph…</div>}>
          <GraphView communityId={community.id} />
        </Suspense>
      )}

      {selectedMember && <PersonModal member={selectedMember} onClose={() => setSelectedMember(null)} />}
    </div>
  )
}
