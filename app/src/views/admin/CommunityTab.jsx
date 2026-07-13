import { useState } from 'react'
import { Card, Button, Input, Select } from '@ecommons/ui'
import { useCommunity } from '../../context/CommunityContext'
import { useUser } from '../../context/UserContext'
import { updateCommunity, updateMember, uploadCommunityImage, uploadStatutenFile } from '../../api/client'
import W3dsLinkCard from '../../components/W3dsLinkCard'

export default function CommunityTab() {
  const { communityId, community, refresh } = useCommunity()
  const { user } = useUser()

  const [form, setForm] = useState({
    name: community?.name || '',
    slug: community?.slug || '',
    description: community?.description || '',
    primary_color: community?.primary_color || '#C4622D',
    title_font: community?.title_font || 'Playfair Display',
    kvk_number: community?.kvk_number || '',
    legal_form: community?.legal_form || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [logo, setLogo] = useState(community?.logo_url || null)
  const [logoSaving, setLogoSaving] = useState(false)
  const [logoError, setLogoError] = useState(null)

  const [photo, setPhoto] = useState(community?.photo_url || null)
  const [photoSaving, setPhotoSaving] = useState(false)
  const [photoError, setPhotoError] = useState(null)

  const [statutenUri, setStatutenUri] = useState(community?.statuten_file_uri || null)
  const [statutenSaving, setStatutenSaving] = useState(false)
  const [statutenError, setStatutenError] = useState(null)

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

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoError(null)
    setLogoSaving(true)
    try {
      const updated = await uploadCommunityImage(communityId, 'logo_url', file)
      setLogo(updated.logo_url)
      await refresh()
    } catch (err) {
      setLogoError(err.message)
    } finally {
      setLogoSaving(false)
    }
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

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoError(null)
    setPhotoSaving(true)
    try {
      const updated = await uploadCommunityImage(communityId, 'photo_url', file, 1200)
      setPhoto(updated.photo_url)
      await refresh()
    } catch (err) {
      setPhotoError(err.message)
    } finally {
      setPhotoSaving(false)
    }
  }

  async function removePhoto() {
    setPhotoError(null)
    setPhotoSaving(true)
    try {
      setPhoto(null)
      await updateCommunity(communityId, { photo_url: null })
      await refresh()
    } catch (err) {
      setPhotoError(err.message)
      setPhoto(community?.photo_url || null)
    } finally {
      setPhotoSaving(false)
    }
  }

  async function handleStatutenUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStatutenError(null)
    setStatutenSaving(true)
    try {
      const result = await uploadStatutenFile(communityId, file)
      setStatutenUri(result.url)
      await refresh()
    } catch (err) {
      setStatutenError(err.message)
    } finally {
      setStatutenSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Community settings */}
      <Card style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
          Community settings
        </h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <h4 style={{ margin: '0 0 -4px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
            Legal information
          </h4>

          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Name</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>KvK number</label>
              <Input value={form.kvk_number} onChange={(e) => setForm((f) => ({ ...f, kvk_number: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Legal form</label>
              <Input value={form.legal_form} onChange={(e) => setForm((f) => ({ ...f, legal_form: e.target.value }))} />
            </div>
          </div>

          {/* Statuten file upload */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', fontWeight: 500 }}>Statuten</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {statutenUri && !statutenUri.startsWith('w3ds://') && (
                <a href={statutenUri} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-light)' }}>
                  View current file
                </a>
              )}
              {statutenUri && statutenUri.startsWith('w3ds://') && (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-light)' }}>File on record</span>
              )}
              <label className="btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 12px', cursor: 'pointer', opacity: statutenSaving ? 0.5 : 1 }}>
                {statutenSaving ? 'Uploading…' : statutenUri ? 'Replace' : 'Upload'}
                <input type="file" accept="application/pdf,.pdf,.doc,.docx" onChange={handleStatutenUpload} style={{ display: 'none' }} disabled={statutenSaving} />
              </label>
            </div>
            {statutenError && <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--color-red)' }}>{statutenError}</div>}
          </div>

          <h4 style={{ margin: '10px 0 -4px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
            Branding
          </h4>

          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Slug</label>
            <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} pattern="[a-z0-9-]+" />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-light)' }}>Lowercase letters, numbers, hyphens only</span>
          </div>

          {/* Logo upload */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', fontWeight: 500 }}>Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 80, height: 48, border: '1px solid var(--color-sand)', borderRadius: 0,
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
                  <Button type="button" variant="secondary" title="Remove logo" style={{ padding: '6px 10px', color: 'var(--color-red)', display: 'inline-flex', alignItems: 'center' }} onClick={removeLogo} disabled={logoSaving}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </Button>
                )}
              </div>
            </div>
            {logoError && <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--color-red)' }}>{logoError}</div>}
          </div>

          {/* Group photo upload */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', fontWeight: 500 }}>Group photo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 80, height: 48, border: '1px solid var(--color-sand)', borderRadius: 0,
                background: 'var(--color-cream)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
              }}>
                {photo
                  ? <img src={photo} alt="group photo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '1.5rem' }}>📷</span>
                }
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label className="btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 12px', cursor: 'pointer', opacity: photoSaving ? 0.5 : 1 }}>
                  {photoSaving ? 'Saving…' : photo ? 'Replace' : 'Upload'}
                  <input type="file" accept="image/png,image/jpeg" onChange={handlePhotoUpload} style={{ display: 'none' }} disabled={photoSaving} />
                </label>
                {photo && (
                  <Button type="button" variant="secondary" title="Remove photo" style={{ padding: '6px 10px', color: 'var(--color-red)', display: 'inline-flex', alignItems: 'center' }} onClick={removePhoto} disabled={photoSaving}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </Button>
                )}
              </div>
            </div>
            {photoError && <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--color-red)' }}>{photoError}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Primary color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} style={{ width: 40, height: 36, border: 'none', padding: 0, cursor: 'pointer' }} />
                <Input style={{ flex: 1 }} value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Title font</label>
              <Select value={form.title_font} onChange={(e) => setForm((f) => ({ ...f, title_font: e.target.value }))}>
                <option>Playfair Display</option>
                <option>Inter</option>
                <option>Georgia</option>
              </Select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            {saveMsg && <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>{saveMsg}</span>}
          </div>
        </form>
      </Card>

      {/* Admins */}
      <Card style={{ padding: 28, marginBottom: 24 }}>
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
          <Select
            value=""
            onChange={async (e) => {
              if (!e.target.value) return
              try { await updateMember(communityId, e.target.value, { is_admin: true }); await refresh() }
              catch (err) { alert(err.message) }
            }}
            style={{ width: 'auto', padding: '8px 12px', fontSize: '0.88rem', cursor: 'pointer' }}
          >
            <option value="">+ Add admin…</option>
            {(community?.members || []).filter((m) => !m.isAdmin).sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '')).map((m) => (
              <option key={m.personId} value={m.personId}>
                {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || m.personId}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <div style={{ marginBottom: 24 }}>
        <W3dsLinkCard communityId={communityId} community={community} onChange={refresh} />
      </div>
    </div>
  )
}
