import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Panel, Avatar, MenuItem } from '@ecommons/ui'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import { useTopBarSlot } from '../context/TopBarSlotContext'

function CommunityLogo({ src }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={src}
      alt="logo"
      onError={() => setFailed(true)}
      style={{ height: 48, maxWidth: 150, objectFit: 'contain', flexShrink: 0 }}
    />
  )
}

export default function TopBar() {
  const { user, memberships, logout } = useUser()
  const { communityId, community, myMembership, switchCommunity } = useCommunity()
  const { slot } = useTopBarSlot()
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)

  const isAdmin = myMembership?.isAdmin ?? false
  const isWorkgroupAdmin = community?.workgroups?.some((wg) =>
    wg.members?.some((m) => m.person_id === user?.id && m.is_workgroup_admin)
  ) ?? false

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  function handleLogout() {
    setShowMenu(false)
    logout()
    navigate('/')
  }

  const initial = (user?.firstName || user?.ename || '?')[0].toUpperCase()

  return (
    <header style={{
      background: 'white',
      padding: '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 200,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 76,
      }}>

        {/* Left: community logo + name (click → home) */}
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, cursor: 'pointer' }}
        >
          {community?.logo_url && <CommunityLogo src={community.logo_url} />}
          {!community?.logo_url && (
            <span style={{
              fontFamily: 'var(--font-title)',
              fontWeight: 700,
              fontSize: '1.05rem',
              color: 'var(--color-charcoal)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {community?.name || 'CORE'}
            </span>
          )}
        </div>

        {/* Right: avatar + dropdown */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(v => !v)}
            title={user?.firstName || user?.ename}
            style={{ border: 'none', cursor: 'pointer', padding: 0, background: 'none', flexShrink: 0 }}
          >
            <Avatar
              src={user?.avatarUrl}
              size={51}
              background={isAdmin ? 'var(--color-terracotta)' : 'var(--color-sand-dark)'}
              fontSize="1.3rem"
              fontWeight={600}
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              {initial}
            </Avatar>
          </button>

          {showMenu && (
            <Panel style={{
              position: 'absolute', top: 42, right: 0, zIndex: 1000,
              background: 'white', minWidth: 200, overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-sand)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-charcoal)' }}>
                  {user?.firstName || user?.ename || 'You'}
                </div>
              </div>

              <MenuItem onClick={() => { setShowMenu(false); navigate('/') }}>
                My community
              </MenuItem>
              <MenuItem onClick={() => { setShowMenu(false); navigate('/profile') }}>
                My profile
              </MenuItem>
              <MenuItem onClick={() => { setShowMenu(false); navigate('/my-workgroups') }}>
                My workgroups
              </MenuItem>
              <MenuItem onClick={() => { setShowMenu(false); navigate('/my-availability') }}>
                My availability
              </MenuItem>

              {(isAdmin || isWorkgroupAdmin) && (
                <MenuItem onClick={() => { setShowMenu(false); navigate('/admin') }}>
                  Admin
                </MenuItem>
              )}

              {memberships.length > 1 && (
                <>
                  <div style={{ borderTop: '1px solid var(--color-sand)', padding: '8px 16px 2px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-charcoal-light)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Communities
                  </div>
                  {memberships.map((m) => (
                    <MenuItem
                      key={m.communityId}
                      onClick={() => { setShowMenu(false); switchCommunity(m.communityId); navigate('/') }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: m.communityId === communityId ? 600 : 400 }}>
                          {m.community?.name || m.communityId}
                        </span>
                        {m.communityId === communityId && (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-terracotta)', flexShrink: 0 }} />
                        )}
                      </span>
                    </MenuItem>
                  ))}
                </>
              )}

              <div style={{ borderTop: '1px solid var(--color-sand)' }}>
                <MenuItem onClick={handleLogout} danger>
                  Log out
                </MenuItem>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Page title / filters slot — centered on the header on desktop, drops to its own full-width row on mobile */}
      {slot && <div className="topbar-slot-row">{slot}</div>}
    </header>
  )
}
