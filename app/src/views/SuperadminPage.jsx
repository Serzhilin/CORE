import { useState, useEffect, useCallback } from 'react'
import { useUser } from '../context/UserContext'
import LoginScreen from '../components/LoginScreen'
import W3dsLinkCard from '../components/W3dsLinkCard'
import { adminListAllCommunities, adminResolveEname, adminCreateCommunity } from '../api/client'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box',
}

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function AddCommunityCard({ onCreated }) {
  const [enameInput, setEnameInput] = useState('')
  const [preview, setPreview] = useState(null)
  const [slug, setSlug] = useState('')
  const [resolving, setResolving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  async function handlePreview() {
    if (!enameInput.trim()) return
    setResolving(true)
    setError(null)
    setPreview(null)
    try {
      const resolution = await adminResolveEname(enameInput.trim())
      setPreview(resolution)
      setSlug(slugify(resolution.envelope.name))
    } catch (err) {
      setError(err.message)
    } finally {
      setResolving(false)
    }
  }

  async function handleCreate() {
    if (!preview || !slug.trim()) return
    setCreating(true)
    setError(null)
    try {
      await adminCreateCommunity(preview.w3id, slug.trim())
      setEnameInput('')
      setPreview(null)
      setSlug('')
      onCreated?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="card" style={{ padding: 28, marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 20px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
        Add community from existing eName
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="@ename or w3id"
            value={enameInput}
            onChange={(e) => { setEnameInput(e.target.value); setPreview(null) }}
          />
          <button type="button" className="btn-secondary" onClick={handlePreview} disabled={resolving || !enameInput.trim()}>
            {resolving ? 'Resolving…' : 'Preview'}
          </button>
        </div>

        {error && <div style={{ fontSize: '0.8rem', color: 'var(--color-red)' }}>{error}</div>}

        {preview && (
          <div style={{ border: '1px solid var(--color-sand)', borderRadius: 8, padding: 14, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <strong>{preview.envelope.name}</strong>
              {preview.envelope.description && <div style={{ marginTop: 4 }}>{preview.envelope.description}</div>}
            </div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>
              Slug
              <input
                style={{ ...inputStyle, marginTop: 4 }}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </label>
            <button type="button" className="btn-primary" onClick={handleCreate} disabled={creating || !slug.trim()}>
              {creating ? 'Creating…' : `Create community linked to ${preview.w3id}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

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

      <AddCommunityCard onCreated={refresh} />

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
