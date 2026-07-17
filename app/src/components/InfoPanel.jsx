import { useState, useEffect } from 'react'
import { CollapsiblePanel, Badge, Avatar, SectionLabel } from '@ecommons/ui'
import { useCommunity } from '../context/CommunityContext'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)', height: '100%' }}>
      <div>
        <div style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '1.1rem', marginBottom: 'var(--space-4)' }}>
          {community.name}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>
          {community.members.length} members · {community.workgroups.length} workgroups
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--color-sand)', paddingTop: 'var(--space-12)', flex: 1, overflowY: 'auto' }}>
        <SectionLabel as="div" fontSize="0.7rem" fontWeight={700} style={{ marginBottom: 'var(--space-8)' }}>
          Workgroups
        </SectionLabel>
        {[...community.workgroups].sort((a, b) => a.name.localeCompare(b.name)).map(wg => (
          <div
            key={wg.id}
            onClick={() => onSelect({ type: 'workgroup', id: wg.id })}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', padding: 'var(--space-6) var(--space-4)', cursor: 'pointer', borderRadius: 0 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-cream)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: wg.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 500 }}>{wg.name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-light)' }}>{wg.members.length}</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-8)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-charcoal-light)', fontSize: '1.1rem', lineHeight: 1, padding: 'var(--space-2) var(--space-4)', marginLeft: -4 }}>‹</button>
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '1rem', borderLeft: `3px solid ${wg.color}`, paddingLeft: 'var(--space-8)' }}>{wg.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-light)', marginTop: 'var(--space-2)' }}>{wg.members.length} members</div>
        </div>
      </div>
      {wg.description && <div style={{ fontSize: '0.82rem', color: 'var(--color-charcoal-light)', lineHeight: 1.5 }}>{wg.description}</div>}

      <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--color-sand)', paddingTop: 'var(--space-8)' }}>
        <SectionLabel as="div" fontSize="0.7rem" fontWeight={700} style={{ marginBottom: 'var(--space-8)' }}>Members</SectionLabel>
        {members.map(({ wm, member }) => {
          const roles = (wm.roles || []).map(rid => wg.roles.find(r => r.id === rid)).filter(Boolean)
          const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'
          return (
            <div
              key={member.personId}
              onClick={() => onSelect({ type: 'person', id: member.personId, fromWorkgroup: wg.id })}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-6)', padding: 'var(--space-5) var(--space-4)', cursor: 'pointer', borderRadius: 0 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-cream)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: wg.color, flexShrink: 0, marginTop: 'var(--space-4)' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{name}</div>
                {roles.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: wg.color, marginTop: 'var(--space-2)' }}>{roles.map(r => r.name).join(', ')}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => onFilterToWorkgroup(wg.id)}
        style={{ fontSize: '0.75rem', color: wg.color, background: 'none', border: `1px solid ${wg.color}`, borderRadius: 0, padding: 'var(--space-5) var(--space-10)', cursor: 'pointer', width: '100%' }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-14)', height: '100%', overflowY: 'auto' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-charcoal-light)', fontSize: '0.82rem', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        ‹ {fromWorkgroup ? (community.workgroups.find(w => w.id === fromWorkgroup)?.name ?? 'Back') : 'Back'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
        <Avatar src={member.avatarUrl} size={104} fontSize="2.2rem">{initial}</Avatar>
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '1.3rem', lineHeight: 1.3 }}>{name}</div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center', marginTop: 'var(--space-4)' }}>
            {member.isAdmin && <Badge variant="plain" style={{ fontSize: '0.68rem', background: 'var(--color-sand)', padding: 'var(--space-2) var(--space-6)' }}>Admin</Badge>}
            {member.membershipType && (
              <Badge variant="plain" style={{ fontSize: '0.68rem', border: '1px solid var(--color-sand-dark)', padding: 'var(--space-2) var(--space-6)' }}>
                {member.membershipType.emoji ? <span className="emoji-mono">{member.membershipType.emoji} </span> : ''}{member.membershipType.name}
              </Badge>
            )}
            {member.joinedAt && (
              <span style={{ fontSize: '0.68rem', color: 'var(--color-charcoal-light)' }}>
                Joined on {formatDots(member.joinedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {member.bio && (
        <div style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-light)', lineHeight: 1.6 }}>{member.bio}</div>
      )}

      {member.availability && (
        <div style={{ background: 'var(--color-sand)', borderRadius: 0, padding: '9px 12px', fontSize: '0.85rem', borderTop: '1px solid var(--color-sand-dark)', marginTop: 'var(--space-4)', paddingTop: '9px' }}>
          <span className="emoji-mono" style={{ marginRight: 'var(--space-5)' }}>{member.availability.type.emoji}</span>
          <span style={{ fontWeight: 500 }}>{member.availability.type.name}</span>
          {member.availability.reason && <span style={{ color: 'var(--color-charcoal-light)' }}> — {member.availability.reason}</span>}
          {member.availability.until && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-charcoal-light)', marginTop: 'var(--space-3)' }}>
              Until {new Date(member.availability.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
      )}

      {(member.email || member.phone || member.website) && (
        <div style={{ borderTop: '1px solid var(--color-sand)', paddingTop: 'var(--space-10)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {member.email && <div style={{ fontSize: '0.82rem' }}>{member.email}</div>}
          {member.phone && <div style={{ fontSize: '0.82rem' }}>{member.phone}</div>}
          {member.website && <div style={{ fontSize: '0.82rem' }}><a href={member.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-charcoal)' }}>{member.website}</a></div>}
        </div>
      )}

      {wgMemberships.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-sand)', paddingTop: 'var(--space-10)' }}>
          <SectionLabel as="div" fontSize="0.7rem" fontWeight={700} style={{ marginBottom: 'var(--space-8)' }}>Workgroups</SectionLabel>
          {wgMemberships.map(({ wg, roles }) => (
            <div key={wg.id} style={{ borderLeft: `3px solid ${wg.color}`, paddingLeft: 'var(--space-10)', marginBottom: 'var(--space-8)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{wg.name}</div>
              {roles.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginTop: 'var(--space-4)' }}>
                  {roles.map(r => (
                    <Badge key={r.id} color={r.color} style={{ fontSize: '0.72rem', padding: 'var(--space-2) var(--space-6)' }}>{r.name}</Badge>
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
        <div onClick={() => { setOpen(false); onSelect(null) }} style={{ position: 'fixed', inset: 0, zIndex: 400 }} />
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '85vw', maxWidth: 340,
          background: 'white', borderLeft: `3px solid ${accent}`,
          boxShadow: '-4px 0 0 var(--block-shadow-color)',
          zIndex: 500, overflowY: 'auto',
          padding: 'var(--space-20) var(--space-16)', boxSizing: 'border-box',
        }}>
          <button
            onClick={() => { setOpen(false); onSelect(null) }}
            style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--color-charcoal-light)', lineHeight: 1 }}
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
