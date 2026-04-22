import { useState } from 'react'
import { useCommunity } from '../context/CommunityContext'
import AvailabilityBadge from '../components/AvailabilityBadge'
import PersonModal from '../components/PersonModal'

function sortHeader(label, k, sortKey, sortAsc, toggleSort) {
  const active = sortKey === k
  return (
    <th
      onClick={() => toggleSort(k)}
      style={{ textAlign: 'left', padding: '10px 16px', cursor: 'pointer', background: active ? 'var(--color-sand)' : 'transparent', whiteSpace: 'nowrap', userSelect: 'none' }}
    >
      {label} {active ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  )
}

export default function MembersTable() {
  const { community, loading } = useCommunity()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [selected, setSelected] = useState(null)

  if (loading) return <div style={{ color: 'var(--color-charcoal-light)' }}>Loading…</div>
  if (!community) return null

  function toggleSort(key) {
    if (sortKey === key) setSortAsc((a) => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const members = community.members
    .filter((m) => {
      const q = search.toLowerCase()
      return !q ||
        (m.firstName || '').toLowerCase().includes(q) ||
        (m.lastName || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q)
    })
    .map((m) => {
      const wgNames = community.workgroups
        .filter((wg) => wg.members?.some((wm) => wm.person_id === m.personId))
        .map((wg) => wg.name)
      const roleNames = community.workgroups.flatMap((wg) => {
        const wm = wg.members?.find((wm) => wm.person_id === m.personId)
        return (wm?.roles || []).map((rid) => wg.roles.find((r) => r.id === rid)?.name).filter(Boolean)
      })
      return { ...m, wgNames, roleNames }
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        const na = [a.firstName, a.lastName].filter(Boolean).join(' ')
        const nb = [b.firstName, b.lastName].filter(Boolean).join(' ')
        cmp = na.localeCompare(nb)
      } else if (sortKey === 'joinedAt') {
        cmp = (a.joinedAt || '').localeCompare(b.joinedAt || '')
      } else if (sortKey === 'availability') {
        cmp = (a.availability ? 1 : 0) - (b.availability ? 1 : 0)
      }
      return sortAsc ? cmp : -cmp
    })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-title)', margin: 0 }}>Members</h2>
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-sand-dark)', width: 220, background: 'white' }}
        />
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead style={{ borderBottom: '2px solid var(--color-sand)' }}>
            <tr>
              {sortHeader('Name', 'name', sortKey, sortAsc, toggleSort)}
              <th style={{ textAlign: 'left', padding: '10px 16px' }}>Workgroups</th>
              <th style={{ textAlign: 'left', padding: '10px 16px' }}>Roles</th>
              {sortHeader('Availability', 'availability', sortKey, sortAsc, toggleSort)}
              {sortHeader('Joined', 'joinedAt', sortKey, sortAsc, toggleSort)}
            </tr>
          </thead>
          <tbody>
            {members.map((m, idx) => (
              <tr
                key={m.personId}
                onClick={() => setSelected(m)}
                style={{
                  cursor: 'pointer',
                  background: idx % 2 === 0 ? 'transparent' : 'var(--color-cream)',
                  opacity: m.availability ? 0.7 : 1,
                }}
              >
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>
                  {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || '—'}
                  {m.isAspirant && (
                    <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#FFF3CD', borderRadius: 4, padding: '1px 6px' }}>Aspirant</span>
                  )}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--color-charcoal-light)' }}>
                  {m.wgNames.join(', ') || '—'}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--color-charcoal-light)' }}>
                  {m.roleNames.join(', ') || '—'}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  {m.availability
                    ? <span title={m.availability.reason || ''}><AvailabilityBadge availability={m.availability} /> {m.availability.type.name}</span>
                    : <span style={{ color: 'var(--color-green)', fontSize: '0.85rem' }}>Available</span>}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--color-charcoal-light)' }}>
                  {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('nl-NL') : '—'}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--color-charcoal-light)' }}>No members found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <PersonModal member={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
