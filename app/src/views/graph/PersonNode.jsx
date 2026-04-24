export default function PersonNode({ node, dimmed, selected, showName, onClick }) {
  const opacity = dimmed ? 0.1 : 1
  const r = node.r ?? 10
  const isMulti = node.colors && node.colors.length >= 2

  return (
    <g transform={`translate(${node.x ?? 0},${node.y ?? 0})`} style={{ cursor: 'pointer' }} onClick={onClick}>
      <circle
        r={r}
        fill={node.isUnassigned ? '#ccc' : node.color}
        fillOpacity={node.isAspirant ? 0.35 : 0.85}
        stroke={node.isUnassigned ? '#aaa' : (node.isAspirant ? node.color : 'white')}
        strokeWidth={node.isAspirant ? 2 : 1.5}
        strokeDasharray={node.isAspirant ? '3,2' : 'none'}
        opacity={opacity}
      />
      {isMulti && (
        <circle
          r={r + 3}
          fill="none"
          stroke={node.colors[1]}
          strokeWidth={2}
          opacity={opacity * 0.6}
        />
      )}
      {selected && (
        <circle r={r + 5} fill="none" stroke={node.color} strokeWidth={2} opacity={0.5} />
      )}
      {showName && (
        <text
          y={r + 11}
          textAnchor="middle"
          fontSize={7}
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
