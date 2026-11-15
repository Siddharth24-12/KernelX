import type { PmuListSnapshot, PmuTrace, PmuTraceStep } from '../types/api'

/** Selects backend-captured snapshots; this is a replay projection, not a linked-list implementation. */
export function projectPmuTrace(trace: PmuTrace, throughIndex: number): {
  snapshot: PmuListSnapshot; active: PmuTraceStep | null; visitedNodeIds: number[]; incomingNodeId: number | null
} {
  const end = Math.max(-1, Math.min(trace.steps.length - 1, throughIndex))
  const applied = trace.steps.slice(0, end + 1)
  const nodes = new Map(trace.beforeSnapshot.nodes.map((node) => [node.nodeId, node]))
  let headNodeId = trace.beforeSnapshot.headNodeId
  let tailNodeId = trace.beforeSnapshot.tailNodeId
  for (const step of trace.steps.slice(0, end + 1)) {
    if (step.kind === 'NODE_CREATE' && step.node) nodes.set(step.node.nodeId, step.node)
    if (step.kind === 'POINTER_UPDATE' && step.ownerNodeId !== null) {
      const owner = nodes.get(step.ownerNodeId)
      if (owner) nodes.set(owner.nodeId, { ...owner, nextNodeId: step.newNextNodeId })
    }
    if (step.kind === 'HEAD_UPDATE') headNodeId = step.newHeadNodeId
    if (step.kind === 'TAIL_UPDATE') tailNodeId = step.newTailNodeId
  }
  const ordered = []
  const seen = new Set<number>()
  let cursor = headNodeId
  while (cursor !== null && nodes.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor)
    const node = nodes.get(cursor)!
    ordered.push(node)
    cursor = node.nextNodeId
  }
  const snapshot = { ...trace.beforeSnapshot, headNodeId, tailNodeId, size: ordered.length, nodes: ordered }
  const active = end >= 0 ? trace.steps[end] : null
  return {
    snapshot,
    active,
    visitedNodeIds: [...new Set(applied.filter((step) => step.kind === 'NODE_VISIT' || step.kind === 'SEARCH_COMPARE')
      .map((step) => step.nodeId).filter((id): id is number => id !== null))],
    incomingNodeId: active?.kind === 'NODE_CREATE' ? active.node?.nodeId ?? null : null,
  }
}
