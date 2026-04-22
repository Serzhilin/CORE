import { useState, lazy, Suspense } from 'react'
import { useCommunity } from '../context/CommunityContext'
import CardGrid from './CardGrid'

const RadialView = lazy(() => import('./RadialView'))

export default function OrganogramView() {
  const { community, loading } = useCommunity()
  const [view, setView] = useState('cards') // 'cards' | 'radial'
  const [selectedMember, setSelectedMember] = useState(null)
  const [filter, setFilter] = useState({ workgroupId: '', roleId: '', hideUnavailable: false })

  if (loading) return <div style={{ color: 'var(--color-charcoal-light)' }}>Loading…</div>
  if (!community) return null

  const allRoles = community.workgroups.flatMap((wg) => wg.roles)

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
            className={view === 'radial' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setView('radial')} style={{ fontSize: '0.85rem' }}
          >Radial</button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
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

      {view === 'cards' ? (
        <CardGrid community={community} filter={filter} onMemberClick={setSelectedMember} />
      ) : (
        <Suspense fallback={<div>Loading radial view…</div>}>
          <RadialView community={community} filter={filter} onMemberClick={setSelectedMember} />
        </Suspense>
      )}

      {/* PersonModal wired in Task 8 */}
    </div>
  )
}
