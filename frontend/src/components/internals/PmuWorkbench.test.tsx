import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PmuWorkbench } from './PmuWorkbench'
import type { PmuListSnapshot } from '../../types/api'

const snapshot: PmuListSnapshot = {
  listId: 'list-test', headNodeId: 4, tailNodeId: 5, size: 2, truncated: false,
  nodes: [
    { nodeId: 4, pid: 31, name: 'init', state: 'READY', priority: 2, arrivalTime: 0, burstTime: 2, remainingTime: 2, memoryRequirement: 32, parentPid: -1, completionTime: -1, waitingTime: 0, turnaroundTime: -1, responseTime: -1, nextNodeId: 5 },
    { nodeId: 5, pid: 32, name: 'worker', state: 'NEW', priority: 7, arrivalTime: 1, burstTime: 4, remainingTime: 4, memoryRequirement: 64, parentPid: -1, completionTime: -1, waitingTime: 0, turnaroundTime: -1, responseTime: -1, nextNodeId: null },
  ],
}

describe('PMU workbench', () => {
  it('renders actual ordered nodes, head, next targets and null termination', () => {
    render(<PmuWorkbench snapshot={snapshot} traces={[]} trace={null} selectedTraceId="" stepIndex={-1} mode="LIVE" playing={false} loading={false} traceLoading={false} error="" onRefresh={vi.fn()} onSelectTrace={vi.fn()} onStep={vi.fn()} onModeChange={vi.fn()} onTogglePlay={vi.fn()} onFocus={vi.fn()} onResetCamera={vi.fn()} />)
    const list = screen.getByRole('list', { name: 'Live linked-list nodes' })
    expect(list.textContent).toMatch(/N4.*P31.*init.*next N5.*HEAD/)
    expect(list.textContent).toMatch(/N5.*P32.*worker.*next NULL/)
  })

  it('shows empty and error states without requiring fabricated nodes', () => {
    render(<PmuWorkbench snapshot={{ ...snapshot, headNodeId: null, tailNodeId: null, size: 0, nodes: [] }} traces={[]} trace={null} selectedTraceId="" stepIndex={-1} mode="LIVE" playing={false} loading={false} traceLoading={false} error="API unavailable" onRefresh={vi.fn()} onSelectTrace={vi.fn()} onStep={vi.fn()} onModeChange={vi.fn()} onTogglePlay={vi.fn()} onFocus={vi.fn()} onResetCamera={vi.fn()} />)
    expect(screen.getByText('Empty PCB list')).toBeInTheDocument()
    expect(screen.getByText('API unavailable')).toBeInTheDocument()
  })

  it('exposes separate PDU/PMU view actions', () => {
    const focus = vi.fn(), reset = vi.fn()
    render(<PmuWorkbench snapshot={snapshot} traces={[]} trace={null} selectedTraceId="" stepIndex={-1} mode="LIVE" playing={false} loading={false} traceLoading={false} error="" onRefresh={vi.fn()} onSelectTrace={vi.fn()} onStep={vi.fn()} onModeChange={vi.fn()} onTogglePlay={vi.fn()} onFocus={focus} onResetCamera={reset} />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus PMU' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset camera' }))
    expect(focus).toHaveBeenCalledOnce(); expect(reset).toHaveBeenCalledOnce()
  })
})
