import { useState } from 'react'
import { useCommunity } from '../context/CommunityContext'
import { setMyAvailability } from '../api/client'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white',
  boxSizing: 'border-box',
}

export default function MyAvailability() {
  const { communityId, community, availabilityTypes, myMembership, refresh } = useCommunity()

  const current = myMembership?.availability ?? null

  const [form, setForm] = useState({
    type_id: current?.type.id || '',
    reason: current?.reason || '',
    until: current?.until ? current.until.slice(0, 10) : '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  async function handleSet(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    try {
      await setMyAvailability(communityId, {
        type_id: form.type_id || undefined,
        reason: form.reason || undefined,
        until: form.until || undefined,
      })
      await refresh()
      setSaveMsg('Saved!')
    } catch (err) {
      setSaveMsg('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true)
    setSaveMsg('')
    try {
      await setMyAvailability(communityId, { clear: true })
      await refresh()
      setForm({ type_id: '', reason: '', until: '' })
      setSaveMsg('Cleared.')
    } catch (err) {
      setSaveMsg('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: 24 }}>My availability</h2>

      {current && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--color-sand)', borderRadius: 10, padding: '12px 18px', marginBottom: 20,
          fontSize: '0.95rem',
        }}>
          <span style={{ fontSize: '1.3rem' }}>{current.type.emoji}</span>
          <div>
            <div style={{ fontWeight: 600 }}>{current.type.name}</div>
            {current.reason && <div style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-light)' }}>{current.reason}</div>}
            {current.until && <div style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>Until {new Date(current.until).toLocaleDateString()}</div>}
          </div>
        </div>
      )}

      {!current && (
        <div style={{
          background: 'var(--color-cream-dark)', borderRadius: 10, padding: '12px 18px', marginBottom: 20,
          fontSize: '0.9rem', color: 'var(--color-charcoal-light)',
        }}>
          You are currently marked as available in {community?.name}.
        </div>
      )}

      <div className="card" style={{ padding: 28 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', color: 'var(--color-charcoal-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Set status
        </h3>
        <form onSubmit={handleSet} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Status</label>
            <select style={inputStyle} value={form.type_id} onChange={(e) => setForm((f) => ({ ...f, type_id: e.target.value }))}>
              <option value="">Available (no status)</option>
              {availabilityTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Reason (optional)</label>
            <input style={inputStyle} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Short note…" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Until (optional)</label>
            <input type="date" style={inputStyle} value={form.until} onChange={(e) => setForm((f) => ({ ...f, until: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="submit" className="btn-primary" disabled={saving || !form.type_id}>
              {saving ? 'Saving…' : 'Set status'}
            </button>
            {current && (
              <button type="button" className="btn-secondary" onClick={handleClear} disabled={saving}>
                Clear status
              </button>
            )}
            {saveMsg && (
              <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>
                {saveMsg}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
