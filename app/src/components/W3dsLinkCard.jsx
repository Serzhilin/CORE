import { useState } from 'react'
import { resolveCommunityW3id, linkCommunityW3id, unlinkCommunityW3id } from '../api/client'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 0,
  border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box',
}

export default function W3dsLinkCard({ communityId, community, onChange }) {
  const [w3idInput, setW3idInput] = useState('')
  const [w3idPreview, setW3idPreview] = useState(null)
  const [w3idResolving, setW3idResolving] = useState(false)
  const [w3idLinking, setW3idLinking] = useState(false)
  const [w3idUnlinking, setW3idUnlinking] = useState(false)
  const [w3idError, setW3idError] = useState(null)

  async function handleResolveW3id() {
    if (!w3idInput.trim()) return
    setW3idResolving(true)
    setW3idError(null)
    setW3idPreview(null)
    try {
      const resolution = await resolveCommunityW3id(communityId, w3idInput.trim())
      setW3idPreview(resolution)
    } catch (err) {
      setW3idError(err.message)
    } finally {
      setW3idResolving(false)
    }
  }

  async function handleLinkW3id() {
    if (!w3idInput.trim()) return
    setW3idLinking(true)
    setW3idError(null)
    try {
      await linkCommunityW3id(communityId, w3idInput.trim())
      setW3idPreview(null)
      setW3idInput('')
      onChange?.()
    } catch (err) {
      setW3idError(err.message)
    } finally {
      setW3idLinking(false)
    }
  }

  async function handleUnlink() {
    if (!confirm(`Unlink this community from ${community.ename}? CORE will stop syncing to that eVault.`)) return
    setW3idUnlinking(true)
    setW3idError(null)
    try {
      await unlinkCommunityW3id(communityId)
      onChange?.()
    } catch (err) {
      setW3idError(err.message)
    } finally {
      setW3idUnlinking(false)
    }
  }

  return (
    <div className="card" style={{ padding: 28 }}>
      <h3 style={{ margin: '0 0 20px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
        W3DS identity
      </h3>

      {community?.provisioning_status === 'linked' ? (
        <div style={{ fontSize: '0.9rem' }}>
          <div>Linked to <strong>{community.ename}</strong></div>
          <div style={{ color: 'var(--color-charcoal-light)', fontSize: '0.82rem', marginTop: 4 }}>{community.evault_uri}</div>
          {w3idError && <div style={{ fontSize: '0.8rem', color: 'var(--color-red)', marginTop: 8 }}>{w3idError}</div>}
          <button type="button" className="btn-secondary" style={{ marginTop: 12, color: 'var(--color-red)' }} onClick={handleUnlink} disabled={w3idUnlinking}>
            {w3idUnlinking ? 'Unlinking…' : 'Unlink'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-charcoal-light)' }}>
            This community is local-only. Link it to an existing W3DS eName you own or administer
            to sync its identity and membership to your eVault.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="@ename or w3id"
              value={w3idInput}
              onChange={(e) => { setW3idInput(e.target.value); setW3idPreview(null) }}
            />
            <button type="button" className="btn-secondary" onClick={handleResolveW3id} disabled={w3idResolving || !w3idInput.trim()}>
              {w3idResolving ? 'Resolving…' : 'Preview'}
            </button>
          </div>

          {w3idError && <div style={{ fontSize: '0.8rem', color: 'var(--color-red)' }}>{w3idError}</div>}

          {w3idPreview && (
            <div style={{ border: '1px solid var(--color-sand)', borderRadius: 0, padding: 14, fontSize: '0.85rem' }}>
              {w3idPreview.envelope ? (
                <>
                  <div><strong>{w3idPreview.envelope.name || w3idPreview.w3id}</strong></div>
                  {w3idPreview.envelope.description && <div style={{ marginTop: 4 }}>{w3idPreview.envelope.description}</div>}
                </>
              ) : (
                <div>No existing group identity found — a new one will be created with you as owner.</div>
              )}
              <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={handleLinkW3id} disabled={w3idLinking}>
                {w3idLinking ? 'Linking…' : `Confirm link to ${w3idPreview.w3id}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
