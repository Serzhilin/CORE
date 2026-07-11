import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom'
import { useCommunity } from '../context/CommunityContext'
import { useUser } from '../context/UserContext'
import { useSetTopBarSlot } from '../context/TopBarSlotContext'
import CommunityTab from './admin/CommunityTab'
import MembersTab from './admin/MembersTab'
import WorkgroupsTab from './admin/WorkgroupsTab'
import AvailabilityTab from './admin/AvailabilityTab'

const TABS = [
  { key: 'workgroups', label: 'Workgroups' },
  { key: 'members', label: 'Members' },
  { key: 'community', label: 'Community' },
  { key: 'availability', label: 'Availability' },
]

export default function AdminPanel() {
  const { community, myMembership } = useCommunity()
  const { user } = useUser()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isAdmin = myMembership?.isAdmin ?? false
  const isWorkgroupAdmin = community?.workgroups?.some((wg) =>
    wg.members?.some((wm) => wm.person_id === user?.id && wm.is_workgroup_admin)
  ) ?? false

  useSetTopBarSlot(
    <span style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '2rem', color: 'var(--color-charcoal)' }}>Admin</span>
  )

  if (!isAdmin && !isWorkgroupAdmin) {
    return <div style={{ color: 'var(--color-charcoal-light)', padding: 32 }}>Access denied.</div>
  }

  const visibleTabs = isAdmin ? TABS : TABS.filter((t) => t.key === 'workgroups')

  const activeKey = pathname.split('/admin/')[1]?.split('/')[0] || 'workgroups'

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '2px solid var(--color-sand)' }}>
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(`/admin/${t.key}`)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 20px', fontWeight: activeKey === t.key ? 700 : 400,
              color: activeKey === t.key ? 'var(--color-terracotta)' : 'var(--color-charcoal-light)',
              borderBottom: activeKey === t.key ? '2px solid var(--color-terracotta)' : '2px solid transparent',
              marginBottom: -2, fontSize: '0.95rem', fontFamily: 'var(--font-sans)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Routes>
        <Route index element={<Navigate to="workgroups" replace />} />
        <Route path="community" element={isAdmin ? <CommunityTab /> : <Navigate to="/admin/workgroups" replace />} />
        <Route path="members" element={isAdmin ? <MembersTab /> : <Navigate to="/admin/workgroups" replace />} />
        <Route path="workgroups" element={<WorkgroupsTab />} />
        <Route path="availability" element={isAdmin ? <AvailabilityTab /> : <Navigate to="/admin/workgroups" replace />} />
        <Route path="*" element={<Navigate to="workgroups" replace />} />
      </Routes>
    </div>
  )
}
