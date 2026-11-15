import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AluWorkbench } from './AluWorkbench'
import type { AluTableSnapshot, AluTrace } from '../../types/api'

const entry = { entryId: 2, pid: 17, name: 'worker', state: 'READY' as const, priority: 4, arrivalTime: 0, burstTime: 3, remainingTime: 3, memoryRequirement: 32, parentPid: -1, completionTime: -1, waitingTime: 0, turnaroundTime: -1, responseTime: -1, nextEntryId: 1 }
const snapshot: AluTableSnapshot = { tableId: 'table', capacity: 16, size: 2, loadFactor: .125, truncated: false, buckets: Array.from({ length: 16 }, (_, index) => ({ index, chainLength: index === 1 ? 2 : 0, entries: index === 1 ? [entry, { ...entry, entryId: 1, pid: 1, name: 'init', nextEntryId: null }] : [], truncated: false })) }
const trace: AluTrace = { traceId: 'trace', tableId: 'table', operation: 'PUT', pid: 17, spreadHash: 17, bucketIndex: 1, simulationTime: null, recordedAt: '2026-01-01T00:00:00Z', stepCount: 2, result: true, truncated: false, description: 'Inserted new key at bucket 1 chain head', beforeSnapshot: snapshot, afterSnapshot: snapshot, bucketBefore: snapshot.buckets[1], bucketAfter: snapshot.buckets[1], steps: [
  { sequence: 1, kind: 'COLLISION', pid: 17, entryId: null, bucketIndex: 1, oldBucketIndex: null, newBucketIndex: null, chainPosition: 0, collisionChainLength: 1, spreadHash: 17, oldCapacity: null, newCapacity: null, ownerEntryId: null, oldNextEntryId: null, newNextEntryId: null, oldBucketHeadEntryId: null, newBucketHeadEntryId: null, result: null, entry: null, description: 'Distinct PID mapped to occupied bucket; chain length 1' },
  { sequence: 2, kind: 'BUCKET_HEAD_UPDATED', pid: 17, entryId: 2, bucketIndex: 1, oldBucketIndex: null, newBucketIndex: null, chainPosition: null, collisionChainLength: null, spreadHash: 17, oldCapacity: null, newCapacity: null, ownerEntryId: null, oldNextEntryId: null, newNextEntryId: null, oldBucketHeadEntryId: 1, newBucketHeadEntryId: 2, result: null, entry, description: 'Updated bucket head link' },
] }
const props = { snapshot, traces: [{ traceId: 'trace', tableId: 'table', operation: 'PUT' as const, pid: 17, spreadHash: 17, bucketIndex: 1, simulationTime: null, recordedAt: trace.recordedAt, stepCount: 1, result: true, truncated: false, description: trace.description }], trace: null as AluTrace | null, selectedTraceId: '', bucketIndex: null as number | null, stepIndex: -1, loading: false, traceLoading: false, playing: false, error: '', onRefresh: vi.fn(), onSelectTrace: vi.fn(), onSelectBucket: vi.fn(), onStep: vi.fn(), onTogglePlay: vi.fn(), onFocus: vi.fn() }

describe('ALU workbench', () => {
  it('renders actual occupied buckets and lets the user inspect chain order', () => {
    render(<AluWorkbench {...props}/>); expect(screen.getByText('P17 → P1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bucket 1, 2 entries' })); expect(props.onSelectBucket).toHaveBeenCalledWith(1)
  })
  it('shows empty table and trace states and displays backend errors', () => {
    render(<AluWorkbench {...props} snapshot={{ ...snapshot, size: 0, buckets: snapshot.buckets.map((b) => ({ ...b, chainLength: 0, entries: [] })) }} traces={[]} error="API unavailable"/>)
    expect(screen.getByText('PID table is empty')).toBeInTheDocument(); expect(screen.getByText('No recorded PID operations')).toBeInTheDocument(); expect(screen.getByText('API unavailable')).toBeInTheDocument()
  })
  it('plays a recorded operation as read-only history and supports step selection', () => {
    render(<AluWorkbench {...props} trace={trace} selectedTraceId="trace" stepIndex={0}/>); expect(screen.getByText('COLLISION')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next ALU step' })); expect(props.onStep).toHaveBeenCalledWith(1)
    expect(screen.getByText(/Historical view · read only/)).toBeInTheDocument()
  })
})
