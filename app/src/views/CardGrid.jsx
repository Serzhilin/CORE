import AvailabilityBadge from '../components/AvailabilityBadge'

export default function CardGrid({ community, filter, onMemberClick, gridRef }) {

  // personId → { workgroupId → roleColors[] }
  const personRoleColors = {}
  for (const wg of community.workgroups) {
    for (const wm of wg.members) {
      const roleColors = (wm.roles || [])
        .map((rid) => wg.roles.find((r) => r.id === rid)?.color)
        .filter(Boolean)
      if (!personRoleColors[wm.person_id]) personRoleColors[wm.person_id] = {}
      personRoleColors[wm.person_id][wg.id] = roleColors
    }
  }

  const assignedIds = new Set(
    community.workgroups.flatMap((wg) => wg.members.map((wm) => wm.person_id))
  )

  const workgroups = community.workgroups
    .filter((wg) => !filter.workgroupId || wg.id === filter.workgroupId)
    .sort((a, b) => a.sort_order - b.sort_order)

  function applyCommonFilters(members) {
    const q = filter.search?.toLowerCase() ?? ''
    return members
      .filter(Boolean)
      .filter((m) => filter.showUnavailable !== false || !m.availability)
      .filter((m) => filter.showAspirants !== false || !m.isAspirant)
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
                <MemberRow key={m.personId} m={m} wgColor="#ccc" roleColors={[]} onMemberClick={onMemberClick} />
              ))}
            </div>
          </div>
        )}

        {workgroups.map((wg) => {
          const members = membersForWorkgroup(wg)
          return (
            <div key={wg.id} className="card" style={{ borderTop: `3px solid ${wg.color}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px 8px', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-title)' }}>
                {wg.name}
              </div>
              <div style={{ paddingBottom: 12 }}>
                {members.length === 0 && (
                  <div style={{ padding: '4px 16px', fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>No members</div>
                )}
                {members.map((m) => (
                  <MemberRow key={m.personId} m={m} wgColor={wg.color} roleColors={personRoleColors[m.personId]?.[wg.id] || []} onMemberClick={onMemberClick} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MemberRow({ m, wgColor, roleColors, onMemberClick }) {
  const unavailable = !!m.availability
  const r = 6
  const svgSize = r * 2 + (roleColors.length > 0 ? roleColors.length * 5 + 4 : 0)
  return (
    <div
      onClick={() => onMemberClick(m)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 16px', cursor: 'pointer',
        opacity: unavailable ? 0.45 : 1,
      }}
    >
      {m.avatarUrl
        ? <img src={m.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        : (
          <svg width={svgSize + 4} height={svgSize + 4} viewBox={`${-(svgSize/2+2)} ${-(svgSize/2+2)} ${svgSize+4} ${svgSize+4}`} style={{ flexShrink: 0, overflow: 'visible' }}>
            {roleColors.map((color, i) => (
              <circle key={i} r={r + 3 + i * 5} fill="none" stroke={color} strokeWidth={1.5} opacity={0.85} />
            ))}
            <circle r={r} fill={wgColor} fillOpacity={m.isAspirant ? 0.35 : 0.85}
              stroke={m.isAspirant ? wgColor : 'white'} strokeWidth={1}
              strokeDasharray={m.isAspirant ? '3,2' : 'none'} />
          </svg>
        )
      }
      <span style={{ fontSize: '0.9rem' }}>
        {m.firstName || m.lastName || 'Unknown'}
        {m.isAspirant && (
          <span style={{ marginLeft: 5, fontSize: '0.72rem', color: 'var(--color-charcoal-light)', fontStyle: 'italic' }}>
            aspirant
          </span>
        )}
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
