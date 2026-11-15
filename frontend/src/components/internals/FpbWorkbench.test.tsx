import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FpbWorkbench, fpbQueueAtStep } from './FpbWorkbench'
import type { FpbLiveSnapshot, FpbQueueSnapshot, FpbTrace } from '../../types/api'

const empty: FpbQueueSnapshot = { queueId: 'queue-1', size: 0, frontNodeId: null, rearNodeId: null, nodes: [], truncated: false }
const node1 = { nodeId: 1, process: { pid: 51, name: 'compiler', priority: 2, arrivalTime: 0, burstTime: 2, remainingTime: 2 }, nextNodeId: 2 }
const node2 = { nodeId: 2, process: { pid: 52, name: 'linker', priority: 4, arrivalTime: 0, burstTime: 1, remainingTime: 1 }, nextNodeId: null }
const afterEnqueue: FpbQueueSnapshot = { queueId: 'queue-1', size: 2, frontNodeId: 1, rearNodeId: 2, nodes: [node1, node2], truncated: false }
const trace: FpbTrace = {
  traceId: 'trace-a', schedulingRunId: 'run-a', queueId: 'queue-1', algorithm: 'FCFS', processCount: 2, operationCount: 3,
  startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:00:01Z', complete: true, truncated: false,
  initialQueue: empty, finalQueue: empty,
  steps: [
    { sequence: 1, operation: 'ENQUEUE', pid: 51, sizeBefore: 0, sizeAfter: 1, oldFrontNodeId: null, newFrontNodeId: 1, oldRearNodeId: null, newRearNodeId: 1, process: node1.process, queueAfter: { ...afterEnqueue, size: 1, rearNodeId: 1, nodes: [{ ...node1, nextNodeId: null }] }, description: 'P51 entered at the rear of the FIFO queue' },
    { sequence: 2, operation: 'ENQUEUE', pid: 52, sizeBefore: 1, sizeAfter: 2, oldFrontNodeId: 1, newFrontNodeId: 1, oldRearNodeId: 1, newRearNodeId: 2, process: node2.process, queueAfter: afterEnqueue, description: 'P52 entered at the rear of the FIFO queue' },
    { sequence: 3, operation: 'DEQUEUE', pid: 51, sizeBefore: 2, sizeAfter: 1, oldFrontNodeId: 1, newFrontNodeId: 2, oldRearNodeId: 2, newRearNodeId: 2, process: node1.process, queueAfter: { ...afterEnqueue, size: 1, frontNodeId: 2, nodes: [node2] }, description: 'P51 left from the front of the FIFO queue' },
  ],
}
const live: FpbLiveSnapshot = { active: false, queue: null, message: 'Scheduler queues are temporary.' }
const traces = [{ traceId: 'trace-a', schedulingRunId: 'run-a', queueId: 'queue-1', algorithm: 'FCFS' as const, processCount: 2, operationCount: 3, startedAt: trace.startedAt, completedAt: trace.completedAt, complete: true, truncated: false }]
const props = { live, traces, trace: null as FpbTrace | null, selectedTraceId: '', stepIndex: -1, playing: false, loading: false, traceLoading: false, error: '', onRefresh: vi.fn(), onSelectTrace: vi.fn(), onStep: vi.fn(), onTogglePlay: vi.fn(), onFocus: vi.fn() }

describe('FIFO Process Buffer workbench', () => {
  it('shows inactive live state, then renders actual recorded queue order and pointers', () => {
    const { rerender } = render(<FpbWorkbench {...props}/>); expect(screen.getByText(/NO LIVE QUEUE/)).toBeInTheDocument()
    rerender(<FpbWorkbench {...props} trace={trace} selectedTraceId="trace-a" stepIndex={1}/>);
    const queue = screen.getByRole('list', { name: 'Historical FIFO queue' })
    expect(queue).toHaveTextContent('P51'); expect(queue).toHaveTextContent('P52'); expect(screen.getAllByText('FRONT').length).toBeGreaterThan(0)
    expect(fpbQueueAtStep(trace, 1).nodes.map((node) => node.process.pid)).toEqual([51, 52])
  })
  it('supports historical previous/next navigation without changing recorded data', () => {
    const frozenTrace = structuredClone(trace)
    render(<FpbWorkbench {...props} trace={trace} selectedTraceId="trace-a" stepIndex={1}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Next FPB operation' })); expect(props.onStep).toHaveBeenCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: 'Previous FPB operation' })); expect(props.onStep).toHaveBeenCalledWith(0)
    fireEvent.click(screen.getByRole('button', { name: 'Play FPB replay' })); expect(props.onTogglePlay).toHaveBeenCalled()
    expect(trace).toEqual(frozenTrace)
  })
  it('selects a recorded scheduling trace and delegates playback to its controller', () => {
    render(<FpbWorkbench {...props}/>);
    fireEvent.change(screen.getByLabelText('FIFO SCHEDULING RUN'), { target: { value: 'trace-a' } });
    expect(props.onSelectTrace).toHaveBeenCalledWith('trace-a')
  })
  it('shows an actionable empty state and retries after an API error', () => {
    render(<FpbWorkbench {...props} traces={[]} live={null} error="Backend unavailable"/>);
    expect(screen.getByText('Run an FCFS or Round Robin simulation to capture the scheduler’s actual enqueue and dequeue operations.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Retry/ })); expect(props.onRefresh).toHaveBeenCalled()
  })
})
