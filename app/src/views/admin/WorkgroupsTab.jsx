import { useState } from 'react'
import { Card } from '@ecommons/ui'
import { useCommunity } from '../../context/CommunityContext'
import {
  createWorkgroup, updateWorkgroup, deleteWorkgroup,
  createRole, updateRole, deleteRole,
  addWorkgroupMember, removeWorkgroupMember,
  assignRole, unassignRole,
} from '../../api/client'

const inputStyle = { padding: '7px 10px', borderRadius: 0, border: '1px solid var(--color-sand-dark)', fontSize: '0.9rem', background: 'white' }

export default function WorkgroupsTab() {
  const { communityId, community, refresh } = useCommunity()
  const [expanded, setExpanded] = useState(null)
  const [addWgForm, setAddWgForm] = useState({ name: '', color: '#C4622D' })
  const [addingWg, setAddingWg] = useState(false)
  const [addingRole, setAddingRole] = useState({}) // {wgId: {name, color}}
  const [addingMember, setAddingMember] = useState(null) // wgId
  const [editingWgName, setEditingWgName] = useState({})    // { [wgId]: string }
  const [editingWgDesc, setEditingWgDesc] = useState({})    // { [wgId]: string }
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
      setEditingWgName((s) => { const n = { ...s }; delete n[wid]; return n })
    } catch (err) { alert(err.message) }
  }

  function handleCancelWgName(wid) {
    setEditingWgName((s) => { const n = { ...s }; delete n[wid]; return n })
  }

  async function handleSaveWgDesc(wid, desc) {
    try {
      await updateWorkgroup(communityId, wid, { description: desc.trim() || null })
      await refresh()
    } catch (err) { alert(err.message) }
    setEditingWgDesc((s) => { const n = { ...s }; delete n[wid]; return n })
  }

  function handleCancelWgDesc(wid) {
    setEditingWgDesc((s) => { const n = { ...s }; delete n[wid]; return n })
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
      setEditingRoleName((s) => { const n = { ...s }; delete n[rid]; return n })
    } catch (err) { alert(err.message) }
  }

  function handleCancelRoleName(rid) {
    setEditingRoleName((s) => { const n = { ...s }; delete n[rid]; return n })
  }

  const communityMembers = community?.members || []
  function getTab(wgId) { return activeTab[wgId] || 'members' }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn-primary" onClick={() => setAddingWg(true)} style={{ fontSize: '0.85rem' }}>Add workgroup</button>
      </div>

      {addingWg && (
        <Card variant="warm" style={{ padding: 20, marginBottom: 16 }}>
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
        </Card>
      )}

      {[...(community?.workgroups || [])].sort((a, b) => a.name.localeCompare(b.name)).map((wg) => {
        const isExpanded = expanded === wg.id
        const wgMembers = wg.members
          .map((wm) => ({ ...wm, member: communityMembers.find((m) => m.personId === wm.person_id) }))
          .filter((wm) => wm.member)
          .sort((a, b) => {
            const nameA = [a.member.firstName, a.member.lastName].filter(Boolean).join(' ') || a.member.email || ''
            const nameB = [b.member.firstName, b.member.lastName].filter(Boolean).join(' ') || b.member.email || ''
            return nameA.localeCompare(nameB)
          })

        const nonMembers = communityMembers
          .filter((m) => !wg.members.some((wm) => wm.person_id === m.personId))
          .sort((a, b) => ([a.firstName, a.lastName].filter(Boolean).join(' ') || a.email || '').localeCompare([b.firstName, b.lastName].filter(Boolean).join(' ') || b.email || ''))

        return (
          <Card key={wg.id} style={{ marginBottom: 12, borderLeft: `4px solid ${wg.color}` }}>
            {/* Header */}
            <div
              onClick={() => setExpanded(isExpanded ? null : wg.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                   onClick={(e) => e.stopPropagation()}>
                <input
                  key={wg.color}
                  type="color"
                  defaultValue={wg.color}
                  onChange={(e) => updateWorkgroup(communityId, wg.id, { color: e.target.value }).then(refresh)}
                  title="Change color"
                  style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: 'none', flexShrink: 0 }}
                />
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
                  {wgMembers.length} members · {wg.roles.length} roles
                </span>
                <button
                  onClick={() => handleDeleteWorkgroup(wg.id)}
                  title="Delete workgroup"
                  style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', padding: '2px 4px', display: 'inline-flex', alignItems: 'center' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
                <span style={{ color: 'var(--color-charcoal-light)' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--color-sand)' }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-sand)' }}>
                  {['members', 'roles', 'details'].map((tab) => (
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
                      {[...wg.roles].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <input
                            key={r.color}
                            type="color"
                            defaultValue={r.color}
                            onChange={(e) => updateRole(wg.id, r.id, { color: e.target.value }).then(refresh)}
                            title="Change color"
                            style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: 'none', flexShrink: 0 }}
                          />
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
                      <div>
                        {wgMembers.map(({ member, roles }, idx) => {
                          const displayName = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'
                          const unassignedRoles = wg.roles.filter((r) => !roles.includes(r.id))
                          return (
                            <div
                              key={member.personId}
                              style={{
                                borderTop: idx === 0 ? 'none' : '1px solid var(--color-sand)',
                                padding: '10px 0',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{displayName}</span>
                              </div>

                              {/* Bottom row: add role dropdown + role chips + remove */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {unassignedRoles.length > 0 && (
                                  <select
                                    value=""
                                    onChange={(e) => { if (e.target.value) handleAssignRole(wg.id, member.personId, e.target.value) }}
                                    style={{ ...inputStyle, padding: '2px 6px', fontSize: '0.78rem', color: 'var(--color-charcoal-light)' }}
                                  >
                                    <option value="">+ Role</option>
                                    {unassignedRoles.map((r) => (
                                      <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                  </select>
                                )}

                                {roles.map((rid) => {
                                  const role = wg.roles.find((r) => r.id === rid)
                                  if (!role) return null
                                  return (
                                    <span
                                      key={rid}
                                      style={{
                                        fontSize: '0.75rem',
                                        background: role.color + '22',
                                        border: `1px solid ${role.color}`,
                                        borderRadius: 0,
                                        padding: '2px 8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        color: 'var(--color-charcoal)',
                                      }}
                                    >
                                      {role.name}
                                      <button
                                        onClick={() => handleUnassignRole(wg.id, member.personId, rid)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--color-charcoal-light)', fontSize: '0.9rem' }}
                                      >×</button>
                                    </span>
                                  )
                                })}

                                <button
                                  onClick={() => handleRemoveMember(wg.id, member.personId)}
                                  title="Remove from workgroup"
                                  style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', marginLeft: 'auto', padding: '2px 4px', display: 'inline-flex', alignItems: 'center' }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )
                        })}

                        {/* Add member */}
                        {addingMember === wg.id ? (
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
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
                          <button className="btn-secondary" onClick={() => setAddingMember(wg.id)} style={{ fontSize: '0.8rem', alignSelf: 'flex-start' }}>
                            + Add member
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {getTab(wg.id) === 'details' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500 }}>Description</label>
                        {editingWgDesc[wg.id] !== undefined ? (
                          <textarea
                            autoFocus
                            value={editingWgDesc[wg.id]}
                            onChange={(e) => setEditingWgDesc((s) => ({ ...s, [wg.id]: e.target.value }))}
                            onBlur={() => handleSaveWgDesc(wg.id, editingWgDesc[wg.id])}
                            onKeyDown={(e) => { if (e.key === 'Escape') handleCancelWgDesc(wg.id) }}
                            rows={4}
                            style={{ ...inputStyle, width: '100%', resize: 'vertical', fontSize: '0.88rem' }}
                            placeholder="Describe this workgroup…"
                          />
                        ) : (
                          <div
                            onClick={() => setEditingWgDesc((s) => ({ ...s, [wg.id]: wg.description || '' }))}
                            style={{ fontSize: '0.88rem', color: wg.description ? 'var(--color-charcoal)' : 'var(--color-charcoal-light)', cursor: 'pointer', fontStyle: wg.description ? 'normal' : 'italic', lineHeight: 1.6, padding: '6px 0' }}
                          >
                            {wg.description || 'Click to add a description…'}
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500 }}>Color</label>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <input
                            key={wg.color}
                            type="color"
                            defaultValue={wg.color}
                            onChange={(e) => updateWorkgroup(communityId, wg.id, { color: e.target.value }).then(refresh)}
                            style={{ width: 40, height: 36, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 0 }}
                          />
                          <span style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-light)', fontFamily: 'monospace' }}>{wg.color}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
