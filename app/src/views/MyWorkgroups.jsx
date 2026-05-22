import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import { addWorkgroupMember, removeWorkgroupMember, assignRole, unassignRole } from '../api/client'

const inputStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', fontSize: '0.85rem', background: 'white' }

export default function MyWorkgroups() {
  const { user } = useUser()
  const { community, refresh } = useCommunity()
  const [busy, setBusy] = useState({}) // { [wgId]: true } while API in-flight
  const [joinOpen, setJoinOpen] = useState(false)

  const allWorkgroups = community?.workgroups || []

  const joined = allWorkgroups
    .map((wg) => {
      const membership = wg.members.find((m) => m.person_id === user?.id)
      if (!membership) return null
      const roles = (membership.roles || [])
        .map((rid) => wg.roles.find((r) => r.id === rid))
        .filter(Boolean)
      const unassigned = wg.roles.filter((r) => !(membership.roles || []).includes(r.id))
      return { wg, membership, roles, unassigned }
    })
    .filter(Boolean)
    .sort((a, b) => a.wg.name.localeCompare(b.wg.name))

  const available = allWorkgroups
    .filter((wg) => !wg.members.some((m) => m.person_id === user?.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function handleJoin(wg) {
    setBusy((s) => ({ ...s, [wg.id]: true }))
    try { await addWorkgroupMember(wg.id, { person_id: user.id }); await refresh() }
    catch (err) { alert(err.message) }
    setBusy((s) => ({ ...s, [wg.id]: false }))
  }

  async function handleLeave(wg) {
    if (!confirm(`Leave "${wg.name}"?`)) return
    setBusy((s) => ({ ...s, [wg.id]: true }))
    try { await removeWorkgroupMember(wg.id, user.id); await refresh() }
    catch (err) { alert(err.message) }
    setBusy((s) => ({ ...s, [wg.id]: false }))
  }

  async function handleAssign(wg, roleId) {
    if (!roleId) return
    setBusy((s) => ({ ...s, [wg.id]: true }))
    try { await assignRole(wg.id, user.id, { role_id: roleId }); await refresh() }
    catch (err) { if (!err.message?.includes('409')) alert(err.message) }
    setBusy((s) => ({ ...s, [wg.id]: false }))
  }

  async function handleUnassign(wg, roleId) {
    setBusy((s) => ({ ...s, [wg.id]: true }))
    try { await unassignRole(wg.id, user.id, roleId); await refresh() }
    catch (err) { alert(err.message) }
    setBusy((s) => ({ ...s, [wg.id]: false }))
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: 24 }}>My workgroups</h2>

      {/* Joined workgroups */}
      {joined.length === 0 ? (
        <div className="card" style={{ padding: 28, color: 'var(--color-charcoal-light)', textAlign: 'center', marginBottom: 32 }}>
          You are not a member of any workgroup yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
          {joined.map(({ wg, roles, unassigned }) => (
            <div key={wg.id} className="card" style={{ borderLeft: `4px solid ${wg.color}`, padding: '18px 24px' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '1.05rem' }}>{wg.name}</span>
                <button
                  onClick={() => handleLeave(wg)}
                  disabled={busy[wg.id]}
                  title="Leave workgroup"
                  style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', opacity: busy[wg.id] ? 0.5 : 1, padding: '2px 4px', display: 'inline-flex', alignItems: 'center' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </div>

              {/* Roles row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {unassigned.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => handleAssign(wg, e.target.value)}
                    disabled={busy[wg.id]}
                    style={{ ...inputStyle, padding: '3px 8px', color: 'var(--color-charcoal-light)' }}
                  >
                    <option value="">+ Role</option>
                    {unassigned.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}

                {roles.map((r) => (
                  <span
                    key={r.id}
                    style={{
                      fontSize: '0.8rem', padding: '3px 10px', borderRadius: 20,
                      background: `${r.color}20`, border: `1px solid ${r.color}66`,
                      color: 'var(--color-charcoal)', display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                    {r.name}
                    <button
                      onClick={() => handleUnassign(wg, r.id)}
                      disabled={busy[wg.id]}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--color-charcoal-light)', fontSize: '0.9rem' }}
                    >×</button>
                  </span>
                ))}

              </div>
            </div>
          ))}
        </div>
      )}

      {/* Available workgroups */}
      {available.length > 0 && (
        <div>
          <button
            onClick={() => setJoinOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: joinOpen ? 12 : 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: 'transform 0.15s', transform: joinOpen ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--color-charcoal-light)' }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-charcoal-light)', fontWeight: 600 }}>
              Join a workgroup
            </span>
          </button>
          {joinOpen && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {available.map((wg) => (
              <div
                key={wg.id}
                style={{
                  background: 'var(--color-cream-dark)', borderRadius: 10,
                  border: '1px solid var(--color-sand)', padding: '12px 18px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: wg.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 500, fontSize: '0.9rem' }}>{wg.name}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-charcoal-light)' }}>
                  {wg.members.length} {wg.members.length === 1 ? 'member' : 'members'}
                </span>
                <button
                  onClick={() => handleJoin(wg)}
                  disabled={busy[wg.id]}
                  title="Join workgroup"
                  style={{ background: 'none', border: 'none', color: 'var(--color-green)', cursor: 'pointer', opacity: busy[wg.id] ? 0.5 : 1, padding: '2px 4px', display: 'inline-flex', alignItems: 'center' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>}
        </div>
      )}
    </div>
  )
}
