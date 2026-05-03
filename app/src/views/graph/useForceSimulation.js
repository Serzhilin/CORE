import { useRef, useState, useEffect, useCallback } from 'react'
import * as d3 from 'd3'

export const GRAPH_W = 1200
export const GRAPH_H = 700
const CX = GRAPH_W / 2
const CY = GRAPH_H / 2
const RX_ORBIT = 440
const RY_ORBIT = 250

function placeWorkgroups(wgNodes) {
  const n = wgNodes.length
  if (n === 1) {
    wgNodes[0].fx = CX
    wgNodes[0].fy = CY
    wgNodes[0].x = CX
    wgNodes[0].y = CY
    return
  }
  wgNodes.forEach((node, i) => {
    const angle = (2 * Math.PI / n) * i - Math.PI / 2
    node.fx = CX + RX_ORBIT * Math.cos(angle)
    node.fy = CY + RY_ORBIT * Math.sin(angle)
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

    const UNASSIGNED_X = 80
    const UNASSIGNED_Y = 80

    const linkDistance = wgSimNodes.length === 1 ? 160 : 100

    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks)
        .id(d => d.id)
        .distance(linkDistance)
        .strength(0.5)
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('collide', d3.forceCollide(d => (d.r ?? 10) + 5))
      .force('center', d3.forceCenter(CX, CY).strength(0.02))
      .force('unassigned-x', d3.forceX(d => d.isUnassigned ? UNASSIGNED_X : CX).strength(d => d.isUnassigned ? 0.4 : 0))
      .force('unassigned-y', d3.forceY(d => d.isUnassigned ? UNASSIGNED_Y : CY).strength(d => d.isUnassigned ? 0.4 : 0))
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
    simRef,
    W: GRAPH_W,
    H: GRAPH_H,
  }
}
