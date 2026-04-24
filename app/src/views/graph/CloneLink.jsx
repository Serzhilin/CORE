export default function CloneLink({ link }) {
  const src = link.source
  const tgt = link.target
  if (!src?.x || !tgt?.x) return null
  return (
    <line
      x1={src.x} y1={src.y}
      x2={tgt.x} y2={tgt.y}
      stroke="#bbb"
      strokeWidth={1}
      strokeDasharray="4,3"
      opacity={0.5}
    />
  )
}
