import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CpuInternalsPage } from './CpuInternalsPage'
import { pmuApi } from '../api/pmu'
import { aluApi } from '../api/alu'
import { fpbApi } from '../api/fpb'
import { ptuApi } from '../api/ptu'
import { heapOperationLabel, projectRecordedHeap } from './cpuInternalsReplay'
import { layoutHeapSlots } from '../components/internals/ProcessorDieScene'
import { WebglFallback } from '../components/internals/WebglFallback'
import type { HeapEntrySnapshot, HeapRunTrace, HeapTraceStep } from '../types/api'

const mocks = vi.hoisted(() => ({ runs: vi.fn(), run: vi.fn() }))
vi.mock('../api/heapTraces', () => ({ heapTracesApi: { runs: mocks.runs, run: mocks.run } }))
vi.mock('../api/pmu', () => ({ pmuApi: { snapshot: vi.fn().mockResolvedValue({ listId: 'list-1', headNodeId: null, tailNodeId: null, size: 0, nodes: [], truncated: false }), traces: vi.fn().mockResolvedValue([]), trace: vi.fn() } }))
vi.mock('../api/alu', () => ({ aluApi: { snapshot: vi.fn().mockResolvedValue({ tableId: 'table-1', capacity: 16, size: 0, loadFactor: 0, buckets: [], truncated: false }), traces: vi.fn().mockResolvedValue([]), trace: vi.fn() } }))
vi.mock('../api/fpb', () => ({ fpbApi: { snapshot: vi.fn().mockResolvedValue({ active: false, queue: null, message: 'No active scheduler queue' }), traces: vi.fn().mockResolvedValue([]), trace: vi.fn() } }))
vi.mock('../api/ptu', () => ({ ptuApi: { snapshot: vi.fn().mockResolvedValue({ size: 0, rootCount: 0, rootPids: [], nodes: [], truncated: false }), traces: vi.fn().mockResolvedValue([]), trace: vi.fn() } }))
vi.mock('../components/internals/ProcessorDieScene', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/internals/ProcessorDieScene')>()
  const React = await import('react')
  return {
    ...actual,
    ProcessorDieScene: ({ focused, entries, active, onFocus }: { focused: boolean; entries: HeapEntrySnapshot[]; active: HeapTraceStep | null; onFocus: () => void }) => React.createElement('div', { 'data-testid': 'die-scene', 'data-focused': focused, 'data-operation': active?.kind ?? '' },
      React.createElement('span', { 'data-testid': 'scene-slot-count' }, String(entries.length)),
      entries.map((entry, index) => React.createElement('span', { key: entry.pid, 'data-testid': `slot-${index}` }, `P${entry.pid}`)),
      React.createElement('button', { onClick: onFocus }, 'Select Priority Dispatch Unit')),
  }
})

const entries: HeapEntrySnapshot[] = [
  { pid: 41, name: 'worker-low', priority: 2, arrivalTime: 0, burstTime: 3, remainingTime: 3 },
  { pid: 42, name: 'worker-high', priority: 8, arrivalTime: 0, burstTime: 2, remainingTime: 2 },
]
function step(sequence: number, kind: HeapTraceStep['kind'], values: Partial<HeapTraceStep> = {}): HeapTraceStep {
  return { sequence, kind, simulationTime: 0, pid: null, name: null, priority: null, index: null, otherIndex: null, comparisonResult: null, comparisonPhase: null, value: null, otherValue: null, values: [], sizeBefore: null, sizeAfter: null, ...values }
}
const trace: HeapRunTrace = {
  runId: 'run-priority-42', algorithm: 'PRIORITY', preemptive: false, processCount: 2,
  startedAt: '2026-11-14T04:00:00Z', completedAt: '2026-11-14T04:00:01Z', operationCount: 7, truncated: false, finalHeap: [],
  steps: [
    step(1, 'INSERT', { pid: 41, name: entries[0].name, priority: 2, value: entries[0], index: 0, sizeBefore: 0, sizeAfter: 1 }),
    step(2, 'INSERT', { pid: 42, name: entries[1].name, priority: 8, value: entries[1], index: 1, sizeBefore: 1, sizeAfter: 2 }),
    step(3, 'COMPARE', { pid: 42, name: entries[1].name, priority: 8, value: entries[1], otherValue: entries[0], index: 1, otherIndex: 0, comparisonResult: 1, comparisonPhase: 'heapify up' }),
    step(4, 'SWAP', { pid: 42, name: entries[1].name, priority: 8, value: entries[1], otherValue: entries[0], index: 1, otherIndex: 0 }),
    step(5, 'EXTRACT_MAX', { pid: 42, name: entries[1].name, priority: 8, value: entries[1], otherValue: entries[0], index: 0, otherIndex: 1, sizeBefore: 2, sizeAfter: 1 }),
    step(6, 'EXTRACT_MAX', { pid: 41, name: entries[0].name, priority: 2, value: entries[0], index: 0, sizeBefore: 1, sizeAfter: 0 }),
    step(7, 'INSERT', { pid: 41, name: entries[0].name, priority: 2, value: entries[0], index: 0, sizeBefore: 0, sizeAfter: 1 }),
  ],
}
const laterTrace: HeapRunTrace = { ...trace, runId: 'run-sjf-43', algorithm: 'SJF' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(pmuApi.snapshot).mockResolvedValue({ listId: 'list-1', headNodeId: null, tailNodeId: null, size: 0, nodes: [], truncated: false })
  vi.mocked(pmuApi.traces).mockResolvedValue([])
  vi.mocked(aluApi.snapshot).mockResolvedValue({ tableId: 'table-1', capacity: 16, size: 0, loadFactor: 0, buckets: [], truncated: false })
  vi.mocked(aluApi.traces).mockResolvedValue([])
  vi.mocked(fpbApi.snapshot).mockResolvedValue({ active: false, queue: null, message: 'No active scheduler queue' })
  vi.mocked(fpbApi.traces).mockResolvedValue([])
  vi.mocked(ptuApi.snapshot).mockResolvedValue({ size: 0, rootCount: 0, rootPids: [], nodes: [], truncated: false })
  vi.mocked(ptuApi.traces).mockResolvedValue([])
  mocks.runs.mockResolvedValue([
  { runId: laterTrace.runId, algorithm: laterTrace.algorithm, preemptive: false, processCount: 2, startedAt: laterTrace.startedAt, completedAt: laterTrace.completedAt, operationCount: laterTrace.steps.length, truncated: false },
  { runId: trace.runId, algorithm: trace.algorithm, preemptive: false, processCount: 2, startedAt: trace.startedAt, completedAt: trace.completedAt, operationCount: trace.steps.length, truncated: false },
  ])
  mocks.run.mockImplementation(async (id: string) => id === trace.runId ? trace : laterTrace)
})

describe('CPU Internals Stage 5B', () => {
  it('projects only recorded array insertions, replacements and swaps', () => {
    expect(projectRecordedHeap(trace, 2).map((entry) => entry.pid)).toEqual([41, 42])
    expect(projectRecordedHeap(trace, 3).map((entry) => entry.pid)).toEqual([42, 41])
    expect(projectRecordedHeap(trace, 4).map((entry) => entry.pid)).toEqual([41])
    expect(projectRecordedHeap(trace, 5)).toEqual([])
  })
  it('shows the selected scheduling run and replays actual comparison and swap steps', async () => {
    render(<MemoryRouter><CpuInternalsPage /></MemoryRouter>)
    expect(await screen.findByText('run-priority-42')).toBeInTheDocument()
    expect(screen.getByText('HISTORICAL')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reset replay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next operation' }))
    expect(await screen.findByText('INCOMING DESCRIPTOR')).toBeInTheDocument()
    expect(screen.getByTestId('slot-0')).toHaveTextContent('P41')
    fireEvent.click(screen.getByRole('button', { name: 'Next operation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next operation' }))
    expect(await screen.findByText('PARENT COMPARISON')).toBeInTheDocument()
    expect(screen.getByTestId('die-scene')).toHaveAttribute('data-operation', 'COMPARE')
    fireEvent.click(screen.getByRole('button', { name: 'Next operation' }))
    await waitFor(() => expect(screen.getByTestId('die-scene')).toHaveAttribute('data-operation', 'SWAP'))
    expect(screen.getAllByText(/HEAP SWAP/)).toHaveLength(2)
  })
  it('focuses and resets the processor camera and can select recorded history', async () => {
    render(<MemoryRouter><CpuInternalsPage /></MemoryRouter>)
    await screen.findByText('run-priority-42')
    fireEvent.click(screen.getByRole('button', { name: /Focus module/ }))
    expect(screen.getByTestId('die-scene')).toHaveAttribute('data-focused', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Back to Processor' }))
    expect(screen.getByTestId('die-scene')).toHaveAttribute('data-focused', 'false')
    fireEvent.click(screen.getAllByRole('button', { name: 'Reset camera' })[0])
    fireEvent.change(screen.getByLabelText('SCHEDULING RUN'), { target: { value: 'run-sjf-43' } })
    await waitFor(() => expect(mocks.run).toHaveBeenCalledWith('run-sjf-43'))
    expect(await screen.findByText('SJF')).toBeInTheDocument()
  })
  it('handles empty and large heap layouts without inventing an ordering', () => {
    expect(projectRecordedHeap({ ...trace, steps: [], finalHeap: [] }, -1)).toEqual([])
    expect(layoutHeapSlots(0)).toEqual([])
    const layout = layoutHeapSlots(1023)
    expect(layout).toHaveLength(1023)
    expect(new Set(layout.map(({ x, z }) => `${x}:${z}`)).size).toBe(1023)
    expect(layout[0]).toMatchObject({ index: 0, level: 0 })
    expect(heapOperationLabel(trace.steps[2])).toContain('PARENT / CHILD COMPARISON')
  })
  it('provides the graceful WebGL failure message while keeping the inspector available', () => {
    render(<WebglFallback />)
    expect(screen.getByText('3D processor view unavailable')).toBeInTheDocument()
    expect(screen.getByText(/operation records and heap state remain available/i)).toBeInTheDocument()
    render(<MemoryRouter><CpuInternalsPage /></MemoryRouter>)
    expect(screen.getByText(/Operation sequence/)).toBeInTheDocument()
  })
})
