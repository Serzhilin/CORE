import { useState } from 'react'
import { Card, Button, Input, Select, Label, TrashIcon, SectionLabel, ErrorText, Page } from '@ecommons/ui'
import { useCommunity } from '../../context/CommunityContext'
import { useUser } from '../../context/UserContext'
import { updateCommunity, updateMember, uploadCommunityImage, uploadStatutenFile } from '../../api/client'
import W3dsLinkCard from '../../components/W3dsLinkCard'
import styles from './CommunityTab.module.css'

export default function CommunityTab() {
  const { communityId, community, refresh } = useCommunity()
  const { user } = useUser()

  const [form, setForm] = useState({
    name: community?.name || '',
    slug: community?.slug || '',
    description: community?.description || '',
    primary_color: community?.primary_color || '#E8262B',
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
    <Page maxWidth={560}>
      {/* Community settings */}
      <Card className={styles.settingsCard}>
        <SectionLabel className={styles.sectionLabelSpacing}>
          Community settings
        </SectionLabel>
        <form onSubmit={handleSave} className={`stack ${styles.gap14}`}>

          <SectionLabel as="h4" fontSize="0.78rem" className={styles.subHeading}>
            Legal information
          </SectionLabel>

          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>

          <div className={styles.formGrid}>
            <div>
              <Label>KvK number</Label>
              <Input value={form.kvk_number} onChange={(e) => setForm((f) => ({ ...f, kvk_number: e.target.value }))} />
            </div>
            <div>
              <Label>Legal form</Label>
              <Input value={form.legal_form} onChange={(e) => setForm((f) => ({ ...f, legal_form: e.target.value }))} />
            </div>
          </div>

          {/* Statuten file upload */}
          <div>
            <Label style={{ marginBottom: 'var(--space-8)' }}>Statuten</Label>
            <div className={`row ${styles.gap12}`}>
              {statutenUri && !statutenUri.startsWith('w3ds://') && (
                <a href={statutenUri} target="_blank" rel="noreferrer" className={styles.fileNote}>
                  View current file
                </a>
              )}
              {statutenUri && statutenUri.startsWith('w3ds://') && (
                <span className={styles.fileNote}>File on record</span>
              )}
              <label className={styles.fileBtn} style={{ opacity: statutenSaving ? 0.5 : 1 }}>
                {statutenSaving ? 'Uploading…' : statutenUri ? 'Replace' : 'Upload'}
                <input type="file" accept="application/pdf,.pdf,.doc,.docx" onChange={handleStatutenUpload} className={styles.hiddenFileInput} disabled={statutenSaving} />
              </label>
            </div>
            {statutenError && <ErrorText style={{ marginTop: 'var(--space-6)' }}>{statutenError}</ErrorText>}
          </div>

          <SectionLabel as="h4" fontSize="0.78rem" className={styles.subHeadingSpaced}>
            Branding
          </SectionLabel>

          <div>
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} pattern="[a-z0-9-]+" />
            <span className={styles.smallNote}>Lowercase letters, numbers, hyphens only</span>
          </div>

          {/* Logo upload */}
          <div>
            <Label style={{ marginBottom: 'var(--space-8)' }}>Logo</Label>
            <div className={`row ${styles.gap16}`}>
              <div className={styles.previewBox}>
                {logo
                  ? <img src={logo} alt="logo" className={styles.previewImgContain} />
                  : <span className={styles.emojiPlaceholder}>🏛️</span>
                }
              </div>
              <div className="row">
                <label className={styles.fileBtn} style={{ opacity: logoSaving ? 0.5 : 1 }}>
                  {logoSaving ? 'Saving…' : logo ? 'Replace' : 'Upload'}
                  <input type="file" accept="image/svg+xml,image/png,image/jpeg" onChange={handleLogoUpload} className={styles.hiddenFileInput} disabled={logoSaving} />
                </label>
                {logo && (
                  <Button type="button" variant="secondary" title="Remove logo" className={styles.dangerIconBtn} onClick={removeLogo} disabled={logoSaving}>
                    <TrashIcon />
                  </Button>
                )}
              </div>
            </div>
            {logoError && <ErrorText style={{ marginTop: 'var(--space-6)' }}>{logoError}</ErrorText>}
          </div>

          {/* Group photo upload */}
          <div>
            <Label style={{ marginBottom: 'var(--space-8)' }}>Group photo</Label>
            <div className={`row ${styles.gap16}`}>
              <div className={styles.previewBox}>
                {photo
                  ? <img src={photo} alt="group photo" className={styles.previewImgCover} />
                  : <span className={styles.emojiPlaceholder}>📷</span>
                }
              </div>
              <div className="row">
                <label className={styles.fileBtn} style={{ opacity: photoSaving ? 0.5 : 1 }}>
                  {photoSaving ? 'Saving…' : photo ? 'Replace' : 'Upload'}
                  <input type="file" accept="image/png,image/jpeg" onChange={handlePhotoUpload} className={styles.hiddenFileInput} disabled={photoSaving} />
                </label>
                {photo && (
                  <Button type="button" variant="secondary" title="Remove photo" className={styles.dangerIconBtn} onClick={removePhoto} disabled={photoSaving}>
                    <TrashIcon />
                  </Button>
                )}
              </div>
            </div>
            {photoError && <ErrorText style={{ marginTop: 'var(--space-6)' }}>{photoError}</ErrorText>}
          </div>

          <div className={styles.formGrid}>
            <div>
              <Label>Primary color</Label>
              <div className="row">
                <input type="color" value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} className={styles.colorSwatch} />
                <Input className={styles.flexInput} value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Title font</Label>
              <Select value={form.title_font} onChange={(e) => setForm((f) => ({ ...f, title_font: e.target.value }))}>
                <option>Playfair Display</option>
                <option>Inter</option>
                <option>Georgia</option>
              </Select>
            </div>
          </div>
          <div className={`row ${styles.gap12}`}>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            {saveMsg && <span className={styles.saveMsg} style={{ color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>{saveMsg}</span>}
          </div>
        </form>
      </Card>

      {/* Admins */}
      <Card className={styles.settingsCard}>
        <SectionLabel className={styles.sectionLabelSpacing}>
          Admins
        </SectionLabel>

        {(community?.members || []).filter((m) => m.isAdmin).sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '')).map((m) => {
          const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || 'Unknown'
          const isSelf = m.personId === user?.id
          return (
            <div key={m.personId} className={styles.adminRow}>
              <span className={styles.adminName}>{name}</span>
              {isSelf && <span className={styles.smallNote}>you</span>}
              <button
                title="Remove admin"
                disabled={isSelf}
                onClick={async () => {
                  if (!confirm(`Remove admin rights from ${name}?`)) return
                  try { await updateMember(communityId, m.personId, { is_admin: false }); await refresh() }
                  catch (err) { alert(err.message) }
                }}
                className={styles.adminDeleteBtn}
                style={{ cursor: isSelf ? 'not-allowed' : 'pointer', color: isSelf ? 'var(--color-sand-dark)' : 'var(--color-red)' }}
              >
                <TrashIcon />
              </button>
            </div>
          )
        })}

        <div className={styles.addAdminWrap}>
          <Select
            value=""
            onChange={async (e) => {
              if (!e.target.value) return
              try { await updateMember(communityId, e.target.value, { is_admin: true }); await refresh() }
              catch (err) { alert(err.message) }
            }}
            className={styles.addAdminSelect}
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

      <div className={styles.linkCardWrap}>
        <W3dsLinkCard communityId={communityId} community={community} onChange={refresh} />
      </div>
    </Page>
  )
}
