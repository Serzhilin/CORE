import { useState } from 'react'
import { useCommunity } from '../../context/CommunityContext'
import { addMember, updateMember, removeMember } from '../../api/client'

const inputStyle = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', fontSize: '0.9rem', background: 'white' }

export default function MembersTab() {
  const { communityId, community, refresh } = useCommunity()
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState({ first_name: '', last_name: '', email: '' })
  const [addSaving, setAddSaving] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    setAddSaving(true)
    try {
      await addMember(communityId, addForm)
      await refresh()
      setAdding(false)
      setAddForm({ first_name: '', last_name: '', email: '' })
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setAddSaving(false)
    }
  }

  async function handleUpdate(pid, data) {
    try {
      await updateMember(communityId, pid, data)
      await refresh()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  async function handleRemove(pid, name) {
    if (!confirm(`Remove ${name} from this community?`)) return
    try {
      await removeMember(communityId, pid)
      await refresh()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-title)' }}>Members</h3>
        <button className="btn-primary" onClick={() => setAdding(true)} style={{ fontSize: '0.85rem' }}>Add member</button>
      </div>

      {adding && (
        <div className="card-warm" style={{ padding: 20, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 16px' }}>Add member</h4>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>First name</label>
              <input style={inputStyle} value={addForm.first_name} onChange={(e) => setAddForm((f) => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>Last name</label>
              <input style={inputStyle} value={addForm.last_name} onChange={(e) => setAddForm((f) => ({ ...f, last_name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>Email</label>
              <input type="email" style={inputStyle} value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="submit" className="btn-primary" disabled={addSaving} style={{ fontSize: '0.85rem' }}>Add</button>
              <button type="button" className="btn-secondary" onClick={() => setAdding(false)} style={{ fontSize: '0.85rem' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead style={{ borderBottom: '2px solid var(--color-sand)' }}>
            <tr>
              {['Name', 'Email', 'Admin', 'Aspirant', 'Joined', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(community?.members || []).map((m, idx) => {
              const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || 'Unknown'
              return (
                <tr key={m.personId} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--color-cream)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{name}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-charcoal-light)', fontSize: '0.85rem' }}>{m.email || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <input type="checkbox" checked={m.isAdmin}
                      onChange={(e) => handleUpdate(m.personId, { is_admin: e.target.checked })} />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <input type="checkbox" checked={m.isAspirant}
                      onChange={(e) => handleUpdate(m.personId, { is_aspirant: e.target.checked })} />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <input
                      type="date"
                      value={m.joinedAt ? m.joinedAt.slice(0, 10) : ''}
                      onChange={(e) => handleUpdate(m.personId, { joined_at: e.target.value || null })}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', fontSize: '0.85rem' }}
                    />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => handleRemove(m.personId, name)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
