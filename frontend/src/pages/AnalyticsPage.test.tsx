import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import { AnalyticsPage } from './AnalyticsPage'
import type { AnalyticsSnapshot } from '../api/analytics'
import type { ComparisonReport } from '../api/comparisons'
import type { SystemEvent } from '../types/api'

const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), events: vi.fn(), reports: vi.fn(), get: vi.fn(), context: { processes: [], memory: null, simulation: { status: 'READY', currentTime: 0, totalTime: 0 }, events: [], connected: true, loading: false, error: '', refresh: vi.fn(), setProcesses: vi.fn(), setMemory: vi.fn(), setSimulation: vi.fn() } }))
vi.mock('../api/analytics', () => ({ analyticsApi: { snapshot: mocks.snapshot } }))
vi.mock('../api/events', () => ({ eventsApi: { list: mocks.events } }))
vi.mock('../api/comparisons', () => ({ comparisonsApi: { list: mocks.reports, get: mocks.get } }))
vi.mock('../api/client', () => ({ errorMessage: (error: unknown) => error instanceof Error ? error.message : 'API unavailable' }))
vi.mock('../hooks/useSystemData', () => ({ useSystemData: () => mocks.context }))

const snapshot: AnalyticsSnapshot = {
  capturedAt: '2026-11-15T05:00:00Z',
  cpu: { status: 'RUNNING', currentTime: 2, totalTime: 4, currentRunningPid: 91001, readyPids: [], completedProcessCount: 0, runId: 'run-1', observedBusyTicks: 1, observedIdleTicks: 1, observedUtilizationPercent: 50, samples: [{ runId: 'run-1', simulationTime: 1, runningPid: null, processName: 'IDLE', readyProcessCount: 0, waitingProcessCount: 0, completedProcessCount: 0, cumulativeBusyTicks: 0, cumulativeIdleTicks: 1, utilizationPercent: 0 }, { runId: 'run-1', simulationTime: 2, runningPid: 91001, processName: 'worker', readyProcessCount: 0, waitingProcessCount: 0, completedProcessCount: 0, cumulativeBusyTicks: 1, cumulativeIdleTicks: 1, utilizationPercent: 50 }], observedGantt: [{ pid: -1, processName: 'IDLE', startTime: 0, endTime: 1, duration: 1, idle: true }, { pid: 91001, processName: 'worker', startTime: 1, endTime: 2, duration: 1, idle: false }], scheduledGantt: [{ pid: -1, processName: 'IDLE', startTime: 0, endTime: 1, duration: 1, idle: true }, { pid: 91001, processName: 'worker', startTime: 1, endTime: 4, duration: 3, idle: false }], completedGantt: [], sampleIntervalTicks: 1, maxRetainedSamples: 4096, retainedSampleCount: 2, historyTruncated: false },
  memory: { totalMemory: 100, allocatedMemory: 40, freeMemory: 60, allocatedBlockCount: 2, freeBlockCount: 2, largestFreeBlock: 28, utilizationPercent: 40, externalFragmentationPercent: 53.333, allocationFailures: 2 },
  processes: { stateCounts: { NEW: 0, READY: 0, RUNNING: 1, WAITING: 0, PAUSED: 0, TERMINATED: 0 }, processTableCount: 1, processes: [{ pid: 91001, name: 'worker', state: 'RUNNING', arrivalTime: 1, burstTime: 3, remainingTime: 2, completionTime: -1, waitingTime: 0, turnaroundTime: -1, responseTime: 0 }] },
}
const events: SystemEvent[] = [
  { eventId: 1, simulationTime: 0, pid: 91001, type: 'PROCESS_CREATED', description: 'Process worker created' },
  { eventId: 2, simulationTime: 1, pid: 91001, type: 'STATE_CHANGED', description: 'NEW -> READY: Process arrived' },
  { eventId: 3, simulationTime: 1, pid: 91001, type: 'STATE_CHANGED', description: 'READY -> RUNNING: Selected by FCFS' },
  { eventId: 4, simulationTime: 2, pid: null, type: 'CPU_IDLE', description: 'CPU idle' },
]
const report: ComparisonReport = {
  comparisonId: 'report-1', workloadId: 'workload-1', workloadName: 'Mixed workload', createdAt: '2026-11-14T10:00:00Z',
  workloadSnapshot: { id: 'workload-1', name: 'Mixed workload', description: '', createdAt: '2026-11-14T10:00:00Z', updatedAt: '2026-11-14T10:00:00Z', processes: [], algorithm: 'FCFS', timeQuantum: 0, preemptivePriority: false, totalMemory: 100, memoryAllocationStrategy: 'FIRST_FIT', speed: 1 },
  results: [{ configurationId: 'fcfs', label: 'FCFS', algorithm: 'FCFS', preemptive: false, timeQuantum: 0, gantt: [{ pid: -1, processName: 'IDLE', startTime: 0, endTime: 1, duration: 1, idle: true }, { pid: 1, processName: 'worker', startTime: 1, endTime: 4, duration: 3, idle: false }], processes: [], averageWaitingTime: 1, averageTurnaroundTime: 4, averageResponseTime: 1, totalTime: 4, cpuUtilization: 75, throughput: .25 }], winners: [],
}
beforeEach(() => { vi.clearAllMocks(); mocks.snapshot.mockResolvedValue(snapshot); mocks.events.mockResolvedValue(events); mocks.reports.mockResolvedValue([report]); mocks.get.mockResolvedValue(report) })

describe('System Analytics Observatory', () => {
  it('renders actual live samples, memory metrics, process states and event charts', async () => {
    render(<AnalyticsPage />)
    expect(await screen.findByText('50.0%')).toBeInTheDocument()
    expect(screen.getByText('53.3%')).toBeInTheDocument()
    expect(screen.getByText('ACTUAL TICK SAMPLES')).toBeInTheDocument()
    expect(screen.getByText('PROCESS OBSERVATORY')).toBeInTheDocument()
    expect(screen.getAllByText('STATE_CHANGED').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/IDLE/).length).toBeGreaterThan(0)
    expect(screen.getByText(/2026-11-14 · FCFS/)).toBeInTheDocument()
    expect(screen.getAllByText(/PROCESS_CREATED/).length).toBeGreaterThan(0)
  })

  it('filters event history by PID and historical comparisons by workload, algorithm, date and metric', async () => {
    render(<AnalyticsPage />)
    await screen.findByText('Recent activity')
    fireEvent.change(screen.getByLabelText('Filter events by process'), { target: { value: '91001' } })
    expect(screen.queryByText('CPU idle')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Filter comparisons by workload'), { target: { value: 'workload-1' } })
    fireEvent.change(screen.getByLabelText('Filter comparisons by algorithm'), { target: { value: 'SJF' } })
    fireEvent.change(screen.getByLabelText('Comparison from date'), { target: { value: '2026-11-15' } })
    fireEvent.change(screen.getByLabelText('Comparison metric'), { target: { value: 'throughput' } })
    expect(await screen.findByText('No comparisons match these filters')).toBeInTheDocument()
  })

  it('opens a saved comparison report for historical detail', async () => {
    render(<AnalyticsPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Mixed workload/ }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('report-1'))
    expect(await screen.findByText('Historical report · Mixed workload')).toBeInTheDocument()
    expect(screen.getByText('Avg turnaround')).toBeInTheDocument()
  })

  it('handles empty history, API errors, loading and application navigation', async () => {
    mocks.events.mockResolvedValueOnce([]); mocks.reports.mockResolvedValueOnce([])
    const { unmount } = render(<AnalyticsPage />)
    expect(await screen.findByText('No saved comparisons')).toBeInTheDocument()
    expect(screen.getByText('No event history')).toBeInTheDocument()
    unmount()
    mocks.snapshot.mockRejectedValueOnce(new Error('analytics endpoint unavailable'))
    render(<AnalyticsPage />)
    expect(await screen.findByText('analytics endpoint unavailable')).toBeInTheDocument()
    unmount()
    render(<MemoryRouter initialEntries={['/analytics']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'System analytics' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /System Analytics/ })).toHaveAttribute('href', '/analytics')
  })

  it('shows a loading state while the backend snapshot is pending', async () => {
    mocks.snapshot.mockReturnValue(new Promise(() => {}))
    const { unmount } = render(<AnalyticsPage />)
    expect(await screen.findByText('Loading backend analytics…')).toBeInTheDocument()
    unmount()
  })
})
