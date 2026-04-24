export default function WorkgroupNode({ node, dimmed, selected, onClick }) {
  const opacity = dimmed ? 0.12 : 1
  return (
    <g transform={`translate(${node.x ?? 0},${node.y ?? 0})`} style={{ cursor: 'pointer' }} onClick={onClick}>
      <circle
        r={node.r}
        fill={node.color}
        fillOpacity={0.18}
        stroke={node.color}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray="5,3"
        opacity={opacity}
      />
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={9}
        fontWeight={700}
        fill={node.color}
        opacity={opacity}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {node.name.length > 14 ? node.name.slice(0, 13) + '…' : node.name}
      </text>
    </g>
  )
}
