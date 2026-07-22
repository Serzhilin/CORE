import { Modal, Badge, Avatar, SectionLabel, Heading } from '@ecommons/ui'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import AvailabilityBadge from './AvailabilityBadge'
import styles from './PersonModal.module.css'

export default function PersonModal({ member, onClose }) {
  const { user } = useUser()
  const { community } = useCommunity()

  if (!member) return null

  const myMembership = community?.members.find((m) => m.personId === user?.id)
  const isAdmin = myMembership?.isAdmin ?? false
  const isOwn = member.personId === user?.id

  // Workgroup memberships for this person
  const wgMemberships = community?.workgroups
    .filter((wg) => wg.members?.some((wm) => wm.person_id === member.personId))
    .map((wg) => {
      const wm = wg.members.find((wm) => wm.person_id === member.personId)
      const roles = (wm?.roles || []).map((rid) => wg.roles.find((r) => r.id === rid)).filter(Boolean)
      return { workgroup: wg, roles }
    }) || []

  return (
    <Modal onOverlayClick={onClose} className={styles.panelWrap}>
      {/* Header */}
      <div className={styles.modalHeader}>
        <div className={styles.headerAvatarRow}>
          <Avatar src={member.avatarUrl} size={52} fontSize="1.2rem" fontWeight={600}>
            {(member.firstName || member.email || '?')[0].toUpperCase()}
          </Avatar>
          <div>
            <Heading as="h2" fontSize="1.3rem" className={styles.modalTitle}>
              {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'}
            </Heading>
            <div className={styles.headerBadgeRow}>
              {member.isAdmin && <Badge variant="plain" className={styles.adminBadge}>Admin</Badge>}
              {member.membershipType && (
                <Badge variant="plain" className={styles.membershipTypeBadge}>
                  {member.membershipType.emoji ? <span className="emoji-mono">{member.membershipType.emoji} </span> : ''}{member.membershipType.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <button onClick={onClose} className={styles.closeButton}>×</button>
      </div>

      {/* Contact */}
      {member.email && (
        <p className={styles.contactText}>
          📧 {member.email}
        </p>
      )}

      {/* Availability */}
      {member.availability && (
        <div className={styles.availabilityBox}>
          <AvailabilityBadge availability={member.availability} /> {member.availability.type.name}
          {member.availability.reason && <span className={styles.muted}> — {member.availability.reason}</span>}
          {member.availability.until && <span className={styles.muted}> (until {member.availability.until})</span>}
        </div>
      )}

      {/* Workgroups */}
      {wgMemberships.length > 0 && (
        <div className={styles.workgroupsSection}>
          <SectionLabel as="h4" fontSize="0.85rem" className={styles.sectionLabelGap}>Workgroups</SectionLabel>
          {wgMemberships.map(({ workgroup, roles }) => (
            <div key={workgroup.id} className={styles.workgroupRow}>
              <span className={styles.workgroupDot} style={{ background: workgroup.color }} />
              <span className={styles.workgroupName}>{workgroup.name}</span>
              {roles.length > 0 && (
                <span className={styles.workgroupRoles}>
                  — {roles.map((r) => r.name).join(', ')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
