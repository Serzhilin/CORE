export default function PersonNode({ node, dimmed, selected, showName, onClick, onMouseDown }) {
  const opacity = dimmed ? 0.1 : 1
  const r = node.r ?? 10
  const roleColors = node.roleColors ?? []

  return (
    <g transform={`translate(${node.x ?? 0},${node.y ?? 0})`} style={{ cursor: 'pointer' }} onClick={onClick} onMouseDown={onMouseDown}>
      <circle
        r={r}
        fill={node.isUnassigned ? '#ccc' : node.color}
        fillOpacity={node.isAspirant ? 0.35 : 0.85}
        stroke={node.isUnassigned ? '#aaa' : (node.isAspirant ? node.color : 'white')}
        strokeWidth={node.isAspirant ? 2 : 1.5}
        strokeDasharray={node.isAspirant ? '3,2' : 'none'}
        opacity={opacity}
      />
      {roleColors.map((color, i) => (
        <circle
          key={color + i}
          r={r + 4 + i * 4}
          fill="none"
          stroke={color}
          strokeWidth={i === 0 ? 2.5 : 2}
          opacity={opacity * 0.85}
        />
      ))}
      {selected && (
        <circle r={r + 4 + roleColors.length * 4 + 2} fill="none" stroke={node.color} strokeWidth={2} opacity={0.5} />
      )}
      {showName && (
        <text
          y={r + 11}
          textAnchor="middle"
          fontSize={9}
          fill="#555"
          opacity={opacity}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {node.name}
        </text>
      )}
    </g>
  )
}
