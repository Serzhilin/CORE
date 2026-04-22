import { NavLink, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'

export default function Sidebar() {
  const { user, memberships, logout } = useUser()
  const { communityId, community, myMembership, switchCommunity } = useCommunity()
  const navigate = useNavigate()

  const isAdmin = myMembership?.isAdmin ?? false
  const isWorkgroupAdmin = community?.workgroups?.some((wg) =>
    wg.members?.some((m) => m.person_id === user?.id && m.is_workgroup_admin)
  ) ?? false

  const primaryColor = community?.primary_color || '#C4622D'

  function handleLogout() {
    logout()
    navigate('/')
  }

  const navStyle = {
    textDecoration: 'none', display: 'block', padding: '10px 16px', borderRadius: 8,
    color: 'var(--color-charcoal)', fontWeight: 500, fontSize: '0.95rem',
  }
  const activeStyle = { background: `${primaryColor}18`, color: primaryColor }

  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: 'white',
      borderRight: '1px solid rgba(212,197,176,0.4)', display: 'flex',
      flexDirection: 'column', padding: '24px 12px', flexShrink: 0,
    }}>
      {/* Community name / switcher */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.1rem', padding: '0 4px', marginBottom: 8 }}>
          {community?.name || 'CORE'}
        </div>
        {memberships.length > 1 && (
          <select
            value={communityId || ''}
            onChange={(e) => switchCommunity(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: '0.85rem',
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

      {/* Nav links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <NavLink to="/" end style={({ isActive }) => ({ ...navStyle, ...(isActive ? activeStyle : {}) })}>
          🗂 Organogram
        </NavLink>
        <NavLink to="/members" style={({ isActive }) => ({ ...navStyle, ...(isActive ? activeStyle : {}) })}>
          👥 Members
        </NavLink>
        <NavLink to="/profile" style={({ isActive }) => ({ ...navStyle, ...(isActive ? activeStyle : {}) })}>
          👤 My profile
        </NavLink>
        {(isAdmin || isWorkgroupAdmin) && (
          <NavLink to="/admin" style={({ isActive }) => ({ ...navStyle, ...(isActive ? activeStyle : {}) })}>
            ⚙️ Admin
          </NavLink>
        )}
      </nav>

      {/* User footer */}
      <div style={{ paddingTop: 16, borderTop: '1px solid var(--color-sand)', fontSize: '0.85rem', color: 'var(--color-charcoal-light)' }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>
          {user?.firstName || user?.ename || 'You'}
        </div>
        <button
          className="btn-secondary"
          onClick={handleLogout}
          style={{ width: '100%', fontSize: '0.8rem', padding: '6px 12px' }}
        >
          Log out
        </button>
      </div>
    </aside>
  )
}
