import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'

export default function MyWorkgroups() {
  const { user } = useUser()
  const { community } = useCommunity()

  const myWorkgroups = (community?.workgroups || [])
    .map((wg) => {
      const membership = wg.members.find((m) => m.person_id === user?.id)
      if (!membership) return null
      const roles = (membership.roles || [])
        .map((rid) => wg.roles.find((r) => r.id === rid))
        .filter(Boolean)
      return { wg, membership, roles }
    })
    .filter(Boolean)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: 24 }}>My workgroups</h2>

      {myWorkgroups.length === 0 ? (
        <div className="card" style={{ padding: 28, color: 'var(--color-charcoal-light)', textAlign: 'center' }}>
          You are not a member of any workgroup yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {myWorkgroups.map(({ wg, membership, roles }) => (
            <div key={wg.id} className="card" style={{ borderLeft: `4px solid ${wg.color}`, padding: '18px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: roles.length ? 10 : 0 }}>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '1rem' }}>{wg.name}</span>
                {membership.is_workgroup_admin && (
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                    background: `${wg.color}22`, color: wg.color, border: `1px solid ${wg.color}55`,
                  }}>
                    Admin
                  </span>
                )}
              </div>

              {roles.length > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {roles.map((r) => (
                    <span key={r.id} style={{
                      fontSize: '0.8rem', padding: '3px 10px', borderRadius: 20,
                      background: `${r.color}20`, border: `1px solid ${r.color}55`, color: 'var(--color-charcoal)',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.color, display: 'inline-block' }} />
                      {r.name}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-light)' }}>No roles assigned</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
