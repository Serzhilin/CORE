import PersonPanel from './PersonPanel'
import WorkgroupPanel from './WorkgroupPanel'

export default function GraphSidePanel({ selected, graphData, onClose, onFilterToWorkgroup }) {
  const visible = !!selected && selected.type === 'workgroup'
  const person = null
  const workgroup = selected?.type === 'workgroup'
    ? graphData?.workgroups.find(wg => wg.id === selected.id) ?? null
    : null

  // Derive border colour from selection
  const accentColor =
    person ? (graphData.workgroups.find(wg => wg.id === person.memberships[0]?.workgroupId)?.color ?? '#C4622D')
    : workgroup ? workgroup.color
    : '#C4622D'

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: 230,
      background: 'white',
      borderLeft: `3px solid ${accentColor}`,
      padding: '14px 12px',
      boxShadow: '-4px 0 16px rgba(0,0,0,0.07)',
      transform: visible ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.2s ease',
      overflowY: 'auto',
      zIndex: 10,
    }}>
      {person && <PersonPanel person={person} graphData={graphData} onClose={onClose} />}
      {workgroup && <WorkgroupPanel workgroup={workgroup} graphData={graphData} onClose={onClose} onFilterToWorkgroup={onFilterToWorkgroup} />}
    </div>
  )
}
