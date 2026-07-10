import { useState, useEffect, useCallback } from 'react'
import { useUser } from '../context/UserContext'
import LoginScreen from '../components/LoginScreen'
import W3dsLinkCard from '../components/W3dsLinkCard'
import { adminListAllCommunities } from '../api/client'

export default function SuperadminPage() {
  const { user, isPlatformAdmin, loading, login } = useUser()
  const [communities, setCommunities] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [listError, setListError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const list = await adminListAllCommunities()
      setCommunities(list)
    } catch (err) {
      setListError(err.message)
    }
  }, [])

  useEffect(() => {
    if (user && isPlatformAdmin) refresh()
  }, [user, isPlatformAdmin, refresh])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: 'var(--color-charcoal-light)' }}>
        Loading…
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onSuccess={(token, person, memberships, ipa) => login(token, person, memberships, ipa)} />
  }

  if (!isPlatformAdmin) {
    return (
      <div style={{ padding: 32, fontFamily: 'Inter, sans-serif', color: 'var(--color-red)' }}>
        Platform admin access required.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 32, fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontFamily: 'var(--font-title)', margin: '0 0 24px' }}>Superadmin — Communities</h1>

      {listError && <div style={{ color: 'var(--color-red)', marginBottom: 16 }}>{listError}</div>}

      {communities.map((c) => (
        <div key={c.id} className="card" style={{ padding: '14px 18px', marginBottom: 10 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-charcoal-light)' }}>/{c.slug}</div>
            </div>
            <span style={{
              fontSize: '0.78rem', padding: '3px 10px', borderRadius: 999,
              background: c.provisioning_status === 'linked' ? 'var(--color-green, #dcfce7)' : 'var(--color-sand)',
              color: c.provisioning_status === 'linked' ? '#166534' : 'var(--color-charcoal-light)',
            }}>
              {c.provisioning_status === 'linked' ? `linked · ${c.ename}` : 'local only'}
            </span>
          </div>

          {expandedId === c.id && (
            <div style={{ marginTop: 16 }}>
              <W3dsLinkCard communityId={c.id} community={c} onChange={refresh} />
            </div>
          )}
        </div>
      ))}

      {communities.length === 0 && !listError && (
        <p style={{ color: 'var(--color-charcoal-light)' }}>No communities yet.</p>
      )}
    </div>
  )
}
