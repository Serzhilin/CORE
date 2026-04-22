import { useRef } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

const W = 900
const H = 900
const cx = W / 2
const cy = H / 2
const R_WG = 320
const R_WG_RECT_W = 100
const R_WG_RECT_H = 36

function workgroupAngle(i, n) { return (2 * Math.PI / n) * i - Math.PI / 2 }

export default function RadialView({ community, filter, onMemberClick }) {
  const svgRef = useRef(null)

  const workgroups = community.workgroups
    .filter((wg) => !filter.workgroupId || wg.id === filter.workgroupId)
    .sort((a, b) => a.sort_order - b.sort_order)

  // person → first role color lookup
  const personColor = {}
  for (const wg of community.workgroups) {
    for (const wm of wg.members) {
      if (!personColor[wm.person_id] && wm.roles?.length) {
        const role = wg.roles.find((r) => r.id === wm.roles[0])
        personColor[wm.person_id] = role?.color || '#E8DDD0'
      }
    }
  }

  function membersForWorkgroup(wg) {
    return wg.members
      .map((wm) => community.members.find((m) => m.personId === wm.person_id))
      .filter(Boolean)
      .filter((m) => !filter.hideUnavailable || !m.availability)
  }

  function exportSvg() {
    if (!svgRef.current) return
    const blob = new Blob([svgRef.current.outerHTML], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.download = 'organogram.svg'
    a.href = URL.createObjectURL(blob)
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const N = workgroups.length || 1

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn-secondary" onClick={exportSvg} style={{ fontSize: '0.85rem' }}>
          Save as SVG
        </button>
      </div>

      <div style={{ border: '1px solid var(--color-sand)', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
        <TransformWrapper minScale={0.3} maxScale={3} initialScale={1}>
          <TransformComponent wrapperStyle={{ width: '100%', height: 600 }}>
            <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
              {/* Center circle */}
              <circle cx={cx} cy={cy} r={60} fill="white" stroke="var(--color-sand-dark)" strokeWidth={2} />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: 13, fontFamily: 'var(--font-title)', fontWeight: 700, fill: 'var(--color-charcoal)' }}>
                {community.name.length > 14 ? community.name.slice(0, 13) + '…' : community.name}
              </text>

              {workgroups.map((wg, i) => {
                const angle = workgroupAngle(i, N)
                const wgX = cx + R_WG * Math.cos(angle)
                const wgY = cy + R_WG * Math.sin(angle)
                const members = membersForWorkgroup(wg)

                return (
                  <g key={wg.id}>
                    {/* Spoke */}
                    <line x1={cx} y1={cy} x2={wgX} y2={wgY}
                      stroke="var(--color-sand-dark)" strokeWidth={1.5} />

                    {/* Members on spoke */}
                    {members.map((m, j) => {
                      const t = (j + 1) / (members.length + 1)
                      const mX = cx + R_WG * t * Math.cos(angle)
                      const mY = cy + R_WG * t * Math.sin(angle)
                      const color = personColor[m.personId] || '#E8DDD0'
                      const unavailable = !!m.availability
                      return (
                        <g key={m.personId} onClick={() => onMemberClick(m)} style={{ cursor: 'pointer' }}>
                          <circle cx={mX} cy={mY} r={14}
                            fill={color}
                            opacity={unavailable ? 0.4 : 1}
                            stroke="white" strokeWidth={2} />
                          {unavailable && (
                            <text x={mX} y={mY} textAnchor="middle" dominantBaseline="middle" fontSize={10}>
                              {m.availability.type.emoji}
                            </text>
                          )}
                          <text x={mX} y={mY + 20} textAnchor="middle"
                            style={{ fontSize: 10, fill: 'var(--color-charcoal)', fontFamily: 'Inter, sans-serif' }}>
                            {m.firstName || '?'}
                          </text>
                        </g>
                      )
                    })}

                    {/* Workgroup rect */}
                    <rect
                      x={wgX - R_WG_RECT_W / 2}
                      y={wgY - R_WG_RECT_H / 2}
                      width={R_WG_RECT_W}
                      height={R_WG_RECT_H}
                      rx={6}
                      fill="white"
                      stroke={wg.color}
                      strokeWidth={2}
                    />
                    <text x={wgX} y={wgY} textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: 11, fontWeight: 600, fill: 'var(--color-charcoal)', fontFamily: 'Inter, sans-serif' }}>
                      {wg.name.length > 13 ? wg.name.slice(0, 12) + '…' : wg.name}
                    </text>
                  </g>
                )
              })}
            </svg>
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  )
}
