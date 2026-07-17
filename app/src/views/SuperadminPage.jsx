import { useState, useEffect, useCallback } from 'react'
import { Card, Button, Input, Badge, Loading, SectionLabel, ErrorText } from '@ecommons/ui'
import { useUser } from '../context/UserContext'
import LoginScreen from '../components/LoginScreen'
import W3dsLinkCard from '../components/W3dsLinkCard'
import { adminListAllCommunities, adminResolveEname, adminCreateCommunity } from '../api/client'

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
    <Card style={{ padding: 'var(--space-28)', marginBottom: 'var(--space-24)' }}>
      <SectionLabel style={{ margin: '0 0 var(--space-20)' }}>
        Add community from existing eName
      </SectionLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
          <Input
            style={{ flex: 1 }}
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
          <div style={{ border: '1px solid var(--color-sand)', borderRadius: 0, padding: 'var(--space-14)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
            <div>
              <strong>{preview.envelope.name}</strong>
              {preview.envelope.description && <div style={{ marginTop: 'var(--space-4)' }}>{preview.envelope.description}</div>}
            </div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>
              Slug
              <Input
                style={{ marginTop: 'var(--space-4)' }}
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
      <Loading style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'var(--font-sans)' }} />
    )
  }

  if (!user) {
    return <LoginScreen onSuccess={(token, person, memberships, ipa) => login(token, person, memberships, ipa)} />
  }

  if (!isPlatformAdmin) {
    return (
      <div style={{ padding: 'var(--space-32)', fontFamily: 'var(--font-sans)', color: 'var(--color-red)' }}>
        Platform admin access required.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-32)', fontFamily: 'var(--font-sans)' }}>
      <h1 style={{ fontFamily: 'var(--font-title)', margin: '0 0 var(--space-24)' }}>Superadmin — Communities</h1>

      {listError && <div style={{ color: 'var(--color-red)', marginBottom: 'var(--space-16)' }}>{listError}</div>}

      <AddCommunityCard onCreated={refresh} />

      {communities.map((c) => (
        <Card key={c.id} style={{ padding: '14px 18px', marginBottom: 'var(--space-10)' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-charcoal-light)' }}>/{c.slug}</div>
            </div>
            <Badge variant={c.provisioning_status === 'linked' ? 'green' : 'gray'}>
              {c.provisioning_status === 'linked' ? `linked · ${c.ename}` : 'local only'}
            </Badge>
          </div>

          {expandedId === c.id && (
            <div style={{ marginTop: 'var(--space-16)' }}>
              <W3dsLinkCard communityId={c.id} community={c} onChange={refresh} />
            </div>
          )}
        </Card>
      ))}

      {communities.length === 0 && !listError && (
        <p style={{ color: 'var(--color-charcoal-light)' }}>No communities yet.</p>
      )}
    </div>
  )
}
