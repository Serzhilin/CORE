import { useState } from 'react'
import { Card, Button, Input, SectionLabel, ErrorText } from '@ecommons/ui'
import { resolveCommunityW3id, linkCommunityW3id, unlinkCommunityW3id } from '../api/client'
import styles from './W3dsLinkCard.module.css'

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
    <Card className={styles.card}>
      <SectionLabel className={styles.sectionLabelGap}>
        W3DS identity
      </SectionLabel>

      {community?.provisioning_status === 'linked' ? (
        <div className={styles.linkedInfo}>
          <div>Linked to <strong>{community.ename}</strong></div>
          <div className={styles.evaultUri}>{community.evault_uri}</div>
          {w3idError && <ErrorText className={styles.errorGapTop}>{w3idError}</ErrorText>}
          <Button type="button" variant="secondary" className={styles.unlinkButton} onClick={handleUnlink} disabled={w3idUnlinking}>
            {w3idUnlinking ? 'Unlinking…' : 'Unlink'}
          </Button>
        </div>
      ) : (
        <div className={`stack ${styles.formStack}`}>
          <p className={styles.description}>
            This community is local-only. Link it to an existing W3DS eName you own or administer
            to sync its identity and membership to your eVault.
          </p>
          <div className={styles.actionRow}>
            <Input
              className={styles.flexInput}
              placeholder="@ename or w3id"
              value={w3idInput}
              onChange={(e) => { setW3idInput(e.target.value); setW3idPreview(null) }}
            />
            <Button type="button" variant="secondary" onClick={handleResolveW3id} disabled={w3idResolving || !w3idInput.trim()}>
              {w3idResolving ? 'Resolving…' : 'Preview'}
            </Button>
          </div>

          {w3idError && <ErrorText>{w3idError}</ErrorText>}

          {w3idPreview && (
            <div className={styles.previewBox}>
              {w3idPreview.envelope ? (
                <>
                  <div><strong>{w3idPreview.envelope.name || w3idPreview.w3id}</strong></div>
                  {w3idPreview.envelope.description && <div className={styles.previewDescription}>{w3idPreview.envelope.description}</div>}
                </>
              ) : (
                <div>No existing group identity found — a new one will be created with you as owner.</div>
              )}
              <Button type="button" className={styles.confirmButton} onClick={handleLinkW3id} disabled={w3idLinking}>
                {w3idLinking ? 'Linking…' : `Confirm link to ${w3idPreview.w3id}`}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
