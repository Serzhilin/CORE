function wrapWords(name, maxChars) {
  const words = name.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    if (current && (current + ' ' + word).length > maxChars) {
      lines.push(current)
      current = word
    } else {
      current = current ? current + ' ' + word : word
    }
  }
  if (current) lines.push(current)
  return lines
}

export default function WorkgroupNode({ node, dimmed, selected, onClick, onMouseDown }) {
  const opacity = dimmed ? 0.12 : 1
  const lines = wrapWords(node.name, 14)
  const lineHeight = 11
  const startY = -((lines.length - 1) * lineHeight) / 2

  return (
    <g transform={`translate(${node.x ?? 0},${node.y ?? 0})`} style={{ cursor: 'pointer' }} onClick={onClick} onMouseDown={onMouseDown}>
      <circle
        r={node.r}
        fill={node.color}
        fillOpacity={0.18}
        stroke={node.color}
        strokeWidth={selected ? 3 : 2}
        opacity={opacity}
      />
      <text
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={node.color}
        opacity={opacity}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={0} y={startY + i * lineHeight} dominantBaseline="middle">
            {line}
          </tspan>
        ))}
      </text>
    </g>
  )
}
