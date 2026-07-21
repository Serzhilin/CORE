import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom'
import { Tabs, Heading } from '@ecommons/ui'
import { useCommunity } from '../context/CommunityContext'
import { useUser } from '../context/UserContext'
import { useSetTopBarSlot } from '../context/TopBarSlotContext'
import CommunityTab from './admin/CommunityTab'
import MembersTab from './admin/MembersTab'
import WorkgroupsTab from './admin/WorkgroupsTab'
import AvailabilityTab from './admin/AvailabilityTab'
import styles from './AdminPanel.module.css'

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
    <Heading>Admin</Heading>
  )

  if (!isAdmin && !isWorkgroupAdmin) {
    return <div className={styles.accessDenied}>Access denied.</div>
  }

  const visibleTabs = isAdmin ? TABS : TABS.filter((t) => t.key === 'workgroups')

  const activeKey = pathname.split('/admin/')[1]?.split('/')[0] || 'workgroups'

  return (
    <div>
      <div className={styles.wrapper}>
        <Tabs tabs={visibleTabs} activeKey={activeKey} onChange={(key) => navigate(`/admin/${key}`)} />
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
