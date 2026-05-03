import { useState } from 'react'
import { useCommunity } from '../../context/CommunityContext'
import { updateCommunity } from '../../api/client'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box',
}

export default function CommunityTab() {
  const { communityId, community, refresh } = useCommunity()

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
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Description</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
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
                  <button type="button" className="btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 12px', color: 'var(--color-red)' }} onClick={removeLogo} disabled={logoSaving}>
                    Remove
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

    </div>
  )
}
