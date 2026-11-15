import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import { AlgorithmComparisonPage } from './AlgorithmComparisonPage'
import type { ComparisonReport } from '../api/comparisons'
import type { Workload } from '../api/workloads'

const mocks = vi.hoisted(() => ({
  workloads: vi.fn(), run: vi.fn(), reports: vi.fn(), get: vi.fn(), remove: vi.fn(),
  context: { processes: [], memory: null, simulation: { status: 'READY', currentTime: 0, totalTime: 0 }, events: [], connected: true, loading: false, error: '', refresh: vi.fn(), setProcesses: vi.fn(), setMemory: vi.fn(), setSimulation: vi.fn() },
}))
vi.mock('../api/workloads', () => ({ workloadsApi: { list: mocks.workloads } }))
vi.mock('../api/comparisons', () => ({ comparisonsApi: { run: mocks.run, list: mocks.reports, get: mocks.get, remove: mocks.remove } }))
vi.mock('../api/client', () => ({ errorMessage: (error: unknown) => error instanceof Error ? error.message : 'API error' }))
vi.mock('../hooks/useSystemData', () => ({ useSystemData: () => mocks.context }))

const workload: Workload = { id: 'w-1', name: 'Idle then burst', description: '', createdAt: '2026-11-15T00:00:00Z', updatedAt: '2026-11-15T00:00:00Z', processes: [{ pid: 72001, name: 'worker', priority: 2, arrivalTime: 2, burstTime: 3, memoryRequirement: 32, parentPid: -1 }, { pid: 72002, name: 'urgent', priority: 10, arrivalTime: 4, burstTime: 1, memoryRequirement: 32, parentPid: -1 }], algorithm: 'FCFS', timeQuantum: 0, preemptivePriority: false, totalMemory: 512, memoryAllocationStrategy: 'FIRST_FIT', speed: 1 }
const report: ComparisonReport = {
  comparisonId: 'cmp-12345678', workloadId: 'w-1', workloadName: workload.name, createdAt: '2026-11-15T01:00:00Z', workloadSnapshot: workload,
  results: [
    { configurationId: 'fcfs', label: 'FCFS', algorithm: 'FCFS', preemptive: false, timeQuantum: 0, gantt: [{ pid: -1, processName: 'IDLE', startTime: 0, endTime: 2, duration: 2, idle: true }, { pid: 72001, processName: 'worker', startTime: 2, endTime: 5, duration: 3, idle: false }, { pid: 72002, processName: 'urgent', startTime: 5, endTime: 6, duration: 1, idle: false }], processes: [{ pid: 72001, name: 'worker', completionTime: 5, turnaroundTime: 3, waitingTime: 0, responseTime: 0 }, { pid: 72002, name: 'urgent', completionTime: 6, turnaroundTime: 2, waitingTime: 1, responseTime: 1 }], averageWaitingTime: .5, averageTurnaroundTime: 2.5, averageResponseTime: .5, totalTime: 6, cpuUtilization: 66.666666, throughput: 1 / 3 },
    { configurationId: 'rr-1', label: 'Round Robin · q2', algorithm: 'ROUND_ROBIN', preemptive: false, timeQuantum: 2, gantt: [{ pid: -1, processName: 'IDLE', startTime: 0, endTime: 2, duration: 2, idle: true }, { pid: 72001, processName: 'worker', startTime: 2, endTime: 4, duration: 2, idle: false }, { pid: 72002, processName: 'urgent', startTime: 4, endTime: 5, duration: 1, idle: false }, { pid: 72001, processName: 'worker', startTime: 5, endTime: 6, duration: 1, idle: false }], processes: [{ pid: 72001, name: 'worker', completionTime: 6, turnaroundTime: 4, waitingTime: 1, responseTime: 0 }, { pid: 72002, name: 'urgent', completionTime: 5, turnaroundTime: 1, waitingTime: 0, responseTime: 0 }], averageWaitingTime: .5, averageTurnaroundTime: 2.5, averageResponseTime: 0, totalTime: 6, cpuUtilization: 66.666666, throughput: 1 / 3 },
  ],
  winners: [{ metric: 'averageWaitingTime', objective: 'MINIMIZE', value: .5, configurationIds: ['fcfs', 'rr-1'], labels: ['FCFS', 'Round Robin · q2'] }, { metric: 'averageResponseTime', objective: 'MINIMIZE', value: 0, configurationIds: ['rr-1'], labels: ['Round Robin · q2'] }],
}

beforeEach(() => { vi.clearAllMocks(); mocks.workloads.mockResolvedValue([workload]); mocks.run.mockResolvedValue(report); mocks.reports.mockResolvedValue([report]); mocks.get.mockResolvedValue(report); mocks.remove.mockResolvedValue({}) })

describe('Algorithm comparison workspace', () => {
  it('loads workload selection and renders isolated metrics, winners, Gantt and process details', async () => {
    render(<AlgorithmComparisonPage />)
    expect(await screen.findByLabelText('Comparison workload')).toHaveValue('w-1')
    fireEvent.click(screen.getByRole('button', { name: 'Run selected configurations' }))
    expect(await screen.findByText('Metric leaders')).toBeInTheDocument()
    expect(screen.getAllByText('Average waiting').length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: 'Gantt chart for FCFS' })).toBeInTheDocument()
    expect(screen.getAllByText('IDLE').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('FCFS', { selector: 'summary span' }))
    expect(screen.getAllByText('COMPLETION').length).toBeGreaterThan(0)
    expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({ workloadId: 'w-1', configurations: expect.arrayContaining([expect.objectContaining({ algorithm: 'PRIORITY', preemptivePriority: true }), expect.objectContaining({ algorithm: 'ROUND_ROBIN', timeQuantum: 2 })]) }))
  })

  it('allows adding a Round Robin quantum and blocks invalid quantum values', async () => {
    render(<AlgorithmComparisonPage />)
    await screen.findByLabelText('Comparison workload')
    fireEvent.click(screen.getByRole('button', { name: 'Add RR quantum' }))
    expect(screen.getByLabelText('Quantum rr-2')).toHaveValue(3)
    fireEvent.change(screen.getByLabelText('Quantum rr-1'), { target: { value: '0' } })
    expect(screen.getByText('Quantum must be a positive whole number.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run selected configurations' })).toBeDisabled()
    expect(mocks.run).not.toHaveBeenCalled()
  })

  it('sends only the selected algorithms to the comparison API', async () => {
    render(<AlgorithmComparisonPage />)
    await screen.findByLabelText('Comparison workload')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Compare FCFS' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run selected configurations' }))
    await waitFor(() => expect(mocks.run).toHaveBeenCalled())
    const sent = mocks.run.mock.calls[0][0]
    expect(sent.configurations).toHaveLength(4)
    expect(sent.configurations.some((configuration: { algorithm: string }) => configuration.algorithm === 'FCFS')).toBe(false)
  })

  it('opens and deletes saved reports with confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AlgorithmComparisonPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Idle then burst/ }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('cmp-12345678'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete report cmp-12345678' }))
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('cmp-12345678'))
    expect(window.confirm).toHaveBeenCalled()
  })

  it('shows empty and API error states and is reachable from navigation', async () => {
    mocks.workloads.mockResolvedValueOnce([]); mocks.reports.mockResolvedValueOnce([])
    const { unmount } = render(<AlgorithmComparisonPage />)
    expect(await screen.findByText('No workloads available')).toBeInTheDocument()
    unmount()
    mocks.workloads.mockRejectedValueOnce(new Error('comparison API unavailable'))
    render(<AlgorithmComparisonPage />)
    expect(await screen.findByText('comparison API unavailable')).toBeInTheDocument()
    unmount()
    mocks.workloads.mockResolvedValue([workload]); mocks.reports.mockResolvedValue([report])
    render(<MemoryRouter initialEntries={['/comparison']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Algorithm comparison' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Algorithm Comparison/ })).toHaveAttribute('href', '/comparison')
  })
})
