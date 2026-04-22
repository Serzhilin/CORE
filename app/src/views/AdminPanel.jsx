import { useState } from 'react'
import { useCommunity } from '../context/CommunityContext'
import { useUser } from '../context/UserContext'
import CommunityTab from './admin/CommunityTab'
import MembersTab from './admin/MembersTab'
import WorkgroupsTab from './admin/WorkgroupsTab'

const TABS = [
  { key: 'community', label: 'Community' },
  { key: 'members', label: 'Members' },
  { key: 'workgroups', label: 'Workgroups' },
]

export default function AdminPanel() {
  const { community, myMembership } = useCommunity()
  const { user } = useUser()
  const [tab, setTab] = useState('community')

  const isAdmin = myMembership?.isAdmin ?? false
  const isWorkgroupAdmin = community?.workgroups?.some((wg) =>
    wg.members?.some((wm) => wm.person_id === user?.id && wm.is_workgroup_admin)
  ) ?? false

  if (!isAdmin && !isWorkgroupAdmin) {
    return <div style={{ color: 'var(--color-charcoal-light)', padding: 32 }}>Access denied.</div>
  }

  const visibleTabs = isAdmin ? TABS : TABS.filter((t) => t.key === 'workgroups')

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: 24 }}>Admin</h2>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '2px solid var(--color-sand)' }}>
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 20px', fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? 'var(--color-terracotta)' : 'var(--color-charcoal-light)',
              borderBottom: tab === t.key ? '2px solid var(--color-terracotta)' : '2px solid transparent',
              marginBottom: -2, fontSize: '0.95rem', fontFamily: 'Inter, sans-serif',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'community' && isAdmin && <CommunityTab />}
      {tab === 'members' && isAdmin && <MembersTab />}
      {tab === 'workgroups' && <WorkgroupsTab />}
    </div>
  )
}
