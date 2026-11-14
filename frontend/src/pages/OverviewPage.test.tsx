import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { OverviewPage } from './OverviewPage'
import type { useSystemData } from '../hooks/useSystemData'

const context: ReturnType<typeof useSystemData> = {
  processes: [{ pid: 17, name: 'compiler', priority: 5, arrivalTime: 0, burstTime: 8, remainingTime: 4, memoryRequirement: 256, parentPid: -1, state: 'READY', completionTime: -1, waitingTime: 0, turnaroundTime: -1, responseTime: -1 }],
  memory: { totalMemory: 1024, allocatedMemory: 256, freeMemory: 768, blocks: [{ startAddress: 0, size: 256, pid: 17, free: false }, { startAddress: 256, size: 768, pid: null, free: true }] },
  simulation: { status: 'RUNNING', algorithm: 'FCFS', currentTime: 4, totalTime: 8, speed: 1, runningPid: 17, readyPids: [], waitingPids: [], completedSegments: [{ pid: 17, processName: 'compiler', startTime: 0, endTime: 4, duration: 4, idle: false }] },
  events: [{ eventId: 7, simulationTime: 4, pid: 17, type: 'STATE_CHANGED', description: 'compiler is ready' }], connected: true, loading: false, error: '', refresh: vi.fn(), setProcesses: vi.fn(), setMemory: vi.fn(), setSimulation: vi.fn(),
}

function Wrapper() { return <Outlet context={context} /> }
describe('OverviewPage', () => {
  it('renders the live process, memory, execution and event payloads', () => {
    render(<MemoryRouter><Routes><Route element={<Wrapper />}><Route path="*" element={<OverviewPage />} /></Route></Routes></MemoryRouter>)
    expect(screen.getByText('System overview')).toBeInTheDocument()
    expect(screen.getByText('P17')).toBeInTheDocument()
    expect(screen.getByText('256')).toBeInTheDocument()
    expect(screen.getByText('STATE CHANGED')).toBeInTheDocument()
    expect(screen.getAllByText('T+4')).toHaveLength(2)
  })
})
