export default function PersonPanel({ person, graphData, onClose }) {
  const initials = [person.firstName?.[0], person.lastName?.[0]].filter(Boolean).join('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-title, serif)' }}>
            {person.firstName} {person.lastName}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            {person.isAdmin && (
              <span style={{ fontSize: '0.68rem', background: '#f0ece4', borderRadius: 3, padding: '1px 5px' }}>Admin</span>
            )}
            {person.isAspirant && (
              <span style={{ fontSize: '0.68rem', background: '#fef3c7', borderRadius: 3, padding: '1px 5px', color: '#92400e' }}>Aspirant</span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
      </div>

      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--color-terracotta, #C4622D), #2563EB)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 700, fontSize: '1rem', flexShrink: 0,
      }}>{initials || '?'}</div>

      {/* Workgroups & roles */}
      <div style={{ borderTop: '1px solid #f0ece4', paddingTop: 8 }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#aaa', marginBottom: 6 }}>
          Workgroups & roles
        </div>
        {person.memberships.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: '#aaa', fontStyle: 'italic' }}>No workgroup assigned</div>
        ) : (
          person.memberships.map(m => {
            const wg = graphData.workgroups.find(w => w.id === m.workgroupId)
            if (!wg) return null
            return (
              <div key={m.workgroupId} style={{
                background: `${wg.color}11`,
                borderLeft: `3px solid ${wg.color}`,
                borderRadius: '0 4px 4px 0',
                padding: '5px 8px',
                marginBottom: 4,
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{wg.name}</div>
                <div style={{ fontSize: '0.7rem', color: m.roles.length ? wg.color : '#aaa', marginTop: 2 }}>
                  {m.roles.map(r => r.name).join(', ')}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Status — only show when not available */}
      {person.availability && (
        <div style={{ borderTop: '1px solid #f0ece4', paddingTop: 6 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#aaa', marginBottom: 4 }}>Status</div>
          <div style={{ fontSize: '0.78rem', color: '#b45309' }}>
            {person.availability.emoji} {person.availability.name}
          </div>
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f0ece4' }}>
        <div style={{ fontSize: '0.72rem', color: '#bbb', textAlign: 'center' }}>click graph to close</div>
      </div>
    </div>
  )
}
