import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import { ExperimentationLabPage } from './ExperimentationLabPage'
import type { Workload } from '../api/workloads'
import type { ExperimentInput, ExperimentReport } from '../api/experiments'

const mocks = vi.hoisted(() => ({ workloadList: vi.fn(), execute: vi.fn(), list: vi.fn(), get: vi.fn(), remove: vi.fn(), context: { processes: [], memory: null, simulation: { status: 'READY', currentTime: 0, totalTime: 0 }, events: [], connected: true, loading: false, error: '', refresh: vi.fn(), setProcesses: vi.fn(), setMemory: vi.fn(), setSimulation: vi.fn() } }))
vi.mock('../api/workloads', () => ({ workloadsApi: { list: mocks.workloadList } }))
vi.mock('../api/experiments', () => ({ experimentsApi: { execute: mocks.execute, list: mocks.list, get: mocks.get, remove: mocks.remove } }))
vi.mock('../api/client', () => ({ errorMessage: (error: unknown) => error instanceof Error ? error.message : 'API error' }))
vi.mock('../hooks/useSystemData', () => ({ useSystemData: () => mocks.context }))

const workload: Workload = { id: 'saved-workload', name: 'Saved workload', description: 'Two jobs', createdAt: null, updatedAt: null,
  processes: [{ pid: 81001, name: 'compile', priority: 4, arrivalTime: 0, burstTime: 4, memoryRequirement: 64, parentPid: -1 }, { pid: 81002, name: 'index', priority: 6, arrivalTime: 1, burstTime: 2, memoryRequirement: 32, parentPid: -1 }],
  algorithm: 'FCFS', timeQuantum: 0, preemptivePriority: false, totalMemory: 512, memoryAllocationStrategy: 'FIRST_FIT', speed: 1 }
const report = { experimentId: 'exp-1', name: 'Test run', description: '', type: 'SCHEDULING', baseWorkloadId: workload.id, baseWorkloadName: workload.name, executedAt: '2026-11-15T00:00:00Z', workloadSnapshot: workload,
  baseline: { variantId: 'baseline', label: 'Baseline', configuration: { algorithm: 'FCFS' }, parameterChanges: [], schedulingResult: { gantt: [], processes: [] } },
  variants: [{ variantId: 'v1', label: 'Variant 1', configuration: { algorithm: 'ROUND_ROBIN' }, parameterChanges: ['Algorithm: FCFS → ROUND_ROBIN'], schedulingResult: { gantt: [], processes: [] } }],
  metricComparisons: [{ variantId: 'v1', variantLabel: 'Variant 1', metric: 'averageWaitingTime', baselineValue: 2, variantValue: 1, difference: -1, absoluteDifference: 1, percentageChange: -50 }],
  processMetricDeltas: [], winners: [{ metric: 'averageWaitingTime', objective: 'MINIMIZE', value: 1, configurationIds: ['v1'], labels: ['Variant 1'] }],
} as unknown as ExperimentReport

beforeEach(() => { vi.clearAllMocks(); mocks.workloadList.mockResolvedValue([workload]); mocks.list.mockResolvedValue([]); mocks.execute.mockResolvedValue(report); mocks.get.mockResolvedValue(report); mocks.remove.mockResolvedValue({}) })

describe('Experimentation Lab', () => {
  it('selects a workload, edits a scheduling variant and renders saved results', async () => {
    render(<MemoryRouter><ExperimentationLabPage /></MemoryRouter>)
    expect(await screen.findByLabelText('Experiment workload')).toHaveValue(workload.id)
    fireEvent.change(await screen.findByLabelText('Variant 1 algorithm'), { target: { value: 'ROUND_ROBIN' } })
    fireEvent.change(screen.getByLabelText('Variant 1 quantum'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Variant 1 compile burstTime'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run isolated experiment' }))
    await waitFor(() => expect(mocks.execute).toHaveBeenCalled())
    const request = mocks.execute.mock.calls[0][0] as ExperimentInput
    expect(request.baseWorkloadId).toBe(workload.id)
    expect(request.variants[0].algorithm).toBe('ROUND_ROBIN')
    expect(request.variants[0].processChanges).toEqual([{ pid: 81001, burstTime: 5 }])
    expect(await screen.findByText('Baseline comparison')).toBeInTheDocument()
    expect(screen.getByText('ISOLATED / LIVE SIMULATION UNCHANGED')).toBeInTheDocument()
    expect(screen.getByText(/IMPROVED/)).toBeInTheDocument()
  })

  it('requires the same visible memory sequence for all three strategies and submits allocation requests', async () => {
    render(<MemoryRouter><ExperimentationLabPage /></MemoryRouter>)
    await screen.findByLabelText('Experiment workload')
    fireEvent.change(screen.getByLabelText('Experiment type'), { target: { value: 'MEMORY' } })
    fireEvent.click(screen.getByRole('button', { name: 'Allocate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run isolated experiment' }))
    await waitFor(() => expect(mocks.execute).toHaveBeenCalled())
    const request = mocks.execute.mock.calls[0][0] as ExperimentInput
    expect(request.type).toBe('MEMORY')
    expect(request.variants.map((variant) => variant.memoryStrategy)).toEqual(['BEST_FIT', 'WORST_FIT'])
    expect(request.memoryOperations).toEqual([{ operation: 'ALLOCATE', pid: 81001, amount: 64 }])
  })

  it('blocks unsupported Round Robin parameters before calling the backend', async () => {
    render(<MemoryRouter><ExperimentationLabPage /></MemoryRouter>)
    fireEvent.change(await screen.findByLabelText('Variant 1 algorithm'), { target: { value: 'ROUND_ROBIN' } })
    fireEvent.change(await screen.findByLabelText('Variant 1 quantum'), { target: { value: '0' } })
    expect(await screen.findByText(/quantum must be a positive whole number/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run isolated experiment' })).toBeDisabled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('validates ordered deallocation requests before execution', async () => {
    render(<MemoryRouter><ExperimentationLabPage /></MemoryRouter>)
    await screen.findByLabelText('Experiment workload')
    fireEvent.change(screen.getByLabelText('Experiment type'), { target: { value: 'MEMORY' } })
    fireEvent.click(screen.getByRole('button', { name: 'Deallocate' }))
    expect(await screen.findByText(/needs an earlier allocation request/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run isolated experiment' })).toBeDisabled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('opens and deletes a saved report with confirmation and exposes navigation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mocks.list.mockResolvedValue([report])
    render(<MemoryRouter initialEntries={['/experiments']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Experimentation lab' })).toBeInTheDocument()
    const savedName = await screen.findByText('Test run')
    fireEvent.click(savedName.closest('button')!)
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('exp-1'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete experiment Test run' }))
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('exp-1'))
    expect(screen.getByRole('link', { name: /Experimentation Lab/ })).toHaveAttribute('href', '/experiments')
  })

  it('reports API load and execution failures', async () => {
    mocks.workloadList.mockRejectedValueOnce(new Error('workload API unavailable'))
    const { unmount } = render(<MemoryRouter><ExperimentationLabPage /></MemoryRouter>)
    expect(await screen.findByText('workload API unavailable')).toBeInTheDocument()
    unmount()
    mocks.workloadList.mockResolvedValue([workload]); mocks.list.mockResolvedValue([]); mocks.execute.mockRejectedValueOnce(new Error('experiment failed'))
    render(<MemoryRouter><ExperimentationLabPage /></MemoryRouter>)
    await screen.findByLabelText('Experiment workload')
    fireEvent.click(screen.getByRole('button', { name: 'Run isolated experiment' }))
    expect(await screen.findByText('experiment failed')).toBeInTheDocument()
  })
})
