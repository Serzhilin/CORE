import { useState } from 'react'
import { useCommunity } from '../../context/CommunityContext'
import {
  createWorkgroup, updateWorkgroup, deleteWorkgroup,
  createRole, updateRole, deleteRole,
  addWorkgroupMember, updateWorkgroupMember, removeWorkgroupMember,
  assignRole, unassignRole,
} from '../../api/client'

const inputStyle = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', fontSize: '0.9rem', background: 'white' }

export default function WorkgroupsTab() {
  const { communityId, community, refresh } = useCommunity()
  const [expanded, setExpanded] = useState(null)
  const [addWgForm, setAddWgForm] = useState({ name: '', color: '#C4622D' })
  const [addingWg, setAddingWg] = useState(false)
  const [addingRole, setAddingRole] = useState({}) // {wgId: {name, color}}
  const [addingMember, setAddingMember] = useState(null) // wgId
  const [editingWgName, setEditingWgName] = useState({})    // { [wgId]: string }
  const [editingRoleName, setEditingRoleName] = useState({}) // { [roleId]: string }
  const [activeTab, setActiveTab] = useState({})              // { [wgId]: 'roles' | 'members' }

  async function handleCreateWorkgroup(e) {
    e.preventDefault()
    try {
      await createWorkgroup(communityId, addWgForm)
      await refresh()
      setAddingWg(false)
      setAddWgForm({ name: '', color: '#C4622D' })
    } catch (err) { alert(err.message) }
  }

  async function handleDeleteWorkgroup(wid) {
    if (!confirm('Delete this workgroup and all its roles?')) return
    try { await deleteWorkgroup(communityId, wid); await refresh() }
    catch (err) { alert(err.message) }
  }

  async function handleCreateRole(wid, e) {
    e.preventDefault()
    const data = addingRole[wid] || { name: '', color: '#C4622D' }
    if (!data.name) return
    try {
      await createRole(wid, data)
      await refresh()
      setAddingRole((r) => ({ ...r, [wid]: { name: '', color: '#C4622D' } }))
    } catch (err) { alert(err.message) }
  }

  async function handleDeleteRole(wid, rid) {
    if (!confirm('Delete role?')) return
    try { await deleteRole(wid, rid); await refresh() }
    catch (err) { alert(err.message) }
  }

  async function handleAddMember(wid, personId) {
    try { await addWorkgroupMember(wid, { person_id: personId }); await refresh(); setAddingMember(null) }
    catch (err) { alert(err.message) }
  }

  async function handleRemoveMember(wid, pid) {
    try { await removeWorkgroupMember(wid, pid); await refresh() }
    catch (err) { alert(err.message) }
  }

  async function handleToggleWgAdmin(wid, pid, val) {
    try { await updateWorkgroupMember(wid, pid, { is_workgroup_admin: val }); await refresh() }
    catch (err) { alert(err.message) }
  }

  async function handleAssignRole(wid, pid, roleId) {
    try { await assignRole(wid, pid, { role_id: roleId }); await refresh() }
    catch (err) { if (!err.message.includes('409')) alert(err.message) }
  }

  async function handleUnassignRole(wid, pid, rid) {
    try { await unassignRole(wid, pid, rid); await refresh() }
    catch (err) { alert(err.message) }
  }

  async function handleSaveWgName(wid, name) {
    const trimmed = name.trim()
    if (!trimmed) {
      setEditingWgName((s) => { const n = { ...s }; delete n[wid]; return n })
      return
    }
    try {
      await updateWorkgroup(communityId, wid, { name: trimmed })
      await refresh()
    } catch (err) { alert(err.message) }
    setEditingWgName((s) => { const n = { ...s }; delete n[wid]; return n })
  }

  function handleCancelWgName(wid) {
    setEditingWgName((s) => { const n = { ...s }; delete n[wid]; return n })
  }

  async function handleSaveRoleName(wid, rid, name) {
    const trimmed = name.trim()
    if (!trimmed) {
      setEditingRoleName((s) => { const n = { ...s }; delete n[rid]; return n })
      return
    }
    try {
      await updateRole(wid, rid, { name: trimmed })
      await refresh()
    } catch (err) { alert(err.message) }
    setEditingRoleName((s) => { const n = { ...s }; delete n[rid]; return n })
  }

  function handleCancelRoleName(rid) {
    setEditingRoleName((s) => { const n = { ...s }; delete n[rid]; return n })
  }

  const communityMembers = community?.members || []
  function getTab(wgId) { return activeTab[wgId] || 'members' }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-title)' }}>Workgroups</h3>
        <button className="btn-primary" onClick={() => setAddingWg(true)} style={{ fontSize: '0.85rem' }}>Add workgroup</button>
      </div>

      {addingWg && (
        <div className="card-warm" style={{ padding: 20, marginBottom: 16 }}>
          <form onSubmit={handleCreateWorkgroup} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>Name</label>
              <input style={inputStyle} value={addWgForm.name} onChange={(e) => setAddWgForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>Color</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="color" value={addWgForm.color} onChange={(e) => setAddWgForm((f) => ({ ...f, color: e.target.value }))} style={{ width: 36, height: 34, border: 'none', padding: 0, cursor: 'pointer' }} />
                <input style={{ ...inputStyle, width: 90 }} value={addWgForm.color} onChange={(e) => setAddWgForm((f) => ({ ...f, color: e.target.value }))} />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ fontSize: '0.85rem' }}>Create</button>
            <button type="button" className="btn-secondary" onClick={() => setAddingWg(false)} style={{ fontSize: '0.85rem' }}>Cancel</button>
          </form>
        </div>
      )}

      {(community?.workgroups || []).map((wg) => {
        const isExpanded = expanded === wg.id
        const wgMembers = wg.members
          .map((wm) => ({ ...wm, member: communityMembers.find((m) => m.personId === wm.person_id) }))
          .filter((wm) => wm.member)

        const nonMembers = communityMembers.filter(
          (m) => !wg.members.some((wm) => wm.person_id === m.personId)
        )

        return (
          <div key={wg.id} className="card" style={{ marginBottom: 12, borderLeft: `4px solid ${wg.color}` }}>
            {/* Header */}
            <div
              onClick={() => setExpanded(isExpanded ? null : wg.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                   onClick={(e) => e.stopPropagation()}>
                {editingWgName[wg.id] !== undefined ? (
                  <input
                    autoFocus
                    value={editingWgName[wg.id]}
                    onChange={(e) => setEditingWgName((s) => ({ ...s, [wg.id]: e.target.value }))}
                    onBlur={() => handleSaveWgName(wg.id, editingWgName[wg.id])}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveWgName(wg.id, editingWgName[wg.id])
                      if (e.key === 'Escape') handleCancelWgName(wg.id)
                    }}
                    style={{ ...inputStyle, fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '1rem', padding: '4px 8px' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    style={{ fontWeight: 700, fontFamily: 'var(--font-title)', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingWgName((s) => ({ ...s, [wg.id]: wg.name }))
                    }}
                  >
                    {wg.name}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>
                  {wg.members.length} members · {wg.roles.length} roles
                </span>
                <button
                  onClick={() => handleDeleteWorkgroup(wg.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Delete
                </button>
                <span style={{ color: 'var(--color-charcoal-light)' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--color-sand)' }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-sand)' }}>
                  {['members', 'roles'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab((s) => ({ ...s, [wg.id]: tab }))}
                      style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: getTab(wg.id) === tab ? `2px solid ${wg.color}` : '2px solid transparent',
                        padding: '10px 20px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: getTab(wg.id) === tab ? 600 : 400,
                        color: getTab(wg.id) === tab ? wg.color : 'var(--color-charcoal-light)',
                        textTransform: 'capitalize',
                        marginBottom: -1,
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div style={{ padding: 20 }}>
                  {getTab(wg.id) === 'roles' && (
                    <div>
                      <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>Roles</h4>
                      {wg.roles.map((r) => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.color }} />
                          {editingRoleName[r.id] !== undefined ? (
                            <input
                              autoFocus
                              value={editingRoleName[r.id]}
                              onChange={(e) => setEditingRoleName((s) => ({ ...s, [r.id]: e.target.value }))}
                              onBlur={() => handleSaveRoleName(wg.id, r.id, editingRoleName[r.id])}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRoleName(wg.id, r.id, editingRoleName[r.id])
                                if (e.key === 'Escape') handleCancelRoleName(r.id)
                              }}
                              style={{ ...inputStyle, flex: 1, padding: '3px 7px', fontSize: '0.9rem' }}
                            />
                          ) : (
                            <span
                              style={{ flex: 1, fontSize: '0.9rem', cursor: 'pointer' }}
                              onClick={() => setEditingRoleName((s) => ({ ...s, [r.id]: r.name }))}
                            >
                              {r.name}
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteRole(wg.id, r.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', fontSize: '0.8rem' }}
                          >×</button>
                        </div>
                      ))}
                      <form onSubmit={(e) => handleCreateRole(wg.id, e)} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <input
                          placeholder="Role name"
                          value={(addingRole[wg.id] || {}).name || ''}
                          onChange={(e) => setAddingRole((r) => ({ ...r, [wg.id]: { ...(r[wg.id] || {}), name: e.target.value } }))}
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <input
                          type="color"
                          value={(addingRole[wg.id] || {}).color || '#C4622D'}
                          onChange={(e) => setAddingRole((r) => ({ ...r, [wg.id]: { ...(r[wg.id] || {}), color: e.target.value } }))}
                          style={{ width: 36, height: 34, border: 'none', padding: 0, cursor: 'pointer' }}
                        />
                        <button type="submit" className="btn-secondary" style={{ fontSize: '0.8rem' }}>Add role</button>
                      </form>
                    </div>
                  )}

                  {getTab(wg.id) === 'members' && (
                    <div>
                      <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>Members</h4>
                      {wgMembers.map(({ member, is_workgroup_admin, roles }) => (
                        <div key={member.personId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500 }}>
                            {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'}
                          </span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={is_workgroup_admin}
                              onChange={(e) => handleToggleWgAdmin(wg.id, member.personId, e.target.checked)}
                            /> WG admin
                          </label>
                          <select
                            defaultValue=""
                            onChange={(e) => { if (e.target.value) handleAssignRole(wg.id, member.personId, e.target.value); e.target.value = '' }}
                            style={{ ...inputStyle, padding: '4px 6px', fontSize: '0.8rem' }}
                          >
                            <option value="">+ Role</option>
                            {wg.roles.filter((r) => !roles.includes(r.id)).map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          {roles.map((rid) => {
                            const role = wg.roles.find((r) => r.id === rid)
                            if (!role) return null
                            return (
                              <span key={rid} style={{ fontSize: '0.75rem', background: role.color + '30', border: `1px solid ${role.color}`, borderRadius: 4, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {role.name}
                                <button onClick={() => handleUnassignRole(wg.id, member.personId, rid)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--color-charcoal-light)' }}>×</button>
                              </span>
                            )
                          })}
                          <button
                            onClick={() => handleRemoveMember(wg.id, member.personId)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}

                      {addingMember === wg.id ? (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <select
                            defaultValue=""
                            onChange={(e) => { if (e.target.value) handleAddMember(wg.id, e.target.value) }}
                            style={{ ...inputStyle, flex: 1 }}
                          >
                            <option value="">Select community member…</option>
                            {nonMembers.map((m) => (
                              <option key={m.personId} value={m.personId}>
                                {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || m.personId}
                              </option>
                            ))}
                          </select>
                          <button className="btn-secondary" onClick={() => setAddingMember(null)} style={{ fontSize: '0.8rem' }}>Cancel</button>
                        </div>
                      ) : (
                        <button className="btn-secondary" onClick={() => setAddingMember(wg.id)} style={{ fontSize: '0.8rem', marginTop: 8 }}>
                          + Add member
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
