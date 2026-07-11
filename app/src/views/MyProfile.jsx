import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import { updateMe, uploadProfileImage } from '../api/client'

const NOT_SYNCED_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 5, verticalAlign: 'middle', color: 'var(--color-charcoal-light)' }}>
    <path d="M4 4l16 16" />
    <path d="M9.5 5.5A5 5 0 0 1 20 8a4 4 0 0 1-1 7.9" />
    <path d="M6.5 6.8A4.5 4.5 0 0 0 7 15.5H16" />
  </svg>
)

export default function MyProfile() {
  const { user, refreshMe } = useUser()
  const { myMembership } = useCommunity()

  const [form, setForm] = useState({
    display_name: user?.displayName || '',
    bio: user?.bio || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [bannerSaving, setBannerSaving] = useState(false)

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white',
    boxSizing: 'border-box',
  }
  const readOnlyStyle = {
    padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-sand)',
    background: 'var(--color-cream)', fontSize: '0.9rem', color: 'var(--color-charcoal-light)',
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    try {
      await updateMe(form)
      await refreshMe()
      setSaveMsg('Saved!')
    } catch (err) {
      setSaveMsg('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleImageUpload(field, setImageSaving) {
    return (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      setImageSaving(true)
      uploadProfileImage(field, file)
        .then(() => refreshMe())
        .catch((err) => alert('Upload failed: ' + err.message))
        .finally(() => setImageSaving(false))
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: 24 }}>My Profile</h2>

      <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
        {/* Banner */}
        <label style={{ cursor: 'pointer', display: 'block' }} title={bannerSaving ? 'Saving…' : 'Click to change banner'}>
          <div style={{
            width: '100%', height: 140, background: user?.bannerUrl ? undefined : 'var(--color-sand-dark)',
            opacity: bannerSaving ? 0.6 : 1, transition: 'opacity 0.15s',
          }}>
            {user?.bannerUrl && (
              <img src={user.bannerUrl} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
          </div>
          <input type="file" accept="image/*" onChange={handleImageUpload('banner_url', setBannerSaving)} style={{ display: 'none' }} disabled={bannerSaving} />
        </label>

        <div style={{ padding: 28 }}>
          {/* Avatar + display name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: -56, marginBottom: 20 }}>
            <label style={{ cursor: 'pointer', flexShrink: 0 }} title={avatarSaving ? 'Saving…' : 'Click to change avatar'}>
              <div style={{
                width: 88, height: 88, borderRadius: '50%', overflow: 'hidden',
                background: 'var(--color-sand-dark)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: 'white',
                border: '3px solid white', opacity: avatarSaving ? 0.6 : 1, transition: 'opacity 0.15s',
              }}>
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (user?.displayName?.[0] || user?.firstName?.[0] || '?').toUpperCase()
                }
              </div>
              <input type="file" accept="image/*" onChange={handleImageUpload('avatar_url', setAvatarSaving)} style={{ display: 'none' }} disabled={avatarSaving} />
            </label>
            <div style={{ flex: 1, paddingTop: 32 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Display name</label>
              <input style={inputStyle} value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
            </div>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Bio */}
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Bio</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
            </div>

            {myMembership?.joinedAt && (
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Member since</label>
                <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-sand)', background: 'var(--color-cream)', fontSize: '0.9rem', color: 'var(--color-charcoal-light)' }}>
                  {new Date(myMembership.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            )}

            {/* Read-only detail card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>First name</label>
                <div style={readOnlyStyle}>{user?.firstName || '—'}</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Last name</label>
                <div style={readOnlyStyle}>{user?.lastName || '—'}</div>
              </div>
            </div>
            {user?.ename && (
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>W3DS identity (eName)</label>
                <div style={{ ...readOnlyStyle, fontFamily: 'monospace', fontSize: '0.88rem' }}>{user.ename}</div>
              </div>
            )}

            {/* Email / phone — DB-only, not synced */}
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>
                Email
                <span title="Not synced to eVault">{NOT_SYNCED_ICON}</span>
              </label>
              <input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>
                Phone
                <span title="Not synced to eVault">{NOT_SYNCED_ICON}</span>
              </label>
              <input style={inputStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              {saveMsg && <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>{saveMsg}</span>}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
