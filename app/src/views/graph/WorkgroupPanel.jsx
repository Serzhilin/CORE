export default function WorkgroupPanel({ workgroup, graphData, onClose, onFilterToWorkgroup }) {
  const members = graphData.persons
    .filter(p => p.memberships.some(m => m.workgroupId === workgroup.id))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-title, serif)' }}>{workgroup.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4 }}>{members.length} members</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
      </div>

      {workgroup.description && (
        <div style={{ fontSize: '0.78rem', color: '#666', lineHeight: 1.4 }}>{workgroup.description}</div>
      )}

      {/* Member list */}
      <div style={{ borderTop: '1px solid #f0ece4', paddingTop: 8, flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#aaa', marginBottom: 6 }}>Members</div>
        {members.map(p => {
          const m = p.memberships.find(m => m.workgroupId === workgroup.id)
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: workgroup.color, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '0.78rem' }}>{p.firstName} {p.lastName}</span>
                {m?.roles.length > 0 && (
                  <span style={{ fontSize: '0.68rem', color: workgroup.color, marginLeft: 5 }}>· {m.roles.map(r => r.name).join(', ')}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ paddingTop: 6, borderTop: '1px solid #f0ece4' }}>
        <button
          onClick={() => onFilterToWorkgroup(workgroup.id)}
          style={{
            fontSize: '0.75rem', color: workgroup.color, background: 'none',
            border: `1px solid ${workgroup.color}`, borderRadius: 5,
            padding: '4px 8px', cursor: 'pointer', width: '100%',
          }}
        >Filter to this workgroup</button>
      </div>
    </div>
  )
}
