import { useState, useEffect } from 'react'
import { useCommunity } from '../context/CommunityContext'

const PANEL_WIDTH = 300
const TAB_WIDTH = 28

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div>
        <div style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '1.1rem', marginBottom: 4 }}>
          {community.name}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>
          {community.members.length} members · {community.workgroups.length} workgroups
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--color-sand)', paddingTop: 12, flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)', marginBottom: 8 }}>
          Workgroups
        </div>
        {[...community.workgroups].sort((a, b) => a.name.localeCompare(b.name)).map(wg => (
          <div
            key={wg.id}
            onClick={() => onSelect({ type: 'workgroup', id: wg.id })}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', borderRadius: 6 }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-charcoal-light)', fontSize: '1.1rem', lineHeight: 1, padding: '2px 4px', marginLeft: -4 }}>‹</button>
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '1rem', borderLeft: `3px solid ${wg.color}`, paddingLeft: 8 }}>{wg.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-light)', marginTop: 2 }}>{wg.members.length} members</div>
        </div>
      </div>
      {wg.description && <div style={{ fontSize: '0.82rem', color: 'var(--color-charcoal-light)', lineHeight: 1.5 }}>{wg.description}</div>}

      <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--color-sand)', paddingTop: 8 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)', marginBottom: 8 }}>Members</div>
        {members.map(({ wm, member }) => {
          const roles = (wm.roles || []).map(rid => wg.roles.find(r => r.id === rid)).filter(Boolean)
          const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || 'Unknown'
          return (
            <div
              key={member.personId}
              onClick={() => onSelect({ type: 'person', id: member.personId, fromWorkgroup: wg.id })}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '5px 4px', cursor: 'pointer', borderRadius: 5 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-cream)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: wg.color, flexShrink: 0, marginTop: 4 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{name}</div>
                {roles.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: wg.color, marginTop: 1 }}>{roles.map(r => r.name).join(', ')}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => onFilterToWorkgroup(wg.id)}
        style={{ fontSize: '0.75rem', color: wg.color, background: 'none', border: `1px solid ${wg.color}`, borderRadius: 5, padding: '5px 10px', cursor: 'pointer', width: '100%' }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-charcoal-light)', fontSize: '0.82rem', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        ‹ {fromWorkgroup ? (community.workgroups.find(w => w.id === fromWorkgroup)?.name ?? 'Back') : 'Back'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {member.avatarUrl
          ? <img src={member.avatarUrl} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-sand-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>{initial}</div>
        }
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '0.95rem', lineHeight: 1.3 }}>{name}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {member.isAdmin && <span style={{ fontSize: '0.68rem', background: 'var(--color-sand)', borderRadius: 4, padding: '1px 6px' }}>Admin</span>}
            {member.membershipType && (
              <span style={{ fontSize: '0.68rem', background: '#FFF3CD', borderRadius: 4, padding: '1px 6px' }}>
                {member.membershipType.emoji ? `${member.membershipType.emoji} ` : ''}{member.membershipType.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {member.bio && (
        <div style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-light)', lineHeight: 1.6, borderTop: '1px solid var(--color-sand)', paddingTop: 10 }}>{member.bio}</div>
      )}

      {member.availability && (
        <div style={{ background: 'var(--color-sand)', borderRadius: 8, padding: '9px 12px', fontSize: '0.85rem' }}>
          <span style={{ marginRight: 5 }}>{member.availability.type.emoji}</span>
          <span style={{ fontWeight: 500 }}>{member.availability.type.name}</span>
          {member.availability.reason && <span style={{ color: 'var(--color-charcoal-light)' }}> — {member.availability.reason}</span>}
          {member.availability.until && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-charcoal-light)', marginTop: 3 }}>
              Until {new Date(member.availability.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
      )}

      {wgMemberships.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-sand)', paddingTop: 10 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)', marginBottom: 8 }}>Workgroups</div>
          {wgMemberships.map(({ wg, roles }) => (
            <div key={wg.id} style={{ borderLeft: `3px solid ${wg.color}`, paddingLeft: 10, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{wg.name}</div>
              {roles.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {roles.map(r => (
                    <span key={r.id} style={{ fontSize: '0.72rem', background: r.color + '22', border: `1px solid ${r.color}66`, borderRadius: 4, padding: '1px 6px' }}>{r.name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {member.joinedAt && (
        <div style={{ borderTop: '1px solid var(--color-sand)', paddingTop: 10, fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>
          Member since {new Date(member.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
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
    if (selection) setOpen(true)
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
          boxShadow: '-4px 0 24px rgba(44,44,44,0.15)',
          zIndex: 500, overflowY: 'auto',
          padding: '20px 16px', boxSizing: 'border-box',
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
    <div style={{ display: 'flex', flexShrink: 0 }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          width: TAB_WIDTH, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', background: 'white',
          borderLeft: `3px solid ${accent}`,
          transition: 'border-color 0.2s',
          userSelect: 'none',
        }}
        title={open ? 'Close panel' : 'Open panel'}
      >
        <span style={{ fontSize: '1rem', color: accent, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>›</span>
      </div>

      <div style={{
        width: open ? PANEL_WIDTH : 0,
        overflow: 'hidden',
        transition: 'width 0.2s ease',
        background: 'white',
        borderLeft: '1px solid var(--color-sand)',
        boxShadow: open ? '-4px 0 16px rgba(44,44,44,0.06)' : 'none',
      }}>
        <div style={{ width: PANEL_WIDTH, height: '100%', overflowY: 'auto', padding: '20px 16px', boxSizing: 'border-box' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
