import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { App } from '../App'
import { ArchivePage } from './ArchivePage'
import { EventMonitorPage } from './EventMonitorPage'
import { ProcessTreePage } from './ProcessTreePage'
import { SettingsPage } from './SettingsPage'
import { LandingStoryOverlay } from '../components/landing/LandingStoryOverlay'
import type { useSystemData } from '../hooks/useSystemData'
import type { ProcessTreeNode, SavedConfiguration, SavedSimulation, SystemEvent } from '../types/api'

const mocks = vi.hoisted(() => ({
  context: null as any, treeGet: vi.fn(), sims: vi.fn(), configs: vi.fn(), simGet: vi.fn(), configGet: vi.fn(), saveSim: vi.fn(), saveConfig: vi.fn(), deleteSim: vi.fn(), deleteConfig: vi.fn(), health: vi.fn(),
}))
vi.mock('../hooks/useSystemData', () => ({ useSystemData: () => mocks.context }))
vi.mock('../api/tree', () => ({ processTreeApi: { get: mocks.treeGet } }))
vi.mock('../api/archive', () => ({ archiveApi: { simulations: mocks.sims, configurations: mocks.configs, simulation: mocks.simGet, configuration: mocks.configGet, saveSimulation: mocks.saveSim, saveConfiguration: mocks.saveConfig, deleteSimulation: mocks.deleteSim, deleteConfiguration: mocks.deleteConfig } }))
vi.mock('../api/client', () => ({ api: { defaults: { baseURL: 'http://localhost:8081' }, get: mocks.health }, errorMessage: (error: unknown) => error instanceof Error ? error.message : 'API error' }))

const events: SystemEvent[] = [
  { eventId: 2, simulationTime: 5, pid: 22, type: 'PROCESS_CREATED', description: 'worker created' },
  { eventId: 1, simulationTime: 1, pid: null, type: 'SIMULATION_STARTED', description: 'simulation started' },
  { eventId: 3, simulationTime: 5, pid: 22, type: 'PROCESS_PAUSED', description: 'worker paused' },
]
const root: ProcessTreeNode = { pid: 11, name: 'kernel', priority: 5, arrivalTime: 0, burstTime: 8, remainingTime: 8, memoryRequirement: 128, parentPid: -1, state: 'READY', children: [{ pid: 12, name: 'worker', priority: 3, arrivalTime: 1, burstTime: 4, remainingTime: 4, memoryRequirement: 64, parentPid: 11, state: 'PAUSED', children: [] }] }
const simulation: SavedSimulation = { id: 's-1', name: 'Completed sample', savedAt: '2026-11-14T00:00:00Z', scheduling: { algorithm: 'FCFS', preemptive: false, timeQuantum: 0, gantt: [], processes: [], averageWaitingTime: 0, averageTurnaroundTime: 0, averageResponseTime: 0, totalTime: 0 }, processes: [{ pid: 11, name: 'kernel', state: 'TERMINATED', completionTime: 8, turnaroundTime: 8 }], memory: { totalMemory: 1024, allocatedMemory: 0, freeMemory: 1024, blocks: [] }, events }
const configuration: SavedConfiguration = { id: 'c-1', name: 'Default RR', createdAt: '2026-11-14T00:00:00Z', simulation: { algorithm: 'ROUND_ROBIN', timeQuantum: 2, preemptivePriority: false }, totalMemory: 1024, memoryAllocationStrategy: 'FIRST_FIT', speed: 1 }
const context: ReturnType<typeof useSystemData> = { processes: [], memory: null, simulation: { status: 'COMPLETED', algorithm: 'FCFS', currentTime: 8, totalTime: 8, speed: 1, runningPid: null, readyPids: [], waitingPids: [], completedSegments: [] }, events, connected: true, loading: false, error: '', refresh: vi.fn(), setProcesses: vi.fn(), setMemory: vi.fn(), setSimulation: vi.fn() }
function ContextOutlet() { return <Outlet context={context} /> }
function renderWithContext(page: ReactNode) { return render(<MemoryRouter><Routes><Route element={<ContextOutlet />}><Route path="*" element={page} /></Route></Routes></MemoryRouter>) }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); mocks.context = context
  mocks.treeGet.mockResolvedValue([root]); mocks.sims.mockResolvedValue([simulation]); mocks.configs.mockResolvedValue([configuration]); mocks.simGet.mockResolvedValue(simulation); mocks.configGet.mockResolvedValue(configuration); mocks.saveSim.mockResolvedValue(simulation); mocks.saveConfig.mockResolvedValue(configuration); mocks.deleteSim.mockResolvedValue({}); mocks.deleteConfig.mockResolvedValue({}); mocks.health.mockResolvedValue({ data: { status: 'UP', application: 'KernelX', mode: 'simulation backend foundation' } })
})

describe('Phase 4.2 pages and navigation', () => {
  it('renders and expands the backend process tree, selecting process details', async () => {
    render(<MemoryRouter><ProcessTreePage /></MemoryRouter>)
    expect(await screen.findByText('worker')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /worker/ }))
    expect(screen.getByText('Parent PID')).toBeInTheDocument(); expect(screen.getAllByText('PAUSED')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse PID 11' })); expect(screen.queryByRole('button', { name: /worker/ })).not.toBeInTheDocument()
  })
  it('shows an empty hierarchy and a retryable API error', async () => {
    mocks.treeGet.mockResolvedValueOnce([])
    const { unmount } = render(<MemoryRouter><ProcessTreePage /></MemoryRouter>)
    expect(await screen.findByText('No processes in the tree')).toBeInTheDocument(); unmount()
    mocks.treeGet.mockRejectedValueOnce(new Error('tree unavailable'))
    render(<MemoryRouter><ProcessTreePage /></MemoryRouter>)
    expect(await screen.findByText('tree unavailable')).toBeInTheDocument(); expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument()
  })
  it('filters backend events and orders them by simulation time then event ID', () => {
    renderWithContext(<EventMonitorPage />)
    const rows = screen.getAllByRole('row'); expect(rows[1]).toHaveTextContent('#00001'); expect(rows[2]).toHaveTextContent('#00002'); expect(rows[3]).toHaveTextContent('#00003')
    fireEvent.change(screen.getByLabelText('PID'), { target: { value: '22' } }); expect(screen.getAllByRole('row')).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Search events'), { target: { value: 'paused' } }); expect(screen.getAllByRole('row')).toHaveLength(2); expect(screen.getByText('worker paused')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search events'), { target: { value: '' } }); fireEvent.change(screen.getByLabelText('Event type'), { target: { value: 'PROCESS_CREATED' } }); expect(screen.getAllByRole('row')).toHaveLength(2); expect(screen.getByText('worker created')).toBeInTheDocument()
  })
  it('loads archive snapshots and confirms deletion of saved records', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWithContext(<ArchivePage />)
    expect(await screen.findByText('Completed sample')).toBeInTheDocument(); expect(screen.getByText('Default RR')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Load snapshot Completed sample' })); await waitFor(() => expect(mocks.simGet).toHaveBeenCalledWith('s-1'))
    expect(await screen.findByText(/does not restore a saved run/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete simulation Completed sample' })); await waitFor(() => expect(mocks.deleteSim).toHaveBeenCalledWith('s-1'))
    expect(window.confirm).toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Snapshot name'), { target: { value: 'New completed run' } }); fireEvent.click(screen.getByRole('button', { name: 'Save completed run' }))
    await waitFor(() => expect(mocks.saveSim).toHaveBeenCalledWith('New completed run'))
    fireEvent.change(screen.getByLabelText('Configuration name'), { target: { value: 'RR default' } }); fireEvent.click(screen.getByRole('button', { name: 'Save configuration' }))
    await waitFor(() => expect(mocks.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ name: 'RR default', algorithm: 'ROUND_ROBIN', timeQuantum: 2 })))
    fireEvent.click(screen.getByRole('button', { name: 'Delete configuration Default RR' })); await waitFor(() => expect(mocks.deleteConfig).toHaveBeenCalledWith('c-1'))
    fireEvent.click(screen.getByRole('button', { name: 'Load configuration Default RR' })); await waitFor(() => expect(mocks.configGet).toHaveBeenCalledWith('c-1'))
    await waitFor(() => expect(JSON.parse(localStorage.getItem('kernelx.pendingSchedulerConfig') ?? '{}').timeQuantum).toBe(2))
  })
  it('checks backend health and persists functional local defaults', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    expect(await screen.findByText('Connected')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Scheduling algorithm'), { target: { value: 'SJF' } }); fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }))
    expect(JSON.parse(localStorage.getItem('kernelx.defaultSchedulerConfig') ?? '{}').algorithm).toBe('SJF')
    expect(screen.getByText('Saved in this browser')).toBeInTheDocument()
  })
  it('exposes all eight working navigation routes', async () => {
    render(<MemoryRouter initialEntries={['/overview']}><App /></MemoryRouter>)
    for (const label of ['Overview', 'Processes', 'CPU Scheduler', 'Memory Manager', 'Process Tree', 'Event Monitor', 'Simulation Archive', 'Settings']) expect(await screen.findByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Process Tree/ })); expect(await screen.findByRole('heading', { name: 'Process tree' })).toBeInTheDocument()
  }, 15000)

  it.each(['/processes', '/memory'])('returns from %s to the existing landing page through the internal logo', async (route) => {
    render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)
    const brand = await screen.findByRole('link', { name: 'KernelX home' })
    expect(brand).toHaveAttribute('href', '/')
    fireEvent.click(brand)
    expect(await screen.findByRole('heading', { name: /Inside the machine/i })).toBeInTheDocument()
  }, 15000)

  it('shows the new landing route and enters the existing overview', async () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: /Inside the machine/i })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveClass('landing-cinematic-page')
    expect(screen.getByRole('link', { name: /Skip tour/i })).toHaveAttribute('href', '/overview')
    expect(screen.getByText(/Scroll to explore/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Skip tour/i }))
    expect(await screen.findByRole('heading', { name: 'System overview' })).toBeInTheDocument()
  }, 15000)

  it('offers the final cinematic call to action at the end of the tour', () => {
    render(<MemoryRouter><LandingStoryOverlay stage={5} /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /The work is done.*Now see the whole machine/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Enter KernelX/i })).toHaveAttribute('href', '/overview')
  })
})
