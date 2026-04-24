export default function GraphToolbar({ graphData, mode, filters, onModeChange, onFiltersChange, onReset, onExport }) {
  const allRoles = [...new Set(
    graphData.persons.flatMap(p => p.memberships.flatMap(m => m.roles))
  )]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '8px 12px', background: '#faf7f2',
      borderRadius: 8, border: '1px solid #e5ddd0', fontSize: '0.82rem',
      marginBottom: 8,
    }}>
      {/* View mode toggle */}
      <div style={{ display: 'flex', border: '1px solid #e5ddd0', borderRadius: 6, overflow: 'hidden' }}>
        {['by-person', 'by-workgroup'].map((m) => (
          <button key={m}
            onClick={() => onModeChange(m)}
            style={{
              padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
              background: mode === m ? 'var(--color-terracotta, #C4622D)' : 'white',
              color: mode === m ? 'white' : '#888',
            }}
          >{m === 'by-person' ? 'By person' : 'By workgroup'}</button>
        ))}
      </div>

      <div style={{ width: 1, height: 24, background: '#e5ddd0' }} />

      {/* Workgroup filter */}
      <select value={filters.workgroupId} onChange={e => onFiltersChange({ workgroupId: e.target.value })}
        style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #e5ddd0', fontSize: '0.78rem', background: 'white', color: '#555' }}>
        <option value="">All workgroups</option>
        {graphData.workgroups.map(wg => <option key={wg.id} value={wg.id}>{wg.name}</option>)}
      </select>

      {/* Role filter */}
      <select value={filters.roleId} onChange={e => onFiltersChange({ roleId: e.target.value })}
        style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #e5ddd0', fontSize: '0.78rem', background: 'white', color: '#555' }}>
        <option value="">All roles</option>
        {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      <div style={{ width: 1, height: 24, background: '#e5ddd0' }} />

      {/* Toggles */}
      {[
        ['hideUnavailable', 'Hide unavailable'],
        ['showAspirants', 'Show aspirants'],
        ['showNames', 'Show names'],
      ].map(([key, label]) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.75rem', color: '#555' }}>
          <input type="checkbox" checked={!!filters[key]} onChange={e => onFiltersChange({ [key]: e.target.checked })} />
          {label}
        </label>
      ))}

      <div style={{ width: 1, height: 24, background: '#e5ddd0' }} />

      {/* Search */}
      <input
        placeholder="🔍 Search person…"
        value={filters.search}
        onChange={e => onFiltersChange({ search: e.target.value })}
        style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #e5ddd0', fontSize: '0.78rem', width: 140 }}
      />

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button onClick={onReset}
          style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #e5ddd0', fontSize: '0.75rem', background: 'white', cursor: 'pointer', color: '#555' }}>
          ⟳ Reset
        </button>
        <button onClick={onExport}
          style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #e5ddd0', fontSize: '0.75rem', background: 'white', cursor: 'pointer', color: '#555' }}>
          ↓ SVG
        </button>
      </div>
    </div>
  )
}
