import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import { updateMe } from '../api/client'

export default function MyProfile() {
  const { user, refreshMe } = useUser()
  const { myMembership } = useCommunity()

  const [form, setForm] = useState({
    first_name: user?.firstName || '',
    last_name: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)

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

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result
      setAvatarSaving(true)
      try {
        await updateMe({ avatar_url: dataUrl })
        await refreshMe()
      } catch (err) {
        alert('Avatar save failed: ' + err.message)
      } finally {
        setAvatarSaving(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: 24 }}>My Profile</h2>

      {/* Profile form */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 24 }}>
          {/* Avatar circle */}
          <label style={{ cursor: 'pointer', flexShrink: 0 }} title={avatarSaving ? 'Saving…' : 'Click to change avatar'}>
            <div style={{
              width: 88, height: 88, borderRadius: '50%', overflow: 'hidden',
              background: 'var(--color-sand-dark)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: 'white',
              border: '3px solid var(--color-sand)', opacity: avatarSaving ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}>
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (user?.firstName?.[0] || '?').toUpperCase()
              }
            </div>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} disabled={avatarSaving} />
          </label>
          <div style={{ paddingTop: 6 }}>
            <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--font-title)', fontSize: '1.2rem' }}>
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Your profile'}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>Click photo to change</span>
          </div>
        </div>
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>First name</label>
              <input style={inputStyle} value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Last name</label>
              <input style={inputStyle} value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Email</label>
            <input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Phone</label>
            <input style={inputStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
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
          {user?.ename && (
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>W3DS identity (eName)</label>
              <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-sand)', background: 'var(--color-cream)', fontSize: '0.88rem', color: 'var(--color-charcoal-light)', fontFamily: 'monospace' }}>
                {user.ename}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            {saveMsg && <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>{saveMsg}</span>}
          </div>
        </form>
      </div>

    </div>
  )
}
