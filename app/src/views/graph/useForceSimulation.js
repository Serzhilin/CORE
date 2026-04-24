import { useRef, useState, useEffect, useCallback } from 'react'
import * as d3 from 'd3'

export const GRAPH_W = 900
export const GRAPH_H = 700
const CX = GRAPH_W / 2
const CY = GRAPH_H / 2
const R_ORBIT = 260

function placeWorkgroups(wgNodes) {
  const n = wgNodes.length
  wgNodes.forEach((node, i) => {
    const angle = (2 * Math.PI / n) * i - Math.PI / 2
    node.fx = CX + R_ORBIT * Math.cos(angle)
    node.fy = CY + R_ORBIT * Math.sin(angle)
    node.x = node.fx
    node.y = node.fy
  })
}

export function useForceSimulation(nodes, links) {
  const simRef = useRef(null)
  const [, setTick] = useState(0)

  const reheat = useCallback(() => {
    if (simRef.current) simRef.current.alpha(0.5).restart()
  }, [])

  useEffect(() => {
    if (!nodes.length) return

    // Deep-copy so D3 can mutate x/y
    const simNodes = nodes.map(n => ({ ...n }))
    const simLinks = links.map(l => ({ ...l }))

    // Fix workgroup nodes on a circle
    const wgSimNodes = simNodes.filter(n => n.type === 'workgroup')
    placeWorkgroups(wgSimNodes)

    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks)
        .id(d => d.id)
        .distance(d => d.type === 'same-person' ? 45 : 75)
        .strength(d => d.type === 'same-person' ? 0.3 : 0.5)
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('collide', d3.forceCollide(d => (d.r ?? 10) + 5))
      .force('center', d3.forceCenter(CX, CY).strength(0.02))
      .on('tick', () => setTick(t => t + 1))

    simRef.current = sim
    // Store references for consumers
    simRef.current._nodes = simNodes
    simRef.current._links = simLinks

    return () => sim.stop()
  }, [nodes, links])

  return {
    simNodes: simRef.current?._nodes ?? [],
    simLinks: simRef.current?._links ?? [],
    reheat,
    W: GRAPH_W,
    H: GRAPH_H,
  }
}
