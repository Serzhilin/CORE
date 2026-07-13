import { useState, useRef } from 'react'
import { Card, Button, Input, Textarea, Label, Heading, Page } from '@ecommons/ui'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import { useSetTopBarSlot } from '../context/TopBarSlotContext'
import { updateMe, uploadProfileImage } from '../api/client'

const CameraIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
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
    website: user?.website || '',
    location: user?.location || '',
    birthDate: user?.birthDate || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [bannerSaving, setBannerSaving] = useState(false)
  const [avatarHover, setAvatarHover] = useState(false)
  const [bannerHover, setBannerHover] = useState(false)
  const [enameCopied, setEnameCopied] = useState(false)
  const avatarFileRef = useRef(null)
  const bannerFileRef = useRef(null)

  useSetTopBarSlot(
    <Heading>My profile</Heading>
  )

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

  function handleImageUpload(field, setImageSaving, maxPx) {
    return (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      setImageSaving(true)
      uploadProfileImage(field, file, maxPx)
        .then(() => refreshMe())
        .catch((err) => alert('Upload failed: ' + err.message))
        .finally(() => setImageSaving(false))
    }
  }

  function copyEname() {
    if (!user?.ename) return
    navigator.clipboard.writeText(user.ename)
    setEnameCopied(true)
    setTimeout(() => setEnameCopied(false), 1500)
  }

  const camBadge = (active) => ({
    position: 'absolute', bottom: 6, right: 6,
    width: 28, height: 28, borderRadius: '50%',
    background: 'rgba(0,0,0,0.55)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
    opacity: active ? 1 : 0,
    transition: 'opacity 0.15s',
  })

  return (
    <Page maxWidth={600}>
      <Card style={{ overflow: 'hidden', marginBottom: 24 }}>
        {/* Banner */}
        <button
          type="button"
          disabled={bannerSaving}
          onClick={() => bannerFileRef.current?.click()}
          onMouseEnter={() => setBannerHover(true)}
          onMouseLeave={() => setBannerHover(false)}
          style={{
            position: 'relative', display: 'block', width: '100%', height: 140,
            border: 'none', padding: 0, cursor: 'pointer', overflow: 'hidden',
            background: user?.bannerUrl ? undefined : 'var(--color-sand-dark)',
            opacity: bannerSaving ? 0.6 : 1, transition: 'opacity 0.15s',
          }}
        >
          {user?.bannerUrl && (
            <img src={user.bannerUrl} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
          <span style={camBadge(bannerHover && !bannerSaving)}>
            {bannerSaving ? <span style={{ fontSize: 11 }}>…</span> : <CameraIcon />}
          </span>
        </button>
        <input ref={bannerFileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={handleImageUpload('banner_url', setBannerSaving, 1200)} />

        <div style={{ padding: 28 }}>
          {/* Avatar + display name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: -56, marginBottom: 20 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                disabled={avatarSaving}
                onClick={() => avatarFileRef.current?.click()}
                onMouseEnter={() => setAvatarHover(true)}
                onMouseLeave={() => setAvatarHover(false)}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  position: 'relative', display: 'block', borderRadius: '50%',
                }}
              >
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
                <span style={{ ...camBadge(avatarHover && !avatarSaving), bottom: 4, right: 4 }}>
                  {avatarSaving ? <span style={{ fontSize: 11 }}>…</span> : <CameraIcon />}
                </span>
              </button>
              <input ref={avatarFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={handleImageUpload('avatar_url', setAvatarSaving, 512)} />
            </div>
            <div style={{ flex: 1, paddingTop: 32 }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                {user?.firstName || ''} {user?.lastName || ''}
              </div>
              {user?.ename && (
                <div
                  onClick={copyEname}
                  title="Click to copy"
                  style={{
                    marginTop: 4, fontFamily: 'monospace', fontSize: '0.85rem',
                    color: 'var(--color-charcoal-light)', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                  }}
                >
                  eName: {user.ename}
                  {enameCopied && <span style={{ fontSize: '0.75rem', color: 'var(--color-green)' }}>Copied!</span>}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Display name */}
            <div>
              <Label>Display name</Label>
              <Input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
            </div>

            {/* Bio */}
            <div>
              <Label>Bio</Label>
              <Textarea style={{ minHeight: 80 }} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
            </div>

            {myMembership?.joinedAt && (
              <div>
                <Label>Member since</Label>
                <div style={{ padding: '10px 14px', borderRadius: 0, border: '1px solid var(--color-sand)', background: 'var(--color-cream)', fontSize: '0.9rem', color: 'var(--color-charcoal-light)' }}>
                  {new Date(myMembership.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            )}

            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <Label>Date of birth</Label>
              <Input type="date" value={form.birthDate} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </Button>
              {saveMsg && <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>{saveMsg}</span>}
            </div>
          </form>
        </div>
      </Card>
    </Page>
  )
}
