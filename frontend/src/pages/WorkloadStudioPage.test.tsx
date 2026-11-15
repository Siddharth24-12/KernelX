import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import { WorkloadStudioPage } from './WorkloadStudioPage'
import type { Workload, WorkloadInput } from '../api/workloads'

const mocks = vi.hoisted(() => ({ list: vi.fn(), templates: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), validate: vi.fn(), load: vi.fn(), execute: vi.fn(), context: { processes: [], memory: null, simulation: { status: 'READY', currentTime: 0, totalTime: 0 }, events: [], connected: true, loading: false, error: '', refresh: vi.fn(), setProcesses: vi.fn(), setMemory: vi.fn(), setSimulation: vi.fn() } }))
vi.mock('../api/workloads', () => ({ workloadsApi: mocks }))
vi.mock('../api/client', () => ({ errorMessage: (error: unknown) => error instanceof Error ? error.message : 'API error' }))
vi.mock('../hooks/useSystemData', () => ({ useSystemData: () => mocks.context }))

const template: Workload = { id: 'builtin-short-jobs', name: 'Short Jobs', description: 'Short bursts', createdAt: null, updatedAt: null, processes: [{ pid: 61001, name: 'compile', priority: 4, arrivalTime: 0, burstTime: 3, memoryRequirement: 96, parentPid: -1 }], algorithm: 'SJF', timeQuantum: 0, preemptivePriority: false, totalMemory: 1024, memoryAllocationStrategy: 'FIRST_FIT', speed: 1 }
const saved: Workload = { ...template, id: 'w-1', name: 'Saved Demo', createdAt: '2026-11-15T00:00:00Z', updatedAt: '2026-11-15T00:00:00Z' }
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mocks.list.mockResolvedValue([template, saved]); mocks.templates.mockResolvedValue([template]); mocks.validate.mockResolvedValue({ valid: true, errors: [], warnings: [] }); mocks.create.mockImplementation(async (body: WorkloadInput) => ({ ...body, id: 'w-new', createdAt: null, updatedAt: null })); mocks.update.mockResolvedValue(saved); mocks.load.mockResolvedValue({ workloadId: 'w-new', processes: [{ pid: 62001, name: 'compile' }] }); mocks.execute.mockResolvedValue({ workloadId: 'w-new', createdPids: [62001], simulation: { status: 'RUNNING', algorithm: 'FCFS', currentTime: 0, totalTime: 4 } }); mocks.remove.mockResolvedValue({}) })

describe('Workload Studio', () => {
  it('loads templates and edits process definitions in the editor', async () => {
    render(<MemoryRouter><WorkloadStudioPage /></MemoryRouter>)
    expect(await screen.findByText('Short Jobs')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Short Jobs/ }))
    expect(screen.getByLabelText('Workload name')).toHaveValue('Short Jobs')
    expect(screen.getByLabelText('PID row 1')).toHaveValue(61001)
  })

  it('validates, saves and runs through the workload API', async () => {
    render(<MemoryRouter><WorkloadStudioPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Workload name'), { target: { value: 'Demo batch' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }))
    await waitFor(() => expect(mocks.validate).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Run workload' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalled())
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledWith('w-new'))
    expect(await screen.findByText(/Started FCFS with 1 processes/)).toBeInTheDocument()
  })

  it('loads a validated workload into the simulator without starting a second scheduler', async () => {
    render(<MemoryRouter><WorkloadStudioPage /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: /Short Jobs/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Load into simulator' }))
    await waitFor(() => expect(mocks.load).toHaveBeenCalledWith('w-new'))
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(localStorage.getItem('kernelx.pendingSchedulerConfig')).toContain('SJF')
  })

  it('shows an empty library and a retryable API error', async () => {
    mocks.list.mockResolvedValueOnce([]); mocks.templates.mockResolvedValueOnce([])
    const { unmount } = render(<MemoryRouter><WorkloadStudioPage /></MemoryRouter>)
    expect(await screen.findByText('No saved workloads')).toBeInTheDocument()
    expect(screen.getByText('No built-in templates')).toBeInTheDocument()
    unmount()
    mocks.list.mockRejectedValueOnce(new Error('workload service unavailable'))
    render(<MemoryRouter><WorkloadStudioPage /></MemoryRouter>)
    expect(await screen.findByText('workload service unavailable')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }))
    expect(await screen.findByText('Saved Demo')).toBeInTheDocument()
  })

  it('opens Workload Studio from application navigation', async () => {
    render(<MemoryRouter initialEntries={['/workloads']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Workload Studio' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Workload Studio/ })).toHaveAttribute('href', '/workloads')
  })
})
