import { useState, useRef, lazy, Suspense } from 'react'
import { Input, Panel, Select, Loading } from '@ecommons/ui'
import { useCommunity } from '../context/CommunityContext'
import { useSetTopBarSlot } from '../context/TopBarSlotContext'
import CardGrid from './CardGrid'
import InfoPanel from '../components/InfoPanel'
import html2canvas from 'html2canvas'
import styles from './OrganogramView.module.css'

const GraphView = lazy(() => import('./graph/GraphView'))

const INITIAL_FILTER = { workgroupId: '', roleName: '', membershipTypeId: '', showUnavailable: true, search: '' }

export default function OrganogramView() {
  const { community, loading, membershipTypes } = useCommunity()
  const [view, setView] = useState(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'cards' : 'graph')
  const [panelSelection, setPanelSelection] = useState(null)
  const [filter, setFilter] = useState(INITIAL_FILTER)
  const cardGridRef = useRef(null)
  const graphExportRef = useRef(null)

  const allRoleNames = community ? [...new Set(
    community.workgroups.flatMap((wg) => wg.roles.map((r) => r.name))
  )].sort() : []

  const patch = (p) => setFilter((f) => ({ ...f, ...p }))

  useSetTopBarSlot(
    community ? (
      <div className={styles.filterRow}>
        <Panel shadow="sm" className={styles.viewTogglePanel}>
          {['graph', 'cards'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={styles.viewToggleBtn}
              style={{
                background: view === v ? 'var(--color-terracotta)' : 'white',
                color: view === v ? 'white' : 'var(--color-charcoal-light)',
              }}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </Panel>

        <div className="topbar-filter-break" />

        <Select value={filter.roleName} onChange={(e) => patch({ roleName: e.target.value })} className={styles.selectSm}>
          <option value="">All roles</option>
          {allRoleNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </Select>

        <Select value={filter.membershipTypeId} onChange={(e) => patch({ membershipTypeId: e.target.value })} className={styles.selectSm}>
          <option value="">All membership types</option>
          {membershipTypes.map((mt) => (
            <option key={mt.id} value={mt.id}>{mt.name}</option>
          ))}
        </Select>

        <div className="topbar-filter-break" />

        <Input
          placeholder="Search by name…"
          value={filter.search}
          onChange={(e) => patch({ search: e.target.value })}
          className={styles.searchInput}
        />

        <div className="topbar-filter-break" />

        <label className={styles.checkLabel}>
          <input type="checkbox" checked={filter.showUnavailable} onChange={(e) => patch({ showUnavailable: e.target.checked })} />
          Show inactive members
        </label>
      </div>
    ) : null,
    [community, view, filter, allRoleNames.join('|'), membershipTypes]
  )

  if (loading) return <Loading />
  if (!community) return null

  async function exportPng() {
    if (!cardGridRef.current) return
    const canvas = await html2canvas(cardGridRef.current, { backgroundColor: '#FFFFFF', useCORS: true })
    const a = document.createElement('a')
    a.download = 'organogram.png'
    a.href = canvas.toDataURL()
    a.click()
  }

  function handleMemberClick(member) {
    setPanelSelection({ type: 'person', id: member.personId })
  }

  function handlePersonSelect(pid) {
    setPanelSelection({ type: 'person', id: pid })
  }

  function handleWorkgroupSelect(wgId) {
    setPanelSelection({ type: 'workgroup', id: wgId })
  }

  return (
    <div className={styles.mainColumn}>
      {/* Main content row: view + InfoPanel */}
      <div className={styles.contentRow}>
        <div className={styles.contentColumn} style={{ overflow: view === 'cards' ? 'auto' : 'visible' }}>
          {view === 'cards' ? (
            <CardGrid community={community} filter={filter} onMemberClick={handleMemberClick} gridRef={cardGridRef} selectedPersonId={panelSelection?.type === 'person' ? panelSelection.id : null} />
          ) : (
            <Suspense fallback={<div>Loading graph…</div>}>
              <GraphView
                style={{ flex: 1, minHeight: 0, height: '100%' }}
                communityId={community.id}
                filters={filter}
                refreshKey={community.workgroups.flatMap(wg => wg.roles.map(r => r.id + r.name + r.color)).join('|')}
                selection={panelSelection}
                onSelectionClear={() => setPanelSelection(null)}
                onPersonSelect={handlePersonSelect}
                onWorkgroupSelect={handleWorkgroupSelect}
                exportRef={graphExportRef}
              />
            </Suspense>
          )}
        </div>
        <InfoPanel
          selection={panelSelection}
          onSelect={setPanelSelection}
          onFilterToWorkgroup={(wgId) => patch({ workgroupId: wgId })}
        />
      </div>
    </div>
  )
}
