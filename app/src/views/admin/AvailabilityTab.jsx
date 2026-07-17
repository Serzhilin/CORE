import { useState } from 'react'
import { Card, Button, EmojiPicker, Input, Select, Label, TrashIcon, SectionLabel, Page } from '@ecommons/ui'
import { useCommunity } from '../../context/CommunityContext'
import {
  createAvailabilityType, updateAvailabilityType, archiveAvailabilityType,
  setMemberAvailability,
} from '../../api/client'

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
      <Card style={{ padding: 'var(--space-28)' }}>
        <SectionLabel style={{ margin: '0 0 var(--space-16)' }}>
          Currently unavailable
        </SectionLabel>
        {unavailableMembers.length === 0 ? (
          <p style={{ color: 'var(--color-charcoal-light)', fontSize: '0.9rem', margin: 0 }}>Everyone is available.</p>
        ) : (
          unavailableMembers.map((m, i) => {
            const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || 'Unknown'
            const isLast = i === unavailableMembers.length - 1
            return (
              <div key={m.personId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', padding: 'var(--space-8) 0', borderBottom: isLast ? 'none' : '1px solid var(--color-sand)' }}>
                <span className="emoji-mono" style={{ fontSize: '1.1rem' }}>{m.availability.type.emoji}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{name}</span>
                  <span style={{ marginLeft: 'var(--space-8)', fontSize: '0.82rem', color: 'var(--color-charcoal-light)' }}>{m.availability.type.name}</span>
                  {m.availability.reason && <span style={{ marginLeft: 'var(--space-6)', fontSize: '0.82rem', color: 'var(--color-charcoal-light)' }}>— {m.availability.reason}</span>}
                  {m.availability.until && <span style={{ marginLeft: 'var(--space-6)', fontSize: '0.78rem', color: 'var(--color-charcoal-light)' }}>until {new Date(m.availability.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                </div>
                <Button onClick={() => handleEditAvailability(m)} variant="secondary" style={{ fontSize: '0.75rem', padding: 'var(--space-3) var(--space-8)' }}>Edit</Button>
                <button onClick={() => handleClearAvailability(m.personId)} title="Clear availability" style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', padding: 'var(--space-2) var(--space-4)', display: 'inline-flex', alignItems: 'center' }}>{trashIcon}</button>
              </div>
            )
          })
        )}

        {/* Set availability form */}
        <div style={{ marginTop: 'var(--space-20)', paddingTop: 'var(--space-16)', borderTop: '1px solid var(--color-sand)' }}>
          <SectionLabel as="h4" fontSize="0.85rem" style={{ margin: '0 0 var(--space-12)' }}>
            {avForm.personId ? 'Edit availability' : 'Set availability'}
          </SectionLabel>
          <form onSubmit={handleSetAvailability} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-14)', maxWidth: 380 }}>
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
              <Input style={{ width: '100%' }} value={avForm.reason} onChange={(e) => setAvForm(f => ({ ...f, reason: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <Label size="sm">Until</Label>
              <Input type="date" style={{ width: '100%' }} value={avForm.until} onChange={(e) => setAvForm(f => ({ ...f, until: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
              <Button type="submit" disabled={avSaving || !avForm.personId || !avForm.type_id} style={{ fontSize: '0.85rem' }}>
                {avForm.personId && unavailableMembers.some(m => m.personId === avForm.personId) ? 'Update' : 'Set'}
              </Button>
              {avForm.personId && (
                <Button type="button" variant="secondary" onClick={() => setAvForm({ personId: '', type_id: '', reason: '', until: '' })} style={{ fontSize: '0.85rem' }}>Cancel</Button>
              )}
            </div>
          </form>
        </div>
      </Card>

      {/* Availability types */}
      <Card style={{ padding: 'var(--space-28)' }}>
        <SectionLabel style={{ margin: '0 0 var(--space-20)' }}>
          Availability types
        </SectionLabel>
        <div style={{ marginBottom: 'var(--space-16)' }}>
          {availabilityTypes.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', padding: 'var(--space-8) 0', borderBottom: '1px solid var(--color-sand)' }}>
              {editingAt?.id === t.id ? (
                <>
                  <EmojiPicker value={editingAt.emoji} onChange={(emoji) => setEditingAt((a) => ({ ...a, emoji }))} />
                  <Input value={editingAt.name} onChange={(e) => setEditingAt((a) => ({ ...a, name: e.target.value }))} style={{ flex: 1 }} />
                  <Button style={{ fontSize: '0.8rem', padding: 'var(--space-4) var(--space-10)' }} onClick={() => handleUpdateType(t.id, { name: editingAt.name, emoji: editingAt.emoji })}>Save</Button>
                  <Button variant="secondary" style={{ fontSize: '0.8rem', padding: 'var(--space-4) var(--space-10)' }} onClick={() => setEditingAt(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <span className="emoji-mono" style={{ fontSize: '1.1rem' }}>{t.emoji}</span>
                  <span style={{ flex: 1 }}>{t.name}</span>
                  <Button variant="secondary" style={{ fontSize: '0.75rem', padding: 'var(--space-3) var(--space-8)' }} onClick={() => setEditingAt({ id: t.id, name: t.name, emoji: t.emoji })}>Edit</Button>
                  <button style={{ background: 'none', border: 'none', color: 'var(--color-charcoal-light)', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => handleArchiveType(t.id)}>Archive</button>
                </>
              )}
            </div>
          ))}
          {availabilityTypes.length === 0 && (
            <p style={{ color: 'var(--color-charcoal-light)', fontSize: '0.9rem' }}>No availability types yet.</p>
          )}
        </div>
        <form onSubmit={handleAddType} style={{ display: 'flex', gap: 'var(--space-8)' }}>
          <EmojiPicker value={atForm.emoji} onChange={(emoji) => setAtForm((f) => ({ ...f, emoji }))} />
          <Input placeholder="Name" value={atForm.name} onChange={(e) => setAtForm((f) => ({ ...f, name: e.target.value }))} style={{ flex: 1 }} />
          <Button type="submit" disabled={atSaving || !atForm.name || !atForm.emoji} style={{ fontSize: '0.85rem' }}>Add</Button>
        </form>
      </Card>

    </Page>
  )
}
