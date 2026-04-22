import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import AvailabilityBadge from './AvailabilityBadge'

export default function PersonModal({ member, onClose }) {
  const { user } = useUser()
  const { community } = useCommunity()

  if (!member) return null

  const myMembership = community?.members.find((m) => m.personId === user?.id)
  const isAdmin = myMembership?.isAdmin ?? false
  const isOwn = member.personId === user?.id

  // Workgroup memberships for this person
  const wgMemberships = community?.workgroups
    .filter((wg) => wg.members?.some((wm) => wm.person_id === member.personId))
    .map((wg) => {
      const wm = wg.members.find((wm) => wm.person_id === member.personId)
      const roles = (wm?.roles || []).map((rid) => wg.roles.find((r) => r.id === rid)).filter(Boolean)
      return { workgroup: wg, roles }
    }) || []

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(44,44,44,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 480, width: '100%', padding: 32, maxHeight: '80vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', margin: '0 0 4px' }}>
              {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'}
            </h2>
            {member.isAdmin && <span style={{ fontSize: '0.75rem', background: 'var(--color-sand)', borderRadius: 4, padding: '2px 8px' }}>Admin</span>}
            {member.isAspirant && <span style={{ fontSize: '0.75rem', background: '#FFF3CD', borderRadius: 4, padding: '2px 8px', marginLeft: 4 }}>Aspirant</span>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--color-charcoal-light)', lineHeight: 1 }}>×</button>
        </div>

        {/* Contact */}
        {member.email && (
          <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: 'var(--color-charcoal-light)' }}>
            📧 {member.email}
          </p>
        )}

        {/* Availability */}
        {member.availability && (
          <div style={{ background: 'var(--color-sand)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.9rem' }}>
            <AvailabilityBadge availability={member.availability} /> {member.availability.type.name}
            {member.availability.reason && <span style={{ color: 'var(--color-charcoal-light)' }}> — {member.availability.reason}</span>}
            {member.availability.until && <span style={{ color: 'var(--color-charcoal-light)' }}> (until {member.availability.until})</span>}
          </div>
        )}

        {/* Workgroups */}
        {wgMemberships.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--color-charcoal-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Workgroups</h4>
            {wgMemberships.map(({ workgroup, roles }) => (
              <div key={workgroup.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: workgroup.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{workgroup.name}</span>
                {roles.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>
                    — {roles.map((r) => r.name).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {(isAdmin || isOwn) && (
          <div style={{ paddingTop: 16, borderTop: '1px solid var(--color-sand)', fontSize: '0.85rem', color: 'var(--color-charcoal-light)' }}>
            Edit available in {isOwn ? '"My profile"' : '"Admin → Members"'}
          </div>
        )}
      </div>
    </div>
  )
}
