import { useState } from 'react'
import { useCommunity } from '../../context/CommunityContext'
import EmojiPicker from '../../components/EmojiPicker'
import { createAvailabilityType, updateAvailabilityType, archiveAvailabilityType } from '../../api/client'

export default function AvailabilityTab() {
  const { communityId, availabilityTypes, refresh } = useCommunity()
  const [atForm, setAtForm] = useState({ name: '', emoji: '' })
  const [atSaving, setAtSaving] = useState(false)
  const [editingAt, setEditingAt] = useState(null)

  async function handleAdd(e) {
    e.preventDefault()
    if (!atForm.name || !atForm.emoji) return
    setAtSaving(true)
    try {
      await createAvailabilityType(communityId, atForm)
      await refresh()
      setAtForm({ name: '', emoji: '' })
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setAtSaving(false)
    }
  }

  async function handleUpdate(id, data) {
    try {
      await updateAvailabilityType(communityId, id, data)
      await refresh()
      setEditingAt(null)
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  async function handleArchive(id) {
    if (!confirm('Archive this availability type?')) return
    try {
      await archiveAvailabilityType(communityId, id)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  const rowStyle = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', fontSize: '0.9rem', background: 'white' }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="card" style={{ padding: 28 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
          Availability types
        </h3>
        <div style={{ marginBottom: 16 }}>
          {availabilityTypes.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-sand)' }}>
              {editingAt?.id === t.id ? (
                <>
                  <EmojiPicker value={editingAt.emoji} onChange={(emoji) => setEditingAt((a) => ({ ...a, emoji }))} />
                  <input value={editingAt.name} onChange={(e) => setEditingAt((a) => ({ ...a, name: e.target.value }))} style={{ flex: 1, ...rowStyle }} />
                  <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => handleUpdate(t.id, { name: editingAt.name, emoji: editingAt.emoji })}>Save</button>
                  <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => setEditingAt(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '1.1rem' }}>{t.emoji}</span>
                  <span style={{ flex: 1 }}>{t.name}</span>
                  <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '3px 8px' }} onClick={() => setEditingAt({ id: t.id, name: t.name, emoji: t.emoji })}>Edit</button>
                  <button style={{ background: 'none', border: 'none', color: 'var(--color-charcoal-light)', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => handleArchive(t.id)}>Archive</button>
                </>
              )}
            </div>
          ))}
          {availabilityTypes.length === 0 && (
            <p style={{ color: 'var(--color-charcoal-light)', fontSize: '0.9rem' }}>No availability types yet.</p>
          )}
        </div>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8 }}>
          <EmojiPicker value={atForm.emoji} onChange={(emoji) => setAtForm((f) => ({ ...f, emoji }))} />
          <input placeholder="Name" value={atForm.name} onChange={(e) => setAtForm((f) => ({ ...f, name: e.target.value }))} style={{ flex: 1, ...rowStyle }} />
          <button type="submit" className="btn-primary" disabled={atSaving || !atForm.name || !atForm.emoji} style={{ fontSize: '0.85rem' }}>Add</button>
        </form>
      </div>
    </div>
  )
}
