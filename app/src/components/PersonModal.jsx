import { Card, Badge, Avatar, SectionLabel, Heading } from '@ecommons/ui'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import AvailabilityBadge from './AvailabilityBadge'

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
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(44,44,44,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-24)',
      }}
      onClick={onClose}
    >
      <Card
        style={{ maxWidth: 480, width: '100%', padding: 'var(--space-32)', maxHeight: '80vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-20)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-14)' }}>
            <Avatar src={member.avatarUrl} size={52} fontSize="1.2rem" fontWeight={600}>
              {(member.firstName || member.email || '?')[0].toUpperCase()}
            </Avatar>
            <div>
              <Heading as="h2" fontSize="1.3rem" style={{ margin: '0 0 var(--space-4)' }}>
                {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'}
              </Heading>
              <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                {member.isAdmin && <Badge variant="plain" style={{ fontSize: '0.75rem', background: 'var(--color-sand)', padding: 'var(--space-2) var(--space-8)' }}>Admin</Badge>}
                {member.membershipType && (
                  <Badge variant="plain" style={{ fontSize: '0.75rem', background: '#FFF3CD', padding: 'var(--space-2) var(--space-8)' }}>
                    {member.membershipType.emoji ? <span className="emoji-mono">{member.membershipType.emoji} </span> : ''}{member.membershipType.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--color-charcoal-light)', lineHeight: 1 }}>×</button>
        </div>

        {/* Contact */}
        {member.email && (
          <p style={{ margin: '0 0 var(--space-8)', fontSize: '0.9rem', color: 'var(--color-charcoal-light)' }}>
            📧 {member.email}
          </p>
        )}

        {/* Availability */}
        {member.availability && (
          <div style={{ background: 'var(--color-sand)', borderRadius: 0, padding: 'var(--space-10) var(--space-14)', marginBottom: 'var(--space-16)', fontSize: '0.9rem' }}>
            <AvailabilityBadge availability={member.availability} /> {member.availability.type.name}
            {member.availability.reason && <span style={{ color: 'var(--color-charcoal-light)' }}> — {member.availability.reason}</span>}
            {member.availability.until && <span style={{ color: 'var(--color-charcoal-light)' }}> (until {member.availability.until})</span>}
          </div>
        )}

        {/* Workgroups */}
        {wgMemberships.length > 0 && (
          <div style={{ marginBottom: 'var(--space-16)' }}>
            <SectionLabel as="h4" fontSize="0.85rem" style={{ margin: '0 0 var(--space-8)' }}>Workgroups</SectionLabel>
            {wgMemberships.map(({ workgroup, roles }) => (
              <div key={workgroup.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: workgroup.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{workgroup.name}</span>
                {roles.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>
                    — {roles.map((r) => r.name).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

      </Card>
    </div>
  )
}
