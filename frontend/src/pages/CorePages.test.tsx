import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { MemoryPage } from './MemoryPage'
import { ProcessesPage } from './ProcessesPage'
import { Gantt, SchedulerPage } from './SchedulerPage'
import type { useSystemData } from '../hooks/useSystemData'
import type { MemorySnapshot, ProcessRecord } from '../types/api'

const { allocateMock, deallocateMock, createMock, listMock, priorityMock, startMock, scheduleMock } = vi.hoisted(() => ({ allocateMock: vi.fn(), deallocateMock: vi.fn(), createMock: vi.fn(), listMock: vi.fn(), priorityMock: vi.fn(), startMock: vi.fn(), scheduleMock: vi.fn() }))
vi.mock('../api/memory', () => ({ memoryApi: { get: vi.fn(), allocate: allocateMock, deallocate: deallocateMock } }))
vi.mock('../api/processes', () => ({ processesApi: { list: listMock, get: vi.fn(), create: createMock, remove: vi.fn(), priority: priorityMock, pause: vi.fn(), resume: vi.fn() } }))
vi.mock('../api/simulation', () => ({ simulationApi: { schedule: scheduleMock, start: startMock, pause: vi.fn(), resume: vi.fn(), step: vi.fn(), reset: vi.fn(), state: vi.fn(), gantt: vi.fn(), events: vi.fn() } }))

const process: ProcessRecord = { pid: 11, name: 'pager', priority: 5, arrivalTime: 0, burstTime: 6, remainingTime: 6, memoryRequirement: 200, parentPid: -1, state: 'READY', completionTime: -1, waitingTime: 0, turnaroundTime: -1, responseTime: -1 }
const startingMemory: MemorySnapshot = { totalMemory: 1024, allocatedMemory: 100, freeMemory: 924, blocks: [{ startAddress: 0, size: 100, pid: 10, free: false }, { startAddress: 100, size: 924, pid: null, free: true }] }
const changedMemory: MemorySnapshot = { totalMemory: 1024, allocatedMemory: 300, freeMemory: 724, blocks: [{ startAddress: 0, size: 100, pid: 10, free: false }, { startAddress: 100, size: 200, pid: 11, free: false }, { startAddress: 300, size: 724, pid: null, free: true }] }
const context: ReturnType<typeof useSystemData> = {
  processes: [process], memory: startingMemory,
  simulation: { status: 'READY', algorithm: null, currentTime: 0, totalTime: 0, speed: 1, runningPid: null, readyPids: [], waitingPids: [], completedSegments: [] },
  events: [], connected: true, loading: false, error: '', refresh: vi.fn(), setProcesses: vi.fn(), setMemory: vi.fn(), setSimulation: vi.fn(),
}
function ContextOutlet() { return <Outlet context={context} /> }
function renderWithContext(page: React.ReactNode) { return render(<MemoryRouter><Routes><Route element={<ContextOutlet />}><Route path="*" element={page} /></Route></Routes></MemoryRouter>) }

describe('core workspace pages', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('opens process inspection and filters the process table', () => {
    renderWithContext(<ProcessesPage />)
    expect(screen.getByText('pager')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Search processes' }), { target: { value: 'not-a-process' } })
    expect(screen.getByText('No matching processes')).toBeInTheDocument()
  })

  it('submits the process form with backend field names and root parent default', async () => {
    createMock.mockResolvedValue({ ...process, pid: 12, name: 'worker' })
    renderWithContext(<ProcessesPage />)
    fireEvent.click(screen.getByRole('button', { name: 'New process' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: /Process ID/ }), { target: { value: '12' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'worker' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create process' }))
    await waitFor(() => expect(createMock).toHaveBeenCalledWith({ pid: 12, name: 'worker', priority: 5, arrivalTime: 0, burstTime: 5, memoryRequirement: 128, parentPid: -1 }))
  })

  it('keeps empty numeric input blank and accepts valid zero priority and arrival values', async () => {
    createMock.mockResolvedValue({ ...process, pid: 12, priority: 0, arrivalTime: 0 })
    renderWithContext(<ProcessesPage />)
    fireEvent.click(screen.getByRole('button', { name: 'New process' }))
    const pid = screen.getByRole('spinbutton', { name: /Process ID/ })
    fireEvent.change(pid, { target: { value: '' } })
    expect(pid).toHaveValue(null)
    fireEvent.change(pid, { target: { value: '12' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'worker' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: /Priority/ }), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create process' }))
    await waitFor(() => expect(createMock).toHaveBeenCalledWith({ pid: 12, name: 'worker', priority: 0, arrivalTime: 0, burstTime: 5, memoryRequirement: 128, parentPid: -1 }))
  })

  it('supports priority editing and cancelling without submitting', async () => {
    renderWithContext(<ProcessesPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit priority for PID 11' }))
    const priority = screen.getByRole('spinbutton', { name: 'Priority value' })
    expect(priority).toHaveValue(5)
    fireEvent.change(priority, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(priorityMock).not.toHaveBeenCalled()
    priorityMock.mockResolvedValue({ ...process, priority: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Edit priority for PID 11' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Priority value' }), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save priority' }))
    await waitFor(() => expect(priorityMock).toHaveBeenCalledWith(11, 0))
  })

  it('renders backend memory blocks and selects an allocation for inspection', () => {
    renderWithContext(<MemoryPage />)
    fireEvent.click(screen.getByLabelText('PID 10 block, address 0, size 100'))
    expect(screen.getByText('PROCESS ALLOCATION')).toBeInTheDocument()
    expect(screen.getAllByText('PID 10').length).toBeGreaterThanOrEqual(2)
  })

  it('posts a selected allocation policy and uses the returned memory snapshot', async () => {
    allocateMock.mockResolvedValue({ success: true, memory: changedMemory })
    renderWithContext(<MemoryPage />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Process record' }), { target: { value: '11' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Allocation algorithm' }), { target: { value: 'BEST_FIT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Allocate memory' }))
    await waitFor(() => expect(allocateMock).toHaveBeenCalledWith(11, 'BEST_FIT'))
    expect(await screen.findByText(/allocated 200 units using best fit/i)).toBeInTheDocument()
    expect(context.setMemory).toHaveBeenCalledWith(changedMemory)
  })

  it('deallocates the inspected PID through the backend endpoint', async () => {
    deallocateMock.mockResolvedValue({ success: true, memory: startingMemory })
    renderWithContext(<MemoryPage />)
    fireEvent.click(screen.getByLabelText('PID 10 block, address 0, size 100'))
    fireEvent.click(screen.getByRole('button', { name: 'Deallocate PID 10' }))
    await waitFor(() => expect(deallocateMock).toHaveBeenCalledWith(10))
  })

  it('starts the backend schedule with the selected policy and memory strategy', async () => {
    startMock.mockResolvedValue({ status: 'RUNNING', algorithm: 'FCFS', currentTime: 0, totalTime: 6, speed: 1, runningPid: 11, readyPids: [], waitingPids: [], completedSegments: [] })
    renderWithContext(<SchedulerPage />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Scheduling algorithm' }), { target: { value: 'FCFS' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start simulation' }))
    await waitFor(() => expect(startMock).toHaveBeenCalledWith({ algorithm: 'FCFS', memoryAllocationStrategy: 'FIRST_FIT', totalMemory: 1024, speed: 1 }))
  })

  it('applies browser scheduler defaults when starting a run', async () => {
    localStorage.setItem('kernelx.defaultSchedulerConfig', JSON.stringify({ algorithm: 'SJF', timeQuantum: 4, preemptivePriority: false, totalMemory: 768, memoryAllocationStrategy: 'BEST_FIT', speed: 1.75 }))
    startMock.mockResolvedValue({ status: 'RUNNING', algorithm: 'SJF', currentTime: 0, totalTime: 6, speed: 1.75, runningPid: 11, readyPids: [], waitingPids: [], completedSegments: [] })
    renderWithContext(<SchedulerPage />)
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Scheduling algorithm' })).toHaveValue('SJF'))
    fireEvent.click(screen.getByRole('button', { name: 'Start simulation' }))
    await waitFor(() => expect(startMock).toHaveBeenCalledWith({ algorithm: 'SJF', memoryAllocationStrategy: 'BEST_FIT', totalMemory: 768, speed: 1.75 }))
  })

  it('renders actual process, idle and current-tick Gantt intervals', () => {
    render(<Gantt data={[
      { pid: 11, processName: 'pager', startTime: 0, endTime: 2, duration: 2, idle: false },
      { pid: -1, processName: 'IDLE', startTime: 2, endTime: 3, duration: 1, idle: true },
      { pid: 11, processName: 'pager', startTime: 3, endTime: 5, duration: 2, idle: false },
    ]} totalTime={5} currentTime={1} activePid={11} />)
    expect(screen.getAllByText('P11').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('IDLE')).toBeInTheDocument()
    expect(screen.getByTitle('pager · PID 11 · [0, 2)')).toBeInTheDocument()
    expect(screen.getByTitle('Simulation time 1')).toBeInTheDocument()
  })
})
