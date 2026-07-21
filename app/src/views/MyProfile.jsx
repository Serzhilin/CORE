import { useState, useRef } from 'react'
import { Card, Button, Input, Textarea, Label, Heading, Page } from '@ecommons/ui'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import { useSetTopBarSlot } from '../context/TopBarSlotContext'
import { updateMe, uploadProfileImage } from '../api/client'
import styles from './MyProfile.module.css'

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
    opacity: active ? 1 : 0,
  })

  return (
    <Page maxWidth={600}>
      <Card className={styles.profileCard}>
        {/* Banner */}
        <button
          type="button"
          disabled={bannerSaving}
          onClick={() => bannerFileRef.current?.click()}
          onMouseEnter={() => setBannerHover(true)}
          onMouseLeave={() => setBannerHover(false)}
          className={styles.bannerRow}
          style={{
            background: user?.bannerUrl ? undefined : 'var(--color-sand-dark)',
            opacity: bannerSaving ? 0.6 : 1,
          }}
        >
          {user?.bannerUrl && (
            <img src={user.bannerUrl} alt="banner" className={styles.bannerImg} />
          )}
          <span className={styles.camBadge} style={camBadge(bannerHover && !bannerSaving)}>
            {bannerSaving ? <span className={styles.uploadingDots}>…</span> : <CameraIcon />}
          </span>
        </button>
        <input ref={bannerFileRef} type="file" accept="image/*" className={styles.hiddenFileInput}
          onChange={handleImageUpload('banner_url', setBannerSaving, 1200)} />

        <div className={styles.profileBody}>
          {/* Avatar + display name */}
          <div className={`row ${styles.avatarRow}`}>
            <div className={styles.avatarWrap}>
              <button
                type="button"
                disabled={avatarSaving}
                onClick={() => avatarFileRef.current?.click()}
                onMouseEnter={() => setAvatarHover(true)}
                onMouseLeave={() => setAvatarHover(false)}
                className={styles.avatarButton}
              >
                <div className={styles.avatarCircle} style={{ opacity: avatarSaving ? 0.6 : 1 }}>
                  {user?.avatarUrl
                    ? <img src={user.avatarUrl} alt="avatar" className={styles.avatarImg} />
                    : (user?.displayName?.[0] || user?.firstName?.[0] || '?').toUpperCase()
                  }
                </div>
                <span className={`${styles.camBadge} ${styles.camBadgeAvatar}`} style={camBadge(avatarHover && !avatarSaving)}>
                  {avatarSaving ? <span className={styles.uploadingDots}>…</span> : <CameraIcon />}
                </span>
              </button>
              <input ref={avatarFileRef} type="file" accept="image/*" className={styles.hiddenFileInput}
                onChange={handleImageUpload('avatar_url', setAvatarSaving, 512)} />
            </div>
            <div className={styles.nameCol}>
              <div className={styles.displayName}>
                {user?.firstName || ''} {user?.lastName || ''}
              </div>
              {user?.ename && (
                <div
                  onClick={copyEname}
                  title="Click to copy"
                  className={styles.enameRow}
                >
                  eName: {user.ename}
                  {enameCopied && <span className={styles.copiedText}>Copied!</span>}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className={`stack ${styles.formStack}`}>
            {/* Display name */}
            <div>
              <Label>Display name</Label>
              <Input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
            </div>

            {/* Bio */}
            <div>
              <Label>Bio</Label>
              <Textarea className={styles.bioTextarea} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
            </div>

            {myMembership?.joinedAt && (
              <div>
                <Label>Member since</Label>
                <div className={styles.staticField}>
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

            <div className={`row ${styles.saveRow}`}>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </Button>
              {saveMsg && <span className={styles.saveMsg} style={{ color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>{saveMsg}</span>}
            </div>
          </form>
        </div>
      </Card>
    </Page>
  )
}
