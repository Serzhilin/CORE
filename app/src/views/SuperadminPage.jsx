import { useState, useEffect, useCallback } from 'react'
import { Card, Button, Input, Badge, Loading, SectionLabel, ErrorText, Heading, Page } from '@ecommons/ui'
import { useUser } from '../context/UserContext'
import LoginScreen from '../components/LoginScreen'
import W3dsLinkCard from '../components/W3dsLinkCard'
import { adminListAllCommunities, adminResolveEname, adminCreateCommunity } from '../api/client'
import styles from './SuperadminPage.module.css'

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
    <Card className={styles.addCard}>
      <SectionLabel className={styles.addCardLabel}>
        Add community from existing eName
      </SectionLabel>

      <div className={`stack ${styles.formStack}`}>
        <div className="row">
          <Input
            className={styles.enameInput}
            placeholder="@ename or w3id"
            value={enameInput}
            onChange={(e) => { setEnameInput(e.target.value); setPreview(null) }}
          />
          <Button type="button" variant="secondary" onClick={handlePreview} disabled={resolving || !enameInput.trim()}>
            {resolving ? 'Resolving…' : 'Preview'}
          </Button>
        </div>

        {error && <ErrorText>{error}</ErrorText>}

        {preview && (
          <div className={`stack ${styles.formStack} ${styles.previewBox}`}>
            <div>
              <strong>{preview.envelope.name}</strong>
              {preview.envelope.description && <div className={styles.previewDescription}>{preview.envelope.description}</div>}
            </div>
            <label className={styles.slugLabel}>
              Slug
              <Input
                className={styles.slugInput}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </label>
            <Button type="button" onClick={handleCreate} disabled={creating || !slug.trim()}>
              {creating ? 'Creating…' : `Create community linked to ${preview.w3id}`}
            </Button>
          </div>
        )}
      </div>
    </Card>
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
      <div className={styles.loadingFill}>
        <Loading />
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onSuccess={(token, person, memberships, ipa) => login(token, person, memberships, ipa)} />
  }

  if (!isPlatformAdmin) {
    return (
      <div className={styles.accessDenied}>
        Platform admin access required.
      </div>
    )
  }

  return (
    <Page maxWidth={720} style={{ padding: 'var(--space-32)', fontFamily: 'var(--font-sans)' }}>
      <Heading as="h1" className={styles.heading}>Superadmin — Communities</Heading>

      {listError && <div className={styles.listError}>{listError}</div>}

      <AddCommunityCard onCreated={refresh} />

      {communities.map((c) => (
        <Card key={c.id} className={styles.communityCard}>
          <div
            className={`row ${styles.communityRow}`}
            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
          >
            <div>
              <div className={styles.communityName}>{c.name}</div>
              <div className={styles.communitySlug}>/{c.slug}</div>
            </div>
            <Badge variant={c.provisioning_status === 'linked' ? 'green' : 'gray'}>
              {c.provisioning_status === 'linked' ? `linked · ${c.ename}` : 'local only'}
            </Badge>
          </div>

          {expandedId === c.id && (
            <div className={styles.expandedWrap}>
              <W3dsLinkCard communityId={c.id} community={c} onChange={refresh} />
            </div>
          )}
        </Card>
      ))}

      {communities.length === 0 && !listError && (
        <p className={styles.emptyState}>No communities yet.</p>
      )}
    </Page>
  )
}
