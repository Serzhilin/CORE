import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Panel, Avatar, MenuItem, SectionLabel } from '@ecommons/ui'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'
import { useTopBarSlot } from '../context/TopBarSlotContext'
import styles from './TopBar.module.css'

function CommunityLogo({ src }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={src}
      alt="logo"
      onError={() => setFailed(true)}
      className={styles.logo}
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
    <header className={styles.header}>
      <div className={styles.headerRow}>

        {/* Left: CORE mark + community logo/name (click → home) */}
        <div
          onClick={() => navigate('/')}
          className={styles.brandLink}
        >
          <span className={styles.coreMark}>
            <img src="/logo.png" alt="CORE" className={styles.coreLogo} />
            <span className={styles.coreText}>
              CORE
            </span>
          </span>

          {community && (
            <span className={styles.forLabel}>
              for
            </span>
          )}

          {community?.logo_url && <CommunityLogo src={community.logo_url} />}
          {community && !community?.logo_url && (
            <span className={styles.communityName}>
              {community.name}
            </span>
          )}
        </div>

        {/* Right: avatar + dropdown */}
        <div ref={menuRef} className={styles.menuWrapper}>
          <button
            onClick={() => setShowMenu(v => !v)}
            title={user?.firstName || user?.ename}
            className={styles.avatarButton}
          >
            <Avatar
              src={user?.avatarUrl}
              size={51}
              background={isAdmin ? 'var(--color-terracotta)' : 'var(--color-sand-dark)'}
              fontSize="1.3rem"
              fontWeight={600}
              className={styles.avatarFont}
            >
              {initial}
            </Avatar>
          </button>

          {showMenu && (
            <Panel className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <div className={styles.dropdownHeaderName}>
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
                  <SectionLabel as="div" fontSize="0.68rem" fontWeight={700} letterSpacing="0.06em" className={styles.communitiesLabel}>
                    Communities
                  </SectionLabel>
                  {memberships.map((m) => (
                    <MenuItem
                      key={m.communityId}
                      onClick={() => { setShowMenu(false); switchCommunity(m.communityId); navigate('/') }}
                    >
                      <span className={styles.communityRow}>
                        <span className={styles.communityRowName} style={{ fontWeight: m.communityId === communityId ? 600 : 400 }}>
                          {m.community?.name || m.communityId}
                        </span>
                        {m.communityId === communityId && (
                          <span className={styles.statusDot} style={{ background: 'var(--color-terracotta)' }} />
                        )}
                      </span>
                    </MenuItem>
                  ))}
                </>
              )}

              <div className={styles.logoutWrapper}>
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
