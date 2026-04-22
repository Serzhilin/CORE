import { useRef } from 'react'
import html2canvas from 'html2canvas'
import AvailabilityBadge from '../components/AvailabilityBadge'

export default function CardGrid({ community, filter, onMemberClick }) {
  const gridRef = useRef(null)

  // Build a lookup: personId → {workgroupId → firstRoleColor}
  const personRoles = {}
  for (const wg of community.workgroups) {
    for (const wm of wg.members) {
      const firstRoleId = wm.roles?.[0]
      const role = firstRoleId ? wg.roles.find((r) => r.id === firstRoleId) : null
      if (!personRoles[wm.person_id]) personRoles[wm.person_id] = {}
      personRoles[wm.person_id][wg.id] = role?.color || '#E8DDD0'
    }
  }

  const workgroups = community.workgroups
    .filter((wg) => !filter.workgroupId || wg.id === filter.workgroupId)
    .sort((a, b) => a.sort_order - b.sort_order)

  function membersForWorkgroup(wg) {
    return wg.members
      .map((wm) => community.members.find((m) => m.personId === wm.person_id))
      .filter(Boolean)
      .filter((m) => !filter.hideUnavailable || !m.availability)
      .filter((m) => !filter.roleId || wg.members
        .find((wm) => wm.person_id === m.personId)?.roles.includes(filter.roleId))
  }

  async function exportPng() {
    if (!gridRef.current) return
    const canvas = await html2canvas(gridRef.current, { backgroundColor: '#F5F0E8', useCORS: true })
    const a = document.createElement('a')
    a.download = 'organogram.png'
    a.href = canvas.toDataURL()
    a.click()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-secondary" onClick={exportPng} style={{ fontSize: '0.85rem' }}>
          Save as PNG
        </button>
      </div>

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
        {workgroups.map((wg) => {
          const members = membersForWorkgroup(wg)
          return (
            <div
              key={wg.id}
              className="card"
              style={{ borderTop: `3px solid ${wg.color}`, overflow: 'hidden' }}
            >
              <div style={{ padding: '12px 16px 8px', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-title)' }}>
                {wg.name}
              </div>
              <div style={{ paddingBottom: 12 }}>
                {members.length === 0 && (
                  <div style={{ padding: '4px 16px', fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>No members</div>
                )}
                {members.map((m) => {
                  const dotColor = personRoles[m.personId]?.[wg.id] || '#E8DDD0'
                  const unavailable = !!m.availability
                  return (
                    <div
                      key={m.personId}
                      onClick={() => onMemberClick(m)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 16px', cursor: 'pointer',
                        opacity: unavailable ? 0.45 : 1,
                        borderLeft: m.isAspirant ? '3px dashed var(--color-sand-dark)' : '3px solid transparent',
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.9rem' }}>
                        {m.firstName || m.lastName || 'Unknown'}
                        {unavailable && <AvailabilityBadge availability={m.availability} inline />}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
