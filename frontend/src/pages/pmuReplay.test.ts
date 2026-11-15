import { describe, expect, it } from 'vitest'
import { projectPmuTrace } from './pmuReplay'
import type { PmuListSnapshot, PmuTrace } from '../types/api'

const empty: PmuListSnapshot = { listId: 'L', headNodeId: null, tailNodeId: null, size: 0, nodes: [], truncated: false }
const first = { nodeId: 1, pid: 11, name: 'init', state: 'READY' as const, priority: 4, arrivalTime: 0, burstTime: 3, remainingTime: 3, memoryRequirement: 8, parentPid: -1, completionTime: 0, waitingTime: 0, turnaroundTime: 0, responseTime: 0, nextNodeId: null }
const second = { ...first, nodeId: 2, pid: 12, name: 'worker' }
const trace: PmuTrace = {
  traceId: 'T', listId: 'L', operation: 'INSERT', targetPid: 12, simulationTime: null,
  recordedAt: '2026-01-01T00:00:00Z', stepCount: 4, result: true, truncated: false, description: 'insert',
  beforeSnapshot: { ...empty, headNodeId: 1, tailNodeId: 1, size: 1, nodes: [first] },
  afterSnapshot: { ...empty, headNodeId: 1, tailNodeId: 2, size: 2, nodes: [{ ...first, nextNodeId: 2 }, second] },
  steps: [
    { sequence: 1, kind: 'NODE_CREATE', pid: 12, nodeId: 2, position: 1, ownerNodeId: null, oldNextNodeId: null, newNextNodeId: null, oldHeadNodeId: null, newHeadNodeId: null, oldTailNodeId: null, newTailNodeId: null, result: null, node: second, description: 'allocate' },
    { sequence: 2, kind: 'POINTER_UPDATE', pid: null, nodeId: 1, position: 0, ownerNodeId: 1, oldNextNodeId: null, newNextNodeId: 2, oldHeadNodeId: null, newHeadNodeId: null, oldTailNodeId: null, newTailNodeId: null, result: null, node: null, description: 'link' },
    { sequence: 3, kind: 'TAIL_UPDATE', pid: null, nodeId: 2, position: null, ownerNodeId: null, oldNextNodeId: null, newNextNodeId: null, oldHeadNodeId: null, newHeadNodeId: null, oldTailNodeId: 1, newTailNodeId: 2, result: null, node: null, description: 'tail' },
    { sequence: 4, kind: 'INSERT', pid: 12, nodeId: 2, position: 1, ownerNodeId: null, oldNextNodeId: null, newNextNodeId: null, oldHeadNodeId: null, newHeadNodeId: null, oldTailNodeId: null, newTailNodeId: null, result: true, node: second, description: 'insert' },
  ],
}

describe('PMU replay projection', () => {
  it('uses recorded pointer changes to reconstruct ordered historical structure without changing source snapshots', () => {
    expect(projectPmuTrace(trace, -1).snapshot.nodes.map((node) => node.pid)).toEqual([11])
    expect(projectPmuTrace(trace, 0).snapshot.nodes.map((node) => node.pid)).toEqual([11])
    const linked = projectPmuTrace(trace, 1).snapshot
    expect(linked.nodes.map((node) => node.pid)).toEqual([11, 12])
    expect(linked.nodes[0].nextNodeId).toBe(2)
    expect(linked.tailNodeId).toBe(1)
    expect(trace.beforeSnapshot.nodes[0].nextNodeId).toBeNull()
    expect(trace.afterSnapshot.nodes[0].nextNodeId).toBe(2)
  })
})
