import { useCommunity } from '../context/CommunityContext'

export default function MemberSidePanel({ member, onClose }) {
  const { community } = useCommunity()
  if (!member) return null

  const wgMemberships = (community?.workgroups || [])
    .filter((wg) => wg.members?.some((wm) => wm.person_id === member.personId))
    .map((wg) => {
      const wm = wg.members.find((wm) => wm.person_id === member.personId)
      const roles = (wm?.roles || []).map((rid) => wg.roles.find((r) => r.id === rid)).filter(Boolean)
      return { wg, roles }
    })

  const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'
  const initial = (member.firstName || member.email || '?')[0].toUpperCase()

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 400 }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 300, background: 'white',
        boxShadow: '-4px 0 24px rgba(44,44,44,0.12)',
        borderLeft: '1px solid var(--color-sand)',
        zIndex: 500, overflowY: 'auto',
        padding: '24px 20px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--color-charcoal-light)', lineHeight: 1 }}
        >×</button>

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}>
          {member.avatarUrl
            ? <img src={member.avatarUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-sand-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>{initial}</div>
          }
          <div>
            <div style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '1rem', lineHeight: 1.3 }}>{name}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {member.isAdmin && <span style={{ fontSize: '0.7rem', background: 'var(--color-sand)', borderRadius: 4, padding: '1px 7px' }}>Admin</span>}
              {member.isAspirant && <span style={{ fontSize: '0.7rem', background: '#FFF3CD', borderRadius: 4, padding: '1px 7px' }}>Aspirant</span>}
              {member.isActivePartner && <span style={{ fontSize: '0.7rem', background: '#E8F5E9', borderRadius: 4, padding: '1px 7px' }}>Active partner</span>}
            </div>
          </div>
        </div>

        {/* Bio */}
        {member.bio && (
          <div style={{ fontSize: '0.88rem', color: 'var(--color-charcoal-light)', lineHeight: 1.6, borderTop: '1px solid var(--color-sand)', paddingTop: 12 }}>
            {member.bio}
          </div>
        )}

        {/* Availability */}
        {member.availability && (
          <div style={{ background: 'var(--color-sand)', borderRadius: 8, padding: '10px 12px', fontSize: '0.88rem' }}>
            <span style={{ marginRight: 6 }}>{member.availability.type.emoji}</span>
            <span style={{ fontWeight: 500 }}>{member.availability.type.name}</span>
            {member.availability.reason && <span style={{ color: 'var(--color-charcoal-light)' }}> — {member.availability.reason}</span>}
            {member.availability.until && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)', marginTop: 4 }}>
                Until {new Date(member.availability.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
        )}

        {/* Workgroups + roles */}
        {wgMemberships.length > 0 && (
          <div style={{ borderTop: '1px solid var(--color-sand)', paddingTop: 12 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)', marginBottom: 8 }}>Workgroups</div>
            {wgMemberships.map(({ wg, roles }) => (
              <div key={wg.id} style={{ borderLeft: `3px solid ${wg.color}`, paddingLeft: 10, marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{wg.name}</div>
                {roles.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {roles.map((r) => (
                      <span key={r.id} style={{ fontSize: '0.75rem', background: r.color + '22', border: `1px solid ${r.color}66`, borderRadius: 4, padding: '1px 7px', color: 'var(--color-charcoal)' }}>
                        {r.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Joined date */}
        {member.joinedAt && (
          <div style={{ borderTop: '1px solid var(--color-sand)', paddingTop: 12, fontSize: '0.82rem', color: 'var(--color-charcoal-light)' }}>
            Member since {new Date(member.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>
    </>
  )
}
