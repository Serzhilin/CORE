import { useState, useEffect } from 'react'
import { CollapsiblePanel, Badge, Avatar, SectionLabel } from '@ecommons/ui'
import { useCommunity } from '../context/CommunityContext'
import styles from './InfoPanel.module.css'

const PANEL_WIDTH = 300

function formatDots(dateStr) {
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

function accentColor(selection, community) {
  if (!selection || selection.type === 'community') return 'var(--color-terracotta)'
  if (selection.type === 'workgroup') {
    const wg = community?.workgroups.find(w => w.id === selection.id)
    return wg?.color ?? 'var(--color-terracotta)'
  }
  if (selection.type === 'person') {
    if (selection.fromWorkgroup) {
      const wg = community?.workgroups.find(w => w.id === selection.fromWorkgroup)
      return wg?.color ?? 'var(--color-terracotta)'
    }
    return 'var(--color-terracotta)'
  }
  return 'var(--color-terracotta)'
}

function CommunityView({ community, onSelect }) {
  return (
    <div className={`stack ${styles.communityRoot}`}>
      <div>
        <div className={styles.communityName}>
          {community.name}
        </div>
        <div className={styles.communitySubtitle}>
          {community.members.length} members · {community.workgroups.length} workgroups
        </div>
      </div>
      <div className={styles.listSection}>
        <SectionLabel as="div" fontSize="0.7rem" fontWeight={700} className={styles.sectionLabelGap}>
          Workgroups
        </SectionLabel>
        {[...community.workgroups].sort((a, b) => a.name.localeCompare(b.name)).map(wg => (
          <div
            key={wg.id}
            onClick={() => onSelect({ type: 'workgroup', id: wg.id })}
            className={`row ${styles.workgroupRow}`}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-cream)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span className={styles.workgroupDot} style={{ background: wg.color }} />
            <span className={styles.workgroupRowName}>{wg.name}</span>
            <span className={styles.workgroupRowCount}>{wg.members.length}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WorkgroupView({ wg, community, onSelect, onBack, onFilterToWorkgroup }) {
  const members = wg.members
    .map(wm => ({ wm, member: community.members.find(m => m.personId === wm.person_id) }))
    .filter(x => x.member)
    .sort((a, b) => (a.member.firstName || '').localeCompare(b.member.firstName || ''))

  return (
    <div className={`stack ${styles.workgroupRoot}`}>
      <div className={`row ${styles.workgroupHeader}`}>
        <button onClick={onBack} className={styles.backButton}>‹</button>
        <div>
          <div className={styles.workgroupTitle} style={{ borderLeftColor: wg.color }}>{wg.name}</div>
          <div className={styles.workgroupMemberCount}>{wg.members.length} members</div>
        </div>
      </div>
      {wg.description && <div className={styles.workgroupDescription}>{wg.description}</div>}

      <div className={styles.membersList}>
        <SectionLabel as="div" fontSize="0.7rem" fontWeight={700} className={styles.sectionLabelGap}>Members</SectionLabel>
        {members.map(({ wm, member }) => {
          const roles = (wm.roles || []).map(rid => wg.roles.find(r => r.id === rid)).filter(Boolean)
          const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'
          return (
            <div
              key={member.personId}
              onClick={() => onSelect({ type: 'person', id: member.personId, fromWorkgroup: wg.id })}
              className={`row ${styles.memberRow}`}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-cream)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span className={styles.memberDot} style={{ background: wg.color }} />
              <div className={styles.memberInfo}>
                <div className={styles.memberName}>{name}</div>
                {roles.length > 0 && (
                  <div className={styles.memberRoles} style={{ color: wg.color }}>{roles.map(r => r.name).join(', ')}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => onFilterToWorkgroup(wg.id)}
        className={styles.filterButton}
        style={{ color: wg.color, borderColor: wg.color }}
      >
        Filter to this workgroup
      </button>
    </div>
  )
}

function PersonView({ member, community, fromWorkgroup, onBack }) {
  const wgMemberships = (community?.workgroups || [])
    .filter(wg => wg.members?.some(wm => wm.person_id === member.personId))
    .map(wg => {
      const wm = wg.members.find(wm => wm.person_id === member.personId)
      const roles = (wm?.roles || []).map(rid => wg.roles.find(r => r.id === rid)).filter(Boolean)
      return { wg, roles }
    })

  const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'
  const initial = (member.firstName || member.email || '?')[0].toUpperCase()

  return (
    <div className={`stack ${styles.personRoot}`}>
      <button onClick={onBack} className={`row ${styles.personBackButton}`}>
        ‹ {fromWorkgroup ? (community.workgroups.find(w => w.id === fromWorkgroup)?.name ?? 'Back') : 'Back'}
      </button>

      <div className={`row ${styles.avatarRow}`}>
        <Avatar src={member.avatarUrl} size={104} fontSize="2.2rem">{initial}</Avatar>
        <div>
          <div className={styles.personName}>{name}</div>
          <div className={`row ${styles.badgeRow}`}>
            {member.isAdmin && <Badge variant="plain" className={styles.adminBadge}>Admin</Badge>}
            {member.membershipType && (
              <Badge variant="plain" className={styles.membershipTypeBadge}>
                {member.membershipType.emoji ? <span className="emoji-mono">{member.membershipType.emoji} </span> : ''}{member.membershipType.name}
              </Badge>
            )}
            {member.joinedAt && (
              <span className={styles.joinedLabel}>
                Joined on {formatDots(member.joinedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {member.bio && (
        <div className={styles.bioText}>{member.bio}</div>
      )}

      {member.availability && (
        <div className={styles.availabilityBox}>
          <span className={`emoji-mono ${styles.availabilityEmoji}`}>{member.availability.type.emoji}</span>
          <span className={styles.availabilityType}>{member.availability.type.name}</span>
          {member.availability.reason && <span className={styles.muted}> — {member.availability.reason}</span>}
          {member.availability.until && (
            <div className={styles.availabilityUntil}>
              Until {new Date(member.availability.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
      )}

      {(member.email || member.phone || member.website) && (
        <div className={`stack ${styles.sectionDivider} ${styles.stackGap4}`}>
          {member.email && <div className={styles.contactRow}>{member.email}</div>}
          {member.phone && <div className={styles.contactRow}>{member.phone}</div>}
          {member.website && <div className={styles.contactRow}><a href={member.website} target="_blank" rel="noopener noreferrer" className={styles.contactLink}>{member.website}</a></div>}
        </div>
      )}

      {wgMemberships.length > 0 && (
        <div className={styles.sectionDivider}>
          <SectionLabel as="div" fontSize="0.7rem" fontWeight={700} className={styles.sectionLabelGap}>Workgroups</SectionLabel>
          {wgMemberships.map(({ wg, roles }) => (
            <div key={wg.id} className={styles.membershipItem} style={{ borderLeftColor: wg.color }}>
              <div className={styles.membershipName}>{wg.name}</div>
              {roles.length > 0 && (
                <div className={styles.membershipRoles}>
                  {roles.map(r => (
                    <Badge key={r.id} color={r.color} className={styles.roleBadge}>{r.name}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

export default function InfoPanel({ selection, onSelect, onFilterToWorkgroup }) {
  const { community } = useCommunity()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!selection) return
    if (isMobile || selection.type === 'person') setOpen(true)
  }, [selection])

  if (!community) return null

  const accent = accentColor(selection, community)

  function handleBack() {
    if (!selection || selection.type === 'community') return
    if (selection.type === 'workgroup') { onSelect(null); return }
    if (selection.type === 'person') {
      if (selection.fromWorkgroup) {
        onSelect({ type: 'workgroup', id: selection.fromWorkgroup })
      } else {
        onSelect(null)
      }
    }
  }

  function renderContent() {
    if (!selection || selection.type === 'community') {
      return <CommunityView community={community} onSelect={onSelect} />
    }
    if (selection.type === 'workgroup') {
      const wg = community.workgroups.find(w => w.id === selection.id)
      if (!wg) return null
      return <WorkgroupView wg={wg} community={community} onSelect={onSelect} onBack={handleBack} onFilterToWorkgroup={onFilterToWorkgroup} />
    }
    if (selection.type === 'person') {
      const member = community.members.find(m => m.personId === selection.id)
      if (!member) return null
      return <PersonView member={member} community={community} fromWorkgroup={selection.fromWorkgroup} onBack={handleBack} />
    }
    return null
  }

  if (isMobile) {
    if (!open) return null
    return (
      <>
        <div onClick={() => { setOpen(false); onSelect(null) }} className={styles.mobileDrawerOverlay} />
        <div className={styles.mobileDrawer} style={{ borderLeftColor: accent }}>
          <button
            onClick={() => { setOpen(false); onSelect(null) }}
            className={styles.mobileDrawerClose}
          >×</button>
          {renderContent()}
        </div>
      </>
    )
  }

  return (
    <CollapsiblePanel open={open} onToggle={() => setOpen(v => !v)} accentColor={accent} width={PANEL_WIDTH}>
      {renderContent()}
    </CollapsiblePanel>
  )
}
