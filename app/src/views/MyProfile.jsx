import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import { updateMe, setMyAvailability } from '../api/client'

export default function MyProfile() {
  const { user, refreshMe } = useUser()
  const { communityId, community, availabilityTypes, myMembership, refresh } = useCommunity()

  const [form, setForm] = useState({
    first_name: user?.firstName || '',
    last_name: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [avForm, setAvForm] = useState({
    type_id: myMembership?.availability?.type.id || '',
    reason: myMembership?.availability?.reason || '',
    until: myMembership?.availability?.until || '',
  })
  const [avSaving, setAvSaving] = useState(false)

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

  async function handleSetAvailability(e) {
    e.preventDefault()
    setAvSaving(true)
    try {
      await setMyAvailability(communityId, {
        type_id: avForm.type_id || undefined,
        reason: avForm.reason || undefined,
        until: avForm.until || undefined,
      })
      await refresh()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setAvSaving(false)
    }
  }

  async function handleClearAvailability() {
    setAvSaving(true)
    try {
      await setMyAvailability(communityId, { clear: true })
      await refresh()
      setAvForm({ type_id: '', reason: '', until: '' })
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setAvSaving(false)
    }
  }

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, avatar_url: reader.result }))
    reader.readAsDataURL(file)
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: 24 }}>My Profile</h2>

      {/* Profile form */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', color: 'var(--color-charcoal-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Personal information
        </h3>
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
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Avatar</label>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            {saveMsg && <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>{saveMsg}</span>}
          </div>
        </form>
      </div>

      {/* Availability form */}
      {communityId && (
        <div className="card" style={{ padding: 28 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '1rem', color: 'var(--color-charcoal-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Availability in {community?.name}
          </h3>
          {myMembership?.availability && (
            <div style={{ background: 'var(--color-sand)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.9rem' }}>
              Currently: {myMembership.availability.type.emoji} {myMembership.availability.type.name}
              {myMembership.availability.reason && ` — ${myMembership.availability.reason}`}
            </div>
          )}
          <form onSubmit={handleSetAvailability} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Status</label>
              <select
                style={inputStyle}
                value={avForm.type_id}
                onChange={(e) => setAvForm((f) => ({ ...f, type_id: e.target.value }))}
              >
                <option value="">Available (no status)</option>
                {availabilityTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Reason (optional)</label>
              <input style={inputStyle} value={avForm.reason} onChange={(e) => setAvForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Short note…" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Until (optional)</label>
              <input type="date" style={inputStyle} value={avForm.until} onChange={(e) => setAvForm((f) => ({ ...f, until: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn-primary" disabled={avSaving || !avForm.type_id}>
                {avSaving ? 'Saving…' : 'Set availability'}
              </button>
              {myMembership?.availability && (
                <button type="button" className="btn-secondary" onClick={handleClearAvailability} disabled={avSaving}>
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
