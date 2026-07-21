import { useState } from 'react'
import { Card, Button, EmojiPicker, Input, Select, Label, TrashIcon, SectionLabel, Page } from '@ecommons/ui'
import { useCommunity } from '../../context/CommunityContext'
import {
  createAvailabilityType, updateAvailabilityType, archiveAvailabilityType,
  setMemberAvailability,
} from '../../api/client'
import styles from './AvailabilityTab.module.css'

export default function AvailabilityTab() {
  const { communityId, community, availabilityTypes, refresh } = useCommunity()

  // Types CRUD
  const [atForm, setAtForm] = useState({ name: '', emoji: '' })
  const [atSaving, setAtSaving] = useState(false)
  const [editingAt, setEditingAt] = useState(null)

  // Member availability form
  const [avForm, setAvForm] = useState({ personId: '', type_id: '', reason: '', until: '' })
  const [avSaving, setAvSaving] = useState(false)

  const unavailableMembers = (community?.members || [])
    .filter(m => m.availability)
    .sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''))

  async function handleAddType(e) {
    e.preventDefault()
    if (!atForm.name || !atForm.emoji) return
    setAtSaving(true)
    try {
      await createAvailabilityType(communityId, atForm)
      await refresh()
      setAtForm({ name: '', emoji: '' })
    } catch (err) { alert('Error: ' + err.message) }
    finally { setAtSaving(false) }
  }

  async function handleUpdateType(id, data) {
    try { await updateAvailabilityType(communityId, id, data); await refresh(); setEditingAt(null) }
    catch (err) { alert('Error: ' + err.message) }
  }

  async function handleArchiveType(id) {
    if (!confirm('Archive this availability type?')) return
    try { await archiveAvailabilityType(communityId, id); await refresh() }
    catch (err) { alert(err.message) }
  }

  async function handleSetAvailability(e) {
    e.preventDefault()
    if (!avForm.personId || !avForm.type_id) return
    setAvSaving(true)
    try {
      await setMemberAvailability(communityId, avForm.personId, {
        type_id: avForm.type_id,
        reason: avForm.reason || null,
        until: avForm.until || null,
      })
      await refresh()
      setAvForm({ personId: '', type_id: '', reason: '', until: '' })
    } catch (err) { alert(err.message) }
    finally { setAvSaving(false) }
  }

  async function handleClearAvailability(personId) {
    try { await setMemberAvailability(communityId, personId, { clear: true }); await refresh() }
    catch (err) { alert(err.message) }
  }

  async function handleEditAvailability(m) {
    setAvForm({
      personId: m.personId,
      type_id: m.availability.type.id,
      reason: m.availability.reason || '',
      until: m.availability.until ? m.availability.until.slice(0, 10) : '',
    })
  }

  const trashIcon = (
    <TrashIcon />
  )

  return (
    <Page maxWidth={680} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>

      {/* Currently unavailable */}
      <Card className={styles.sectionCard}>
        <SectionLabel className={styles.sectionLabelMb16}>
          Currently unavailable
        </SectionLabel>
        {unavailableMembers.length === 0 ? (
          <p className={styles.emptyNote}>Everyone is available.</p>
        ) : (
          unavailableMembers.map((m, i) => {
            const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || 'Unknown'
            const isLast = i === unavailableMembers.length - 1
            return (
              <div key={m.personId} className={`row ${styles.listRow} ${isLast ? styles.listRowLast : ''}`}>
                <span className={`emoji-mono ${styles.emojiText}`}>{m.availability.type.emoji}</span>
                <div className={styles.flexGrow}>
                  <span className={styles.memberName}>{name}</span>
                  <span className={styles.typeName}>{m.availability.type.name}</span>
                  {m.availability.reason && <span className={styles.reasonText}>— {m.availability.reason}</span>}
                  {m.availability.until && <span className={styles.untilText}>until {new Date(m.availability.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                </div>
                <Button onClick={() => handleEditAvailability(m)} variant="secondary" className={styles.btnEditSm}>Edit</Button>
                <button onClick={() => handleClearAvailability(m.personId)} title="Clear availability" className={styles.iconBtnDanger}>{trashIcon}</button>
              </div>
            )
          })
        )}

        {/* Set availability form */}
        <div className={styles.formSection}>
          <SectionLabel as="h4" fontSize="0.85rem" className={styles.sectionLabelMb12}>
            {avForm.personId ? 'Edit availability' : 'Set availability'}
          </SectionLabel>
          <form onSubmit={handleSetAvailability} className={`stack ${styles.form}`}>
            <div>
              <Label size="sm">Member</Label>
              <Select value={avForm.personId} onChange={(e) => setAvForm(f => ({ ...f, personId: e.target.value }))} required>
                <option value="">Select…</option>
                {[...(community?.members || [])].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '')).map(m => (
                  <option key={m.personId} value={m.personId}>
                    {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || m.personId}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label size="sm">Type</Label>
              <Select value={avForm.type_id} onChange={(e) => setAvForm(f => ({ ...f, type_id: e.target.value }))} required>
                <option value="">Select…</option>
                {availabilityTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label size="sm">Reason</Label>
              <Input className={styles.fullWidth} value={avForm.reason} onChange={(e) => setAvForm(f => ({ ...f, reason: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <Label size="sm">Until</Label>
              <Input type="date" className={styles.fullWidth} value={avForm.until} onChange={(e) => setAvForm(f => ({ ...f, until: e.target.value }))} />
            </div>
            <div className={`row ${styles.actionsGap6}`}>
              <Button type="submit" disabled={avSaving || !avForm.personId || !avForm.type_id} className={styles.btnMd}>
                {avForm.personId && unavailableMembers.some(m => m.personId === avForm.personId) ? 'Update' : 'Set'}
              </Button>
              {avForm.personId && (
                <Button type="button" variant="secondary" onClick={() => setAvForm({ personId: '', type_id: '', reason: '', until: '' })} className={styles.btnMd}>Cancel</Button>
              )}
            </div>
          </form>
        </div>
      </Card>

      {/* Availability types */}
      <Card className={styles.sectionCard}>
        <SectionLabel className={styles.sectionLabelMb20}>
          Availability types
        </SectionLabel>
        <div className={styles.typesListWrap}>
          {availabilityTypes.map((t) => (
            <div key={t.id} className={`row ${styles.typeRow}`}>
              {editingAt?.id === t.id ? (
                <>
                  <EmojiPicker value={editingAt.emoji} onChange={(emoji) => setEditingAt((a) => ({ ...a, emoji }))} />
                  <Input value={editingAt.name} onChange={(e) => setEditingAt((a) => ({ ...a, name: e.target.value }))} className={styles.flexGrow} />
                  <Button className={styles.btnEditType} onClick={() => handleUpdateType(t.id, { name: editingAt.name, emoji: editingAt.emoji })}>Save</Button>
                  <Button variant="secondary" className={styles.btnEditType} onClick={() => setEditingAt(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <span className={`emoji-mono ${styles.emojiText}`}>{t.emoji}</span>
                  <span className={styles.flexGrow}>{t.name}</span>
                  <Button variant="secondary" className={styles.btnEditSm} onClick={() => setEditingAt({ id: t.id, name: t.name, emoji: t.emoji })}>Edit</Button>
                  <button className={styles.archiveBtn} onClick={() => handleArchiveType(t.id)}>Archive</button>
                </>
              )}
            </div>
          ))}
          {availabilityTypes.length === 0 && (
            <p className={styles.noTypesNote}>No availability types yet.</p>
          )}
        </div>
        <form onSubmit={handleAddType} className="row">
          <EmojiPicker value={atForm.emoji} onChange={(emoji) => setAtForm((f) => ({ ...f, emoji }))} />
          <Input placeholder="Name" value={atForm.name} onChange={(e) => setAtForm((f) => ({ ...f, name: e.target.value }))} className={styles.flexGrow} />
          <Button type="submit" disabled={atSaving || !atForm.name || !atForm.emoji} className={styles.btnMd}>Add</Button>
        </form>
      </Card>

    </Page>
  )
}
