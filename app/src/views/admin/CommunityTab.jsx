import { useState } from 'react'
import { useCommunity } from '../../context/CommunityContext'
import {
  updateCommunity,
  createAvailabilityType,
  updateAvailabilityType,
  archiveAvailabilityType,
} from '../../api/client'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box',
}

export default function CommunityTab() {
  const { communityId, community, availabilityTypes, refresh } = useCommunity()

  const [form, setForm] = useState({
    name: community?.name || '',
    slug: community?.slug || '',
    description: community?.description || '',
    primary_color: community?.primary_color || '#C4622D',
    title_font: community?.title_font || 'Playfair Display',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [atForm, setAtForm] = useState({ name: '', emoji: '' })
  const [atSaving, setAtSaving] = useState(false)
  const [editingAt, setEditingAt] = useState(null) // {id, name, emoji}

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

  async function handleAddAvailabilityType(e) {
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

  async function handleUpdateAt(id, data) {
    try {
      await updateAvailabilityType(communityId, id, data)
      await refresh()
      setEditingAt(null)
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  async function handleArchiveAt(id) {
    if (!confirm('Archive this availability type?')) return
    try {
      await archiveAvailabilityType(communityId, id)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Community settings */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
          Community settings
        </h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Name</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Slug</label>
            <input style={inputStyle} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} pattern="[a-z0-9-]+" />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-light)' }}>Lowercase letters, numbers, hyphens only</span>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Description</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Primary color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} style={{ width: 40, height: 36, border: 'none', padding: 0, cursor: 'pointer' }} />
                <input style={{ ...inputStyle, flex: 1 }} value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Title font</label>
              <select style={inputStyle} value={form.title_font} onChange={(e) => setForm((f) => ({ ...f, title_font: e.target.value }))}>
                <option>Playfair Display</option>
                <option>Inter</option>
                <option>Georgia</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            {saveMsg && <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>{saveMsg}</span>}
          </div>
        </form>
      </div>

      {/* Availability types */}
      <div className="card" style={{ padding: 28 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
          Availability types
        </h3>
        <div style={{ marginBottom: 16 }}>
          {availabilityTypes.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-sand)' }}>
              {editingAt?.id === t.id ? (
                <>
                  <input value={editingAt.emoji} onChange={(e) => setEditingAt((a) => ({ ...a, emoji: e.target.value }))} style={{ width: 48, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', textAlign: 'center' }} />
                  <input value={editingAt.name} onChange={(e) => setEditingAt((a) => ({ ...a, name: e.target.value }))} style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-sand-dark)' }} />
                  <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => handleUpdateAt(t.id, { name: editingAt.name, emoji: editingAt.emoji })}>Save</button>
                  <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => setEditingAt(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '1.1rem' }}>{t.emoji}</span>
                  <span style={{ flex: 1 }}>{t.name}</span>
                  <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '3px 8px' }} onClick={() => setEditingAt({ id: t.id, name: t.name, emoji: t.emoji })}>Edit</button>
                  <button style={{ background: 'none', border: 'none', color: 'var(--color-charcoal-light)', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => handleArchiveAt(t.id)}>Archive</button>
                </>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={handleAddAvailabilityType} style={{ display: 'flex', gap: 8 }}>
          <input placeholder="🏖" value={atForm.emoji} onChange={(e) => setAtForm((f) => ({ ...f, emoji: e.target.value }))} style={{ width: 60, padding: '8px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', textAlign: 'center' }} />
          <input placeholder="Name" value={atForm.name} onChange={(e) => setAtForm((f) => ({ ...f, name: e.target.value }))} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-sand-dark)' }} />
          <button type="submit" className="btn-primary" disabled={atSaving || !atForm.name || !atForm.emoji} style={{ fontSize: '0.85rem' }}>Add</button>
        </form>
      </div>
    </div>
  )
}
