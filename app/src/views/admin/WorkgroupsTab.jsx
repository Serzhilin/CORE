import { useState } from 'react'
import { Card, Button, Input, Textarea, Badge, Select, Label, TrashIcon, Tabs, SectionLabel, Page } from '@ecommons/ui'
import { useCommunity } from '../../context/CommunityContext'
import styles from './WorkgroupsTab.module.css'
import {
  createWorkgroup, updateWorkgroup, deleteWorkgroup,
  createRole, updateRole, deleteRole,
  addWorkgroupMember, removeWorkgroupMember,
  assignRole, unassignRole,
} from '../../api/client'

export default function WorkgroupsTab() {
  const { communityId, community, refresh } = useCommunity()
  const [expanded, setExpanded] = useState(null)
  const [addWgForm, setAddWgForm] = useState({ name: '', color: '#E8262B' })
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
      setAddWgForm({ name: '', color: '#E8262B' })
    } catch (err) { alert(err.message) }
  }

  async function handleDeleteWorkgroup(wid) {
    if (!confirm('Delete this workgroup and all its roles?')) return
    try { await deleteWorkgroup(communityId, wid); await refresh() }
    catch (err) { alert(err.message) }
  }

  async function handleCreateRole(wid, e) {
    e.preventDefault()
    const data = addingRole[wid] || { name: '', color: '#E8262B' }
    if (!data.name) return
    try {
      await createRole(wid, data)
      await refresh()
      setAddingRole((r) => ({ ...r, [wid]: { name: '', color: '#E8262B' } }))
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
    <Page maxWidth={680}>
      <div className={`row ${styles.headerBar}`}>
        <Button onClick={() => setAddingWg(true)} className={styles.btnSm}>Add workgroup</Button>
      </div>

      {addingWg && (
        <Card className={styles.addWgCard}>
          <form onSubmit={handleCreateWorkgroup} className={styles.addWgForm}>
            <div>
              <Label size="sm">Name</Label>
              <Input value={addWgForm.name} onChange={(e) => setAddWgForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <Label size="sm">Color</Label>
              <div className={styles.colorSwatchGroup}>
                <input type="color" value={addWgForm.color} onChange={(e) => setAddWgForm((f) => ({ ...f, color: e.target.value }))} className={styles.colorSwatchInput} />
                <Input className={styles.colorHexInput} value={addWgForm.color} onChange={(e) => setAddWgForm((f) => ({ ...f, color: e.target.value }))} />
              </div>
            </div>
            <Button type="submit" className={styles.btnSm}>Create</Button>
            <Button type="button" variant="secondary" onClick={() => setAddingWg(false)} className={styles.btnSm}>Cancel</Button>
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
          <Card key={wg.id} className={styles.wgCard} style={{ borderLeft: `4px solid ${wg.color}` }}>
            {/* Header */}
            <div
              onClick={() => setExpanded(isExpanded ? null : wg.id)}
              className={styles.wgHeader}
            >
              <div className="row"
                   onClick={(e) => e.stopPropagation()}>
                <input
                  key={wg.color}
                  type="color"
                  defaultValue={wg.color}
                  onChange={(e) => updateWorkgroup(communityId, wg.id, { color: e.target.value }).then(refresh)}
                  title="Change color"
                  className={styles.colorDot}
                />
                {editingWgName[wg.id] !== undefined ? (
                  <Input
                    autoFocus
                    value={editingWgName[wg.id]}
                    onChange={(e) => setEditingWgName((s) => ({ ...s, [wg.id]: e.target.value }))}
                    onBlur={() => handleSaveWgName(wg.id, editingWgName[wg.id])}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveWgName(wg.id, editingWgName[wg.id])
                      if (e.key === 'Escape') handleCancelWgName(wg.id)
                    }}
                    className={`${styles.wgNameInput} ${styles.editableFieldActive}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className={`${styles.wgNameText} ${styles.editableField}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingWgName((s) => ({ ...s, [wg.id]: wg.name }))
                    }}
                  >
                    {wg.name}
                  </span>
                )}
              </div>
              <div className="row" onClick={(e) => e.stopPropagation()}>
                <span className={styles.countText}>
                  {wgMembers.length} members · {wg.roles.length} roles
                </span>
                <button
                  onClick={() => handleDeleteWorkgroup(wg.id)}
                  title="Delete workgroup"
                  className={styles.iconBtnDanger}
                >
                  <TrashIcon />
                </button>
                <span className={styles.chevron}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div className={styles.expandedBody}>
                {/* Tab bar */}
                <Tabs
                  tabs={[{ key: 'members', label: 'members' }, { key: 'roles', label: 'roles' }, { key: 'details', label: 'details' }]}
                  activeKey={getTab(wg.id)}
                  onChange={(tab) => setActiveTab((s) => ({ ...s, [wg.id]: tab }))}
                  activeColor={wg.color}
                  borderWidth={1}
                  fontSize="0.85rem"
                  activeFontWeight={600}
                  gap={0}
                  textTransform="capitalize"
                />

                <div className={styles.tabContent}>
                  {getTab(wg.id) === 'roles' && (
                    <div>
                      <SectionLabel as="h4" fontSize="0.85rem" className={styles.sectionGap}>Roles</SectionLabel>
                      {[...wg.roles].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
                        <div key={r.id} className={`row ${styles.roleRow}`}>
                          <input
                            key={r.color}
                            type="color"
                            defaultValue={r.color}
                            onChange={(e) => updateRole(wg.id, r.id, { color: e.target.value }).then(refresh)}
                            title="Change color"
                            className={styles.colorDot}
                          />
                          {editingRoleName[r.id] !== undefined ? (
                            <Input
                              autoFocus
                              value={editingRoleName[r.id]}
                              onChange={(e) => setEditingRoleName((s) => ({ ...s, [r.id]: e.target.value }))}
                              onBlur={() => handleSaveRoleName(wg.id, r.id, editingRoleName[r.id])}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRoleName(wg.id, r.id, editingRoleName[r.id])
                                if (e.key === 'Escape') handleCancelRoleName(r.id)
                              }}
                              className={`${styles.roleNameInput} ${styles.editableFieldActive}`}
                            />
                          ) : (
                            <span
                              className={`${styles.roleNameText} ${styles.editableField}`}
                              onClick={() => setEditingRoleName((s) => ({ ...s, [r.id]: r.name }))}
                            >
                              {r.name}
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteRole(wg.id, r.id)}
                            className={styles.roleDeleteButton}
                          >×</button>
                        </div>
                      ))}
                      <form onSubmit={(e) => handleCreateRole(wg.id, e)} className={styles.addRoleForm}>
                        <Input
                          placeholder="Role name"
                          value={(addingRole[wg.id] || {}).name || ''}
                          onChange={(e) => setAddingRole((r) => ({ ...r, [wg.id]: { ...(r[wg.id] || {}), name: e.target.value } }))}
                          className={styles.flexInput}
                        />
                        <input
                          type="color"
                          value={(addingRole[wg.id] || {}).color || '#E8262B'}
                          onChange={(e) => setAddingRole((r) => ({ ...r, [wg.id]: { ...(r[wg.id] || {}), color: e.target.value } }))}
                          className={styles.colorSwatchInput}
                        />
                        <Button type="submit" variant="secondary" className={styles.btnXs}>Add role</Button>
                      </form>
                    </div>
                  )}

                  {getTab(wg.id) === 'members' && (
                    <div>
                      <SectionLabel as="h4" fontSize="0.85rem" className={styles.sectionGap}>Members</SectionLabel>
                      <div>
                        {wgMembers.map(({ member, roles }, idx) => {
                          const displayName = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'
                          const unassignedRoles = wg.roles.filter((r) => !roles.includes(r.id))
                          return (
                            <div
                              key={member.personId}
                              className={`stack ${styles.memberRow}`}
                              style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--color-sand)' }}
                            >
                              <div className="row">
                                <span className={styles.memberName}>{displayName}</span>
                              </div>

                              {/* Bottom row: add role dropdown + role chips + remove */}
                              <div className={`row ${styles.roleChipRow}`}>
                                {unassignedRoles.length > 0 && (
                                  <Select
                                    value=""
                                    onChange={(e) => { if (e.target.value) handleAssignRole(wg.id, member.personId, e.target.value) }}
                                    className={styles.roleSelect}
                                  >
                                    <option value="">+ Role</option>
                                    {unassignedRoles.map((r) => (
                                      <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                  </Select>
                                )}

                                {roles.map((rid) => {
                                  const role = wg.roles.find((r) => r.id === rid)
                                  if (!role) return null
                                  return (
                                    <Badge
                                      key={rid}
                                      color={role.color}
                                      className={styles.roleBadge}
                                      style={{ borderColor: role.color }}
                                    >
                                      {role.name}
                                      <button
                                        onClick={() => handleUnassignRole(wg.id, member.personId, rid)}
                                        className={styles.roleUnassignButton}
                                      >×</button>
                                    </Badge>
                                  )
                                })}

                                <button
                                  onClick={() => handleRemoveMember(wg.id, member.personId)}
                                  title="Remove from workgroup"
                                  className={`${styles.iconBtnDanger} ${styles.marginLeftAuto}`}
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                            </div>
                          )
                        })}

                        {/* Add member */}
                        {addingMember === wg.id ? (
                          <div className={styles.addMemberRow}>
                            <Select
                              defaultValue=""
                              onChange={(e) => { if (e.target.value) handleAddMember(wg.id, e.target.value) }}
                              className={styles.flexInput}
                            >
                              <option value="">Select community member…</option>
                              {nonMembers.map((m) => (
                                <option key={m.personId} value={m.personId}>
                                  {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || m.personId}
                                </option>
                              ))}
                            </Select>
                            <Button variant="secondary" onClick={() => setAddingMember(null)} className={styles.btnXs}>Cancel</Button>
                          </div>
                        ) : (
                          <Button variant="secondary" onClick={() => setAddingMember(wg.id)} className={styles.addMemberButton}>
                            + Add member
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {getTab(wg.id) === 'details' && (
                    <div className={`stack ${styles.detailsStack}`}>
                      <div>
                        <Label size="sm" style={{ marginBottom: 'var(--space-6)' }}>Description</Label>
                        {editingWgDesc[wg.id] !== undefined ? (
                          <Textarea
                            autoFocus
                            value={editingWgDesc[wg.id]}
                            onChange={(e) => setEditingWgDesc((s) => ({ ...s, [wg.id]: e.target.value }))}
                            onBlur={() => handleSaveWgDesc(wg.id, editingWgDesc[wg.id])}
                            onKeyDown={(e) => { if (e.key === 'Escape') handleCancelWgDesc(wg.id) }}
                            rows={4}
                            className={`${styles.descTextarea} ${styles.editableFieldActive}`}
                            placeholder="Describe this workgroup…"
                          />
                        ) : (
                          <div
                            onClick={() => setEditingWgDesc((s) => ({ ...s, [wg.id]: wg.description || '' }))}
                            className={`${styles.descriptionDisplay} ${styles.editableField}`}
                            style={{ color: wg.description ? 'var(--color-charcoal)' : 'var(--color-charcoal-light)', fontStyle: wg.description ? 'normal' : 'italic' }}
                          >
                            {wg.description || 'Click to add a description…'}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label size="sm" style={{ marginBottom: 'var(--space-6)' }}>Color</Label>
                        <div className={`row ${styles.colorPickerRow}`}>
                          <input
                            key={wg.color}
                            type="color"
                            defaultValue={wg.color}
                            onChange={(e) => updateWorkgroup(communityId, wg.id, { color: e.target.value }).then(refresh)}
                            className={styles.colorSwatchLarge}
                          />
                          <span className={styles.colorHexText}>{wg.color}</span>
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
    </Page>
  )
}
