export default function PersonNode({ node, dimmed, selected, showName, onClick, onMouseDown }) {
  const opacity = dimmed ? 0.1 : 1
  const r = node.r ?? 10
  const roleColors = node.roleColors ?? []

  return (
    <g transform={`translate(${node.x ?? 0},${node.y ?? 0})`} style={{ cursor: 'pointer' }} onClick={onClick} onMouseDown={onMouseDown}>
      <circle
        r={r}
        fill={node.isUnassigned ? '#ccc' : node.color}
        fillOpacity={0.85}
        stroke={node.isUnassigned ? '#aaa' : 'white'}
        strokeWidth={1.5}
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
        <>
          <circle r={r + 4 + roleColors.length * 4 + 2} fill="none" stroke={node.color} strokeWidth={2} opacity={0.5} />
          <circle r={r + 2} fill="none" stroke={node.color} strokeWidth={2} opacity={0.6}>
            <animate attributeName="r" values={`${r + 2};${r + 18}`} dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </>
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
