import { useState } from 'react'
import { Card, Badge, Select, Button, Heading, Page } from '@ecommons/ui'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import { useSetTopBarSlot } from '../context/TopBarSlotContext'
import { addWorkgroupMember, removeWorkgroupMember, assignRole, unassignRole } from '../api/client'
import styles from './MyWorkgroups.module.css'

export default function MyWorkgroups() {
  const { user } = useUser()
  const { community, refresh } = useCommunity()
  const [busy, setBusy] = useState({}) // { [wgId]: true } while API in-flight
  const [joinOpen, setJoinOpen] = useState(false)

  const allWorkgroups = community?.workgroups || []

  const joined = allWorkgroups
    .map((wg) => {
      const membership = wg.members.find((m) => m.person_id === user?.id)
      if (!membership) return null
      const roles = (membership.roles || [])
        .map((rid) => wg.roles.find((r) => r.id === rid))
        .filter(Boolean)
      const unassigned = wg.roles.filter((r) => !(membership.roles || []).includes(r.id))
      return { wg, membership, roles, unassigned }
    })
    .filter(Boolean)
    .sort((a, b) => a.wg.name.localeCompare(b.wg.name))

  const available = allWorkgroups
    .filter((wg) => !wg.members.some((m) => m.person_id === user?.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function handleJoin(wg) {
    setBusy((s) => ({ ...s, [wg.id]: true }))
    try { await addWorkgroupMember(wg.id, { person_id: user.id }); await refresh() }
    catch (err) { alert(err.message) }
    setBusy((s) => ({ ...s, [wg.id]: false }))
  }

  async function handleLeave(wg) {
    if (!confirm(`Leave "${wg.name}"?`)) return
    const alsoRemoveFromChat = wg.chat_envelope_id
      ? confirm('Also remove yourself from its chat?')
      : false
    setBusy((s) => ({ ...s, [wg.id]: true }))
    try { await removeWorkgroupMember(wg.id, user.id, alsoRemoveFromChat); await refresh() }
    catch (err) { alert(err.message) }
    setBusy((s) => ({ ...s, [wg.id]: false }))
  }

  async function handleAssign(wg, roleId) {
    if (!roleId) return
    setBusy((s) => ({ ...s, [wg.id]: true }))
    try { await assignRole(wg.id, user.id, { role_id: roleId }); await refresh() }
    catch (err) { if (!err.message?.includes('409')) alert(err.message) }
    setBusy((s) => ({ ...s, [wg.id]: false }))
  }

  async function handleUnassign(wg, roleId) {
    setBusy((s) => ({ ...s, [wg.id]: true }))
    try { await unassignRole(wg.id, user.id, roleId); await refresh() }
    catch (err) { alert(err.message) }
    setBusy((s) => ({ ...s, [wg.id]: false }))
  }

  useSetTopBarSlot(
    <Heading>My workgroups</Heading>
  )

  return (
    <Page maxWidth={620}>
      {/* Joined workgroups */}
      {joined.length === 0 ? (
        <Card className={styles.emptyCard}>
          You are not a member of any workgroup yet.
        </Card>
      ) : (
        <div className={`stack ${styles.joinedList}`}>
          {joined.map(({ wg, roles, unassigned }) => (
            <Card key={wg.id} className={styles.workgroupRow} style={{ borderLeft: `4px solid ${wg.color}` }}>
              {/* Header row */}
              <div className={styles.rowHeader}>
                <span className={styles.wgName}>{wg.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLeave(wg)}
                  disabled={busy[wg.id]}
                  title="Leave workgroup"
                  className={styles.leaveButton}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </Button>
              </div>

              {/* Roles row */}
              <div className={`row ${styles.rolesRow}`}>
                {unassigned.length > 0 && (
                  <Select
                    value=""
                    onChange={(e) => handleAssign(wg, e.target.value)}
                    disabled={busy[wg.id]}
                    className={styles.roleSelect}
                  >
                    <option value="">+ Role</option>
                    {unassigned.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </Select>
                )}

                {roles.map((r) => (
                  <Badge
                    key={r.id}
                    color={r.color}
                    className={styles.roleBadge}
                    style={{ background: `${r.color}20` }}
                  >
                    <span className={styles.roleDot} style={{ background: r.color }} />
                    {r.name}
                    <button
                      onClick={() => handleUnassign(wg, r.id)}
                      disabled={busy[wg.id]}
                      className={styles.unassignButton}
                    >×</button>
                  </Badge>
                ))}

              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Available workgroups */}
      {available.length > 0 && (
        <div>
          <button
            onClick={() => setJoinOpen(v => !v)}
            className={`row ${styles.joinSection}`}
            style={{ marginBottom: joinOpen ? 12 : 0 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={styles.chevron} style={{ transform: joinOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span className={styles.joinLabel}>
              Join a workgroup
            </span>
          </button>
          {joinOpen && <div className="stack">
            {available.map((wg) => (
              <div
                key={wg.id}
                className={`row ${styles.availableRow}`}
              >
                <span className={styles.availableDot} style={{ background: wg.color }} />
                <span className={styles.availableName}>{wg.name}</span>
                <span className={styles.memberCount}>
                  {wg.members.length} {wg.members.length === 1 ? 'member' : 'members'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleJoin(wg)}
                  disabled={busy[wg.id]}
                  title="Join workgroup"
                  className={styles.joinButton}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                </Button>
              </div>
            ))}
          </div>}
        </div>
      )}
    </Page>
  )
}
