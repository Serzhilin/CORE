import { useState } from 'react'
import { useCommunity } from '../../context/CommunityContext'
import { useUser } from '../../context/UserContext'
import { updateCommunity, updateMember } from '../../api/client'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box',
}

export default function CommunityTab() {
  const { communityId, community, refresh } = useCommunity()
  const { user } = useUser()

  const [form, setForm] = useState({
    name: community?.name || '',
    slug: community?.slug || '',
    description: community?.description || '',
    primary_color: community?.primary_color || '#C4622D',
    title_font: community?.title_font || 'Playfair Display',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [logo, setLogo] = useState(community?.logo_url || null)
  const [logoSaving, setLogoSaving] = useState(false)
  const [logoError, setLogoError] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    try {
      await updateCommunity(communityId, form)
      await refresh()
      setSaveMsg('Saved!')
    } catch (err) {
      setSaveMsg('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result
      setLogo(dataUrl)
      setLogoError(null)
      setLogoSaving(true)
      try {
        await updateCommunity(communityId, { logo_url: dataUrl })
        await refresh()
      } catch (err) {
        setLogoError(err.message)
        setLogo(community?.logo_url || null)
      } finally {
        setLogoSaving(false)
      }
    }
    reader.readAsDataURL(file)
  }

  async function removeLogo() {
    setLogoError(null)
    setLogoSaving(true)
    try {
      setLogo(null)
      await updateCommunity(communityId, { logo_url: null })
      await refresh()
    } catch (err) {
      setLogoError(err.message)
      setLogo(community?.logo_url || null)
    } finally {
      setLogoSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Community settings */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
          Community settings
        </h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Name</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Slug</label>
            <input style={inputStyle} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} pattern="[a-z0-9-]+" />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-light)' }}>Lowercase letters, numbers, hyphens only</span>
          </div>

          {/* Logo upload */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', fontWeight: 500 }}>Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 80, height: 48, border: '1px solid var(--color-sand)', borderRadius: 8,
                background: 'var(--color-cream)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
              }}>
                {logo
                  ? <img src={logo} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: '1.5rem' }}>🏛️</span>
                }
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label className="btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 12px', cursor: 'pointer', opacity: logoSaving ? 0.5 : 1 }}>
                  {logoSaving ? 'Saving…' : logo ? 'Replace' : 'Upload'}
                  <input type="file" accept="image/svg+xml,image/png,image/jpeg" onChange={handleLogoUpload} style={{ display: 'none' }} disabled={logoSaving} />
                </label>
                {logo && (
                  <button type="button" className="btn-secondary" title="Remove logo" style={{ padding: '6px 10px', color: 'var(--color-red)', display: 'inline-flex', alignItems: 'center' }} onClick={removeLogo} disabled={logoSaving}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {logoError && <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--color-red)' }}>{logoError}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Primary color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} style={{ width: 40, height: 36, border: 'none', padding: 0, cursor: 'pointer' }} />
                <input style={{ ...inputStyle, flex: 1 }} value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Title font</label>
              <select style={inputStyle} value={form.title_font} onChange={(e) => setForm((f) => ({ ...f, title_font: e.target.value }))}>
                <option>Playfair Display</option>
                <option>Inter</option>
                <option>Georgia</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            {saveMsg && <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>{saveMsg}</span>}
          </div>
        </form>
      </div>

      {/* Admins */}
      <div className="card" style={{ padding: 28 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
          Admins
        </h3>

        {(community?.members || []).filter((m) => m.isAdmin).sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '')).map((m) => {
          const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || 'Unknown'
          const isSelf = m.personId === user?.id
          return (
            <div key={m.personId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-sand)' }}>
              <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500 }}>{name}</span>
              {isSelf && <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-light)' }}>you</span>}
              <button
                title="Remove admin"
                disabled={isSelf}
                onClick={async () => {
                  if (!confirm(`Remove admin rights from ${name}?`)) return
                  try { await updateMember(communityId, m.personId, { is_admin: false }); await refresh() }
                  catch (err) { alert(err.message) }
                }}
                style={{ background: 'none', border: 'none', cursor: isSelf ? 'not-allowed' : 'pointer', color: isSelf ? 'var(--color-sand-dark)' : 'var(--color-red)', padding: '2px 4px', display: 'inline-flex', alignItems: 'center' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          )
        })}

        <div style={{ marginTop: 16 }}>
          <select
            value=""
            onChange={async (e) => {
              if (!e.target.value) return
              try { await updateMember(communityId, e.target.value, { is_admin: true }); await refresh() }
              catch (err) { alert(err.message) }
            }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-sand-dark)', fontSize: '0.88rem', background: 'white', cursor: 'pointer' }}
          >
            <option value="">+ Add admin…</option>
            {(community?.members || []).filter((m) => !m.isAdmin).sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '')).map((m) => (
              <option key={m.personId} value={m.personId}>
                {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || m.personId}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
