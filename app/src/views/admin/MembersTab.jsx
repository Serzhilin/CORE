import { useState, useEffect } from 'react'
import { Card, Button, Input, Select, Label, TrashIcon, Table, Thead, Th, Td, ErrorText, Page, SectionLabel } from '@ecommons/ui'
import { useCommunity } from '../../context/CommunityContext'
import { addMember, updateMember, removeMember, listMembershipTypes, lookupMemberEname } from '../../api/client'
import styles from './MembersTab.module.css'

export default function MembersTab() {
  const { communityId, community, refresh } = useCommunity()
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState({ ename: '', first_name: '', last_name: '', membership_type_id: '', joined_at: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState(null)
  const [enameChecked, setEnameChecked] = useState(false)
  const [membershipTypes, setMembershipTypes] = useState([])
  const [copiedId, setCopiedId] = useState(null)
  const [hoverCell, setHoverCell] = useState(null)
  const [editingCell, setEditingCell] = useState(null)

  useEffect(() => {
    listMembershipTypes(communityId).then(setMembershipTypes).catch(() => setMembershipTypes([]))
  }, [communityId])

  function resetAddForm() {
    setAddForm({ ename: '', first_name: '', last_name: '', membership_type_id: '', joined_at: '' })
    setEnameChecked(false)
    setCheckError(null)
  }

  async function handleCheckEname() {
    const ename = addForm.ename.trim()
    if (!ename) return
    setChecking(true)
    setCheckError(null)
    try {
      const profile = await lookupMemberEname(communityId, ename)
      setAddForm((f) => ({ ...f, first_name: profile.first_name, last_name: profile.last_name }))
      setEnameChecked(true)
    } catch (err) {
      setEnameChecked(false)
      setCheckError(err.message)
    } finally {
      setChecking(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setAddSaving(true)
    try {
      const { membership_type_id, joined_at, ename, first_name, last_name } = addForm
      const newMembership = await addMember(communityId, { ename, first_name, last_name })
      const extras = {}
      if (membership_type_id) extras.membership_type_id = membership_type_id
      if (joined_at) extras.joined_at = joined_at
      if (Object.keys(extras).length) await updateMember(communityId, newMembership.person_id, extras)
      await refresh()
      setAdding(false)
      resetAddForm()
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

  async function handleCopyEname(personId, ename) {
    if (!ename) return
    try {
      await navigator.clipboard.writeText(ename)
      setCopiedId(personId)
      setTimeout(() => setCopiedId((id) => (id === personId ? null : id)), 1500)
    } catch (err) { alert(err.message) }
  }

  const pencilIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </svg>
  )

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
    <Page maxWidth={1100}>
      <div className={`row ${styles.headerBar}`}>
        <Button onClick={() => { resetAddForm(); setAdding(true) }} className={styles.btnSm}>Add member</Button>
      </div>

      {adding && (
        <Card className={styles.addCard}>
          <SectionLabel as="h4" className={styles.addMemberLabel}>Add member</SectionLabel>
          <form onSubmit={handleAdd} className={styles.addMemberForm}>
            <div>
              <Label size="sm">eName</Label>
              <Input
                className={styles.enameInput}
                placeholder="@uuid…"
                value={addForm.ename}
                disabled={enameChecked}
                onChange={(e) => { setAddForm((f) => ({ ...f, ename: e.target.value })); setEnameChecked(false); setCheckError(null) }}
              />
            </div>
            {!enameChecked ? (
              <div className={styles.formButtonGroup}>
                <Button type="button" variant="secondary" disabled={checking || !addForm.ename.trim()} onClick={handleCheckEname} className={styles.btnSm}>
                  {checking ? 'Checking…' : 'Check eName'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setAdding(false)} className={styles.btnSm}>Cancel</Button>
              </div>
            ) : null}
          </form>
          {checkError && (
            <ErrorText as="p" fontSize="0.85rem" style={{ margin: 'var(--space-10) 0 0' }}>{checkError}</ErrorText>
          )}
          {enameChecked && (
          <form onSubmit={handleAdd} className={`${styles.addMemberForm} ${styles.addMemberFormSpaced}`}>
            <div>
              <Label size="sm">First name</Label>
              <span className={styles.staticFieldValue}>{addForm.first_name}</span>
            </div>
            <div>
              <Label size="sm">Last name</Label>
              <span className={styles.staticFieldValue}>{addForm.last_name}</span>
            </div>
            <div>
              <Label size="sm">Joined</Label>
              <Input type="date" value={addForm.joined_at} onChange={(e) => setAddForm((f) => ({ ...f, joined_at: e.target.value }))} />
            </div>
            <div>
              <Label size="sm">Membership type</Label>
              <Select value={addForm.membership_type_id} onChange={(e) => setAddForm((f) => ({ ...f, membership_type_id: e.target.value }))}>
                <option value="">—</option>
                {membershipTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
            <div className={styles.formButtonGroup}>
              <Button type="submit" disabled={addSaving} className={styles.btnSm}>Add</Button>
              <Button type="button" variant="secondary" onClick={() => setAdding(false)} className={styles.btnSm}>Cancel</Button>
            </div>
          </form>
          )}
        </Card>
      )}

      <Card className={styles.tableCard}>
        <Table className={styles.memberTable}>
          <Thead>
            <tr>
              {['Name', 'Email', 'Phone', 'eName', 'Membership type', 'Joined', ''].map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </Thead>
          <tbody>
            {[...(community?.members || [])].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '')).map((m) => {
              const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || 'Unknown'
              return (
                <tr key={m.personId}>
                  <Td className={styles.nameCell}>{name}</Td>
                  <Td muted>{m.email || '—'}</Td>
                  <Td muted>{m.phone || '—'}</Td>
                  <Td>
                    {m.ename ? (
                      <span
                        onClick={() => handleCopyEname(m.personId, m.ename)}
                        title="Click to copy"
                        className={styles.enameCopy}
                      >
                        {'@' + m.ename.replace(/^@/, '').slice(0, 6) + '...'}
                        {copiedId === m.personId && (
                          <span className={styles.copiedBadge}>Copied!</span>
                        )}
                      </span>
                    ) : (
                      <span className={styles.enameEmpty}>—</span>
                    )}
                  </Td>
                  <Td
                    onMouseEnter={() => setHoverCell(`${m.personId}:type`)}
                    onMouseLeave={() => setHoverCell((c) => (c === `${m.personId}:type` ? null : c))}
                  >
                    {editingCell === `${m.personId}:type` ? (
                      <Select
                        autoFocus
                        className={styles.inlineSelect}
                        value={m.membershipTypeId || ''}
                        onChange={(e) => { handleUpdate(m.personId, { membership_type_id: e.target.value || null }); setEditingCell(null) }}
                        onBlur={() => setEditingCell(null)}
                      >
                        <option value="">—</option>
                        {membershipTypes.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </Select>
                    ) : (
                      <span className={styles.inlineCellRow}>
                        {(() => {
                          const t = membershipTypes.find((t) => t.id === m.membershipTypeId)
                          return t ? <span title={t.name} className={`emoji-mono ${styles.emojiLarge}`}>{t.emoji || t.name}</span> : <span className={styles.typeEmpty}>—</span>
                        })()}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={styles.editableCell}
                          onClick={() => setEditingCell(`${m.personId}:type`)}
                          title="Edit membership type"
                          style={{ visibility: hoverCell === `${m.personId}:type` ? 'visible' : 'hidden' }}
                        >
                          {pencilIcon}
                        </Button>
                      </span>
                    )}
                  </Td>
                  <Td
                    onMouseEnter={() => setHoverCell(`${m.personId}:joined`)}
                    onMouseLeave={() => setHoverCell((c) => (c === `${m.personId}:joined` ? null : c))}
                  >
                    {editingCell === `${m.personId}:joined` ? (
                      <input
                        type="date"
                        autoFocus
                        value={m.joinedAt ? m.joinedAt.slice(0, 10) : ''}
                        onChange={(e) => { handleUpdate(m.personId, { joined_at: e.target.value || null }); setEditingCell(null) }}
                        onBlur={() => setEditingCell(null)}
                        className={styles.dateInput}
                      />
                    ) : (
                      <span className={styles.inlineCellRow}>
                        <span className={styles.joinedDateText}>
                          {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={styles.editableCell}
                          onClick={() => setEditingCell(`${m.personId}:joined`)}
                          title="Edit joined date"
                          style={{ visibility: hoverCell === `${m.personId}:joined` ? 'visible' : 'hidden' }}
                        >
                          {pencilIcon}
                        </Button>
                      </span>
                    )}
                  </Td>
                  <Td>
                    <button
                      onClick={() => handleRemove(m.personId, name)}
                      title="Remove from community"
                      className={styles.deleteBtn}
                    >
                      <TrashIcon size={15} />
                    </button>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </Page>
  )
}
