import { useEffect } from 'react'
import AvailabilityBadge from '../components/AvailabilityBadge'

export default function CardGrid({ community, filter, onMemberClick, gridRef, selectedPersonId }) {

  // personId → { workgroupId → [{id, name, color}] }
  const personRoles = {}
  for (const wg of community.workgroups) {
    for (const wm of wg.members) {
      const roles = (wm.roles || [])
        .map((rid) => wg.roles.find((r) => r.id === rid))
        .filter(Boolean)
      if (!personRoles[wm.person_id]) personRoles[wm.person_id] = {}
      personRoles[wm.person_id][wg.id] = roles
    }
  }

  const assignedIds = new Set(
    community.workgroups.flatMap((wg) => wg.members.map((wm) => wm.person_id))
  )

  const firstNameCounts = {}
  community.members.forEach((m) => {
    const f = m.firstName || ''
    if (f) firstNameCounts[f] = (firstNameCounts[f] || 0) + 1
  })
  const duplicateFirstNames = new Set(Object.keys(firstNameCounts).filter(f => firstNameCounts[f] > 1))

  const workgroups = community.workgroups
    .filter((wg) => !filter.workgroupId || wg.id === filter.workgroupId)
    .sort((a, b) => a.sort_order - b.sort_order)

  function applyCommonFilters(members) {
    const q = filter.search?.toLowerCase() ?? ''
    return members
      .filter(Boolean)
      .filter((m) => filter.showUnavailable !== false || !m.availability)
      .filter((m) => !q ||
        (m.firstName || '').toLowerCase().includes(q) ||
        (m.lastName || '').toLowerCase().includes(q))
      .sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''))
  }

  function membersForWorkgroup(wg) {
    return applyCommonFilters(
      wg.members.map((wm) => community.members.find((m) => m.personId === wm.person_id))
    ).filter((m) => !filter.roleName || (() => {
      const wm = wg.members.find((w) => w.person_id === m.personId)
      return wm?.roles.some((rid) => wg.roles.find((r) => r.id === rid)?.name === filter.roleName)
    })())
  }

  // Unassigned: community members not in any workgroup
  const unassignedMembers = !filter.workgroupId && !filter.roleName
    ? applyCommonFilters(community.members.filter((m) => !assignedIds.has(m.personId)))
    : []

  useEffect(() => {
    if (!selectedPersonId) return
    const el = document.querySelector(`[data-person-id="${selectedPersonId}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedPersonId])

  return (
    <div>
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
          padding: 16,
          background: 'var(--color-cream)',
        }}
      >
        {/* Unassigned card — always first */}
        {unassignedMembers.length > 0 && (
          <div className="card" style={{ borderTop: '3px solid var(--color-sand-dark)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px 8px', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-title)', color: 'var(--color-charcoal-light)' }}>
              Without workgroup
            </div>
            <div style={{ paddingBottom: 12 }}>
              {unassignedMembers.map((m) => (
                <MemberRow key={m.personId} m={m} wgColor="#ccc" roles={[]} onMemberClick={onMemberClick} selected={m.personId === selectedPersonId} showLastInitial={duplicateFirstNames.has(m.firstName)} />
              ))}
            </div>
          </div>
        )}

        {workgroups.map((wg) => {
          const members = membersForWorkgroup(wg)
          return (
            <div key={wg.id} className="card" style={{ borderTop: `3px solid ${wg.color}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-title)' }}>{wg.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-light)' }}>{members.length}</span>
              </div>
              <div style={{ paddingBottom: 12 }}>
                {members.length === 0 && (
                  <div style={{ padding: '4px 16px', fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>No members</div>
                )}
                {members.map((m) => (
                  <MemberRow key={m.personId} m={m} wgColor={wg.color} roles={personRoles[m.personId]?.[wg.id] || []} onMemberClick={onMemberClick} selected={m.personId === selectedPersonId} showLastInitial={duplicateFirstNames.has(m.firstName)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MemberRow({ m, wgColor, roles, onMemberClick, selected, showLastInitial }) {
  const unavailable = !!m.availability
  const r = 6
  const svgSize = r * 2 + (roles.length > 0 ? roles.length * 5 + 4 : 0)
  return (
    <div
      data-person-id={m.personId}
      onClick={() => onMemberClick(m)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 16px', cursor: 'pointer',
        opacity: unavailable ? 0.45 : 1,
        background: selected ? `${wgColor}18` : 'none',
        borderLeft: selected ? `3px solid ${wgColor}` : '3px solid transparent',
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      {m.avatarUrl
        ? <img src={m.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        : (
          <svg width={svgSize + 4} height={svgSize + 4} viewBox={`${-(svgSize/2+2)} ${-(svgSize/2+2)} ${svgSize+4} ${svgSize+4}`} style={{ flexShrink: 0, overflow: 'visible' }}>
            {roles.map((role, i) => (
              <circle key={role.id} r={r + 3 + i * 5} fill="none" stroke={role.color} strokeWidth={1.5} opacity={0.85} />
            ))}
            <circle r={r} fill={wgColor} fillOpacity={0.85} stroke="white" strokeWidth={1} />
          </svg>
        )
      }
      <span style={{ fontSize: '0.9rem' }}>
        {m.firstName || m.lastName || 'Unknown'}{showLastInitial && m.lastName ? ` ${m.lastName[0]}.` : ''}
        {m.membershipType?.emoji && (
          <span title={m.membershipType.name} className="emoji-mono" style={{ marginLeft: 5, fontSize: '0.85rem' }}>
            {m.membershipType.emoji}
          </span>
        )}
        {roles.map((role) => (
          <span key={role.id} style={{ marginLeft: 5, fontSize: '0.72rem', color: role.color, fontStyle: 'italic' }}>
            {role.name}
          </span>
        ))}
        {unavailable && (
          <>
            <AvailabilityBadge availability={m.availability} inline />
            {m.availability.until && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-light)' }}>
                until {new Date(m.availability.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </>
        )}
      </span>
    </div>
  )
}
