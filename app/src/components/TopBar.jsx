import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'

function CommunityLogo({ src }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={src}
      alt="logo"
      onError={() => setFailed(true)}
      style={{ height: 32, maxWidth: 100, objectFit: 'contain', flexShrink: 0 }}
    />
  )
}

export default function TopBar() {
  const { user, memberships, logout } = useUser()
  const { communityId, community, myMembership, switchCommunity } = useCommunity()
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
      borderBottom: '1px solid var(--color-sand)',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
      }}>

        {/* Left: community logo + name (click → home) */}
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, cursor: 'pointer' }}
        >
          {community?.logo_url && <CommunityLogo src={community.logo_url} />}
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

          {memberships.length > 1 && (
            <select
              value={communityId || ''}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => switchCommunity(e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: 6, fontSize: '0.8rem',
                border: '1px solid var(--color-sand-dark)', background: 'white', cursor: 'pointer',
              }}
            >
              {memberships.map((m) => (
                <option key={m.communityId} value={m.communityId}>
                  {m.community?.name || m.communityId}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: avatar + dropdown */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(v => !v)}
            title={user?.firstName || user?.ename}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: isAdmin ? 'var(--color-terracotta)' : 'var(--color-sand-dark)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.88rem', color: 'white', fontWeight: 600,
              fontFamily: 'Inter, sans-serif', flexShrink: 0,
            }}
          >
            {initial}
          </button>

          {showMenu && (
            <div style={{
              position: 'absolute', top: 42, right: 0, zIndex: 100,
              background: 'white', border: '1px solid var(--color-sand)',
              borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              minWidth: 200, overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-sand)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-charcoal)' }}>
                  {user?.firstName || user?.ename || 'You'}
                </div>
              </div>

              <MenuItem onClick={() => { setShowMenu(false); navigate('/') }}>
                🏡 My community
              </MenuItem>
              <MenuItem onClick={() => { setShowMenu(false); navigate('/profile') }}>
                👋 My profile
              </MenuItem>
              <MenuItem onClick={() => { setShowMenu(false); navigate('/my-workgroups') }}>
                🔧 My workgroups
              </MenuItem>
              <MenuItem onClick={() => { setShowMenu(false); navigate('/my-availability') }}>
                📅 My availability
              </MenuItem>

              {(isAdmin || isWorkgroupAdmin) && (
                <MenuItem onClick={() => { setShowMenu(false); navigate('/admin') }}>
                  ⚙️ Admin
                </MenuItem>
              )}

              <div style={{ borderTop: '1px solid var(--color-sand)' }}>
                <MenuItem onClick={handleLogout} danger>
                  Log out
                </MenuItem>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function MenuItem({ onClick, children, danger = false }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '10px 16px', border: 'none', cursor: 'pointer',
        fontSize: '0.88rem', fontFamily: 'Inter, sans-serif',
        background: hover ? 'var(--color-cream)' : 'white',
        color: danger ? 'var(--color-red)' : 'var(--color-charcoal)',
      }}
    >
      {children}
    </button>
  )
}
